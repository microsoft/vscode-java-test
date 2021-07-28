/*******************************************************************************
 * Copyright (c) 2021 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.util;

import com.microsoft.java.test.plugin.model.JavaTestItem;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.provider.TestKindProvider;
import com.microsoft.java.test.plugin.searcher.TestFrameworkSearcher;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.IPackageFragmentRoot;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.AST;
import org.eclipse.jdt.core.dom.ASTNode;
import org.eclipse.jdt.core.dom.ASTParser;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.manipulation.CoreASTProvider;
import org.eclipse.jdt.ls.core.internal.JavaLanguageServerPlugin;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.jdt.ls.core.internal.ResourceUtils;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@SuppressWarnings("restriction")
public class TestSearchUtils {

    /**
     * List all the Java Projects in the given workspace folder
     */
    public static List<JavaTestItem> findJavaProjects(List<Object> arguments, IProgressMonitor monitor) {
        if (arguments == null || arguments.size() == 0) {
            return Collections.emptyList();
        }
        final String workspaceFolderUri = (String) arguments.get(0);
        final IPath workspaceFolderPath = ResourceUtils.filePathFromURI(workspaceFolderUri);
        if (workspaceFolderPath == null) {
            JUnitPlugin.logError("Failed to parse workspace folder path from uri: " + workspaceFolderUri);
            // todo: handle non-file scheme
            return Collections.emptyList();
        }
        final List<IJavaProject> javaProjects = new LinkedList<>();
        for (final IJavaProject project : ProjectUtils.getJavaProjects()) {
            if (monitor != null && monitor.isCanceled()) {
                return Collections.emptyList();
            }
            if (project.getProject().equals(JavaLanguageServerPlugin.getProjectsManager().getDefaultProject())) {
                continue;
            }
            javaProjects.add(project);
        }

        final List<JavaTestItem> resultList = new LinkedList<>();
        for (final IJavaProject project : javaProjects) {
            try {
                resultList.add(TestItemUtils.constructJavaTestItem(project, TestLevel.PROJECT, TestKind.None));
            } catch (JavaModelException e) {
                JUnitPlugin.logError("Failed to parse project item: " + project.getElementName());
            }
        }
        
        return resultList;
    }

    /**
     * Return a list of test packages and types in the given project. The returned list has the following hierarchy:
     * Package A
     *    ├── Class A
     *         ├── Nested Class A
     *    ├── Class B
     * Package B
     *    ├── ...
     *
     * @param arguments argument list which contains the JDT handler ID of a Java project
     * @param monitor monitor
     * @throws CoreException
     */
    public static List<JavaTestItem> findTestPackagesAndTypes(List<Object> arguments, IProgressMonitor monitor)
            throws CoreException {
        final String handlerId = (String) arguments.get(0);
        final IJavaElement element = JavaCore.create(handlerId);
        if (!(element instanceof IJavaProject)) {
            JUnitPlugin.logError("failed to parse IJavaProject from JDT handler ID: " + handlerId);
            return Collections.emptyList();
        }
        final IJavaProject javaProject = (IJavaProject) element;
        final Map<String, JavaTestItem> testItemMapping = new HashMap<>();
        final List<TestKind> testKinds = TestKindProvider.getTestKindsFromCache(javaProject);
        for (final TestKind kind : testKinds) {
            if (monitor != null && monitor.isCanceled()) {
                return Collections.emptyList();
            }
            final TestFrameworkSearcher searcher = TestFrameworkUtils.getSearcherByTestKind(kind);
            final Set<IType> testTypes = new HashSet<>();
            final List<IClasspathEntry> testEntries = ProjectTestUtils.getTestEntries(javaProject);
            for (final IClasspathEntry entry : testEntries) {
                final IPackageFragmentRoot[] packageRoots = javaProject.findPackageFragmentRoots(entry);
                for (final IPackageFragmentRoot root : packageRoots) {
                    try {
                        testTypes.addAll(searcher.findTestItemsInContainer(root, monitor));
                    } catch (CoreException e) {
                        JUnitPlugin.logException("failed to search tests in: " + root.getElementName(), e);
                    }
                }
            }

            for (final IType type : testTypes) {
                JavaTestItem classItem = testItemMapping.get(type.getHandleIdentifier());
                if (classItem == null) {
                    classItem = TestItemUtils.constructJavaTestItem(
                            type, TestLevel.CLASS, kind);
                    testItemMapping.put(classItem.getJdtHandler(), classItem);
                } else {
                    // 1. We suppose a class can only use one test framework
                    // 2. If more accurate kind is available, use it.
                    if (classItem.getTestKind() == TestKind.JUnit5 && kind == TestKind.JUnit) {
                        classItem.setTestKind(TestKind.JUnit);
                    }
                }

                final IType declaringType = type.getDeclaringType();
                if (declaringType == null) {
                    // it's a root type, we find its declaring package
                    final IPackageFragment packageFragment = type.getPackageFragment();
                    final String packageIdentifier = packageFragment.getHandleIdentifier();
                    JavaTestItem packageItem = testItemMapping.get(packageIdentifier);
                    if (packageItem == null) {
                        packageItem = TestItemUtils.constructJavaTestItem(
                                packageFragment, TestLevel.PACKAGE, TestKind.None);
                        testItemMapping.put(packageIdentifier, packageItem);
                    }
                    if (packageItem.getChildren() == null || !packageItem.getChildren().contains(classItem)) {
                        packageItem.addChild(classItem);
                    }
                } else {
                    final String declaringTypeIdentifier = declaringType.getHandleIdentifier();
                    JavaTestItem declaringTypeItem = testItemMapping.get(declaringTypeIdentifier);
                    if (declaringTypeItem == null) {
                        declaringTypeItem = TestItemUtils.constructJavaTestItem(
                                declaringType, TestLevel.CLASS, kind);
                        testItemMapping.put(declaringTypeIdentifier, declaringTypeItem);
                    }
                    if (declaringTypeItem.getChildren() == null ||
                            !declaringTypeItem.getChildren().contains(classItem)) {
                        declaringTypeItem.addChild(classItem);
                    }
                }
            }
        }

        final List<JavaTestItem> result = new LinkedList<>();
        for (final JavaTestItem item : testItemMapping.values()) {
            if (item.getTestLevel() == TestLevel.PACKAGE) {
                result.add(item);
            }
        }

        return result;
    }

    public static ASTNode parseToAst(final ICompilationUnit unit, final boolean fromCache,
            final IProgressMonitor monitor) {
        if (fromCache) {
            final CompilationUnit astRoot = CoreASTProvider.getInstance().getAST(unit, CoreASTProvider.WAIT_YES,
                    monitor);
            if (astRoot != null) {
                return astRoot;
            }
        }

        if (monitor.isCanceled()) {
            return null;
        }

        final ASTParser parser = ASTParser.newParser(AST.JLS14);
        parser.setSource(unit);
        parser.setFocalPosition(0);
        parser.setResolveBindings(true);
        parser.setIgnoreMethodBodies(true);
        return parser.createAST(monitor);
    }
}
