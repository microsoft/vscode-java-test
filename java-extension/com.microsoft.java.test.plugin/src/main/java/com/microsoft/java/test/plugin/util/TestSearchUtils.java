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

import org.apache.commons.lang3.StringUtils;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.OperationCanceledException;
import org.eclipse.core.runtime.SubProgressMonitor;
import org.eclipse.core.runtime.jobs.Job;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaModel;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.IPackageFragmentRoot;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.AST;
import org.eclipse.jdt.core.dom.ASTNode;
import org.eclipse.jdt.core.dom.ASTParser;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.dom.IMethodBinding;
import org.eclipse.jdt.core.dom.ITypeBinding;
import org.eclipse.jdt.core.dom.TypeDeclaration;
import org.eclipse.jdt.core.manipulation.CoreASTProvider;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.TypeNameMatch;
import org.eclipse.jdt.core.search.TypeNameMatchRequestor;
import org.eclipse.jdt.internal.corext.refactoring.structure.ASTNodeSearchUtil;
import org.eclipse.jdt.internal.junit.util.CoreTestSearchEngine;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.JavaLanguageServerPlugin;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.jdt.ls.core.internal.ResourceUtils;
import org.eclipse.jdt.ls.core.internal.handlers.DocumentLifeCycleHandler;
import org.eclipse.lsp4j.Location;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

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
        final IPath workspaceFolderPath = ResourceUtils.canonicalFilePathFromURI(workspaceFolderUri);
        if (workspaceFolderPath == null) {
            JUnitPlugin.logError("Failed to parse workspace folder path from uri: " + workspaceFolderUri);
            // todo: handle non-file scheme
            return Collections.emptyList();
        }

        final String invisibleProjectName = ProjectUtils.getWorkspaceInvisibleProjectName(workspaceFolderPath);
        final List<JavaTestItem> resultList = new LinkedList<>();
        for (final IJavaProject project : ProjectUtils.getJavaProjects()) {
            if (monitor != null && monitor.isCanceled()) {
                return Collections.emptyList();
            }

            if (project.getProject().equals(JavaLanguageServerPlugin.getProjectsManager().getDefaultProject())) {
                continue;
            }

            // Ignore all the projects that's not contained in the workspace folder, except
            // for the invisible project. This is to make sure in a multi-roots workspace, an
            // out-of-date invisible project won't be listed in the result.
            if ((!ResourceUtils.isContainedIn(project.getProject().getLocation(),
                    Collections.singletonList(workspaceFolderPath)) && !Objects.equals(project.getProject().getName(),
                    invisibleProjectName))) {
                continue;
            }

            final TestKind testKind;
            final List<TestKind> testKinds = TestKindProvider.getTestKindsFromCache(project);
            if (testKinds.isEmpty()) {
                testKind = TestKind.None;
            } else {
                testKind = testKinds.get(0);
            }

            try {
                final JavaTestItem item = TestItemUtils.constructJavaTestItem(project, TestLevel.PROJECT, testKind);
                item.setNatureIds(project.getProject().getDescription().getNatureIds());
                resultList.add(item);
            } catch (CoreException e) {
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

    /**
     * Find the direct declared testable class and method for a given class
     * @param arguments
     * @param monitor
     * @return
     * @throws JavaModelException
     * @throws OperationCanceledException
     * @throws InterruptedException
     */
    public static List<JavaTestItem> findDirectTestChildrenForClass(List<Object> arguments, IProgressMonitor monitor)
            throws JavaModelException, OperationCanceledException, InterruptedException {
        final String handlerId = (String) arguments.get(0);

        // wait for the LS finishing updating
        Job.getJobManager().join(DocumentLifeCycleHandler.DOCUMENT_LIFE_CYCLE_JOBS, monitor);

        final IType testType = (IType) JavaCore.create(handlerId);
        if (testType == null) {
            return Collections.emptyList();
        }

        final ICompilationUnit unit = testType.getCompilationUnit();
        if (unit == null) {
            return Collections.emptyList();
        }
        final List<TestKind> testKinds = TestKindProvider.getTestKindsFromCache(unit.getJavaProject());

        final List<JavaTestItem> result = new LinkedList<>();
        final CompilationUnit root = (CompilationUnit) parseToAst(unit, true /* fromCache */, monitor);
        for (final IType type : unit.getAllTypes()) {
            if (monitor != null && monitor.isCanceled()) {
                return result;
            }

            final IType declaringType = type.getDeclaringType();
            if (declaringType != null &&
                    declaringType.getFullyQualifiedName().equals(testType.getFullyQualifiedName())) {
                for (final TestKind kind: testKinds) {
                    final TestFrameworkSearcher searcher = TestFrameworkUtils.getSearcherByTestKind(kind);
                    if (searcher.isTestClass(type)) {
                        result.add(TestItemUtils.constructJavaTestItem(type, TestLevel.CLASS, kind));
                        break;
                    }
                }
                continue;
            }

            if (!type.getFullyQualifiedName().equals(testType.getFullyQualifiedName())) {
                continue;
            }

            final TypeDeclaration typeDeclaration = ASTNodeSearchUtil.getTypeDeclarationNode(type, root);
            if (typeDeclaration == null) {
                continue;
            }

            final ITypeBinding binding = typeDeclaration.resolveBinding();
            if (binding == null) {
                continue;
            }

            
            for (final IMethodBinding methodBinding : binding.getDeclaredMethods()) {
                for (final TestKind kind: testKinds) {
                    final TestFrameworkSearcher searcher = TestFrameworkUtils.getSearcherByTestKind(kind);
                    if (searcher.isTestMethod(methodBinding)) {
                        result.add(TestItemUtils.constructJavaTestItem(
                            (IMethod) methodBinding.getJavaElement(),
                            TestLevel.METHOD,
                            kind
                        ));
                    }
                }
            }
        }

        return result;
    }

    /**
     * Get all the test types and methods is the given file
     * @param arguments Contains the target file's uri
     * @param monitor Progress monitor
     * @throws CoreException
     * @throws OperationCanceledException
     * @throws InterruptedException
     */
    public static List<JavaTestItem> findTestTypesAndMethods(List<Object> arguments, IProgressMonitor monitor)
            throws CoreException, OperationCanceledException, InterruptedException {
        // todo: This method is somehow duplicated with findDirectTestChildrenForClass,
        // considering merge them in the future.
        final String uriString = (String) arguments.get(0);

        // wait for the LS finishing updating
        Job.getJobManager().join(DocumentLifeCycleHandler.DOCUMENT_LIFE_CYCLE_JOBS, monitor);

        final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(uriString);
        if (unit == null) {
            return Collections.emptyList();
        }

        final IType primaryType = unit.findPrimaryType();
        if (primaryType == null) {
            return Collections.emptyList();
        }

        final CompilationUnit root = (CompilationUnit) parseToAst(unit, true /* fromCache */, monitor);
        if (root == null) {
            return Collections.emptyList();
        }

        final List<TestKind> testKinds = TestKindProvider.getTestKindsFromCache(unit.getJavaProject());
        final List<TestFrameworkSearcher> searchers = new LinkedList<>();
        for (final TestKind kind : testKinds) {
            final TestFrameworkSearcher searcher = TestFrameworkUtils.getSearcherByTestKind(kind);
            if (searcher != null) {
                searchers.add(searcher);
            }
        }

        if (searchers.size() == 0) {
            Collections.emptyList();
        }

        final TypeDeclaration typeDeclaration = ASTNodeSearchUtil.getTypeDeclarationNode(primaryType, root);
        if (typeDeclaration == null) {
            return Collections.emptyList();
        }

        final ITypeBinding binding = typeDeclaration.resolveBinding();
        if (binding == null) {
            return Collections.emptyList();
        }

        final JavaTestItem fakeRoot = new JavaTestItem();
        findTestItemsInTypeBinding(binding, fakeRoot, searchers, monitor);
        return fakeRoot.getChildren();
    }

    private static void findTestItemsInTypeBinding(ITypeBinding typeBinding, JavaTestItem parentItem,
            List<TestFrameworkSearcher> searchers, IProgressMonitor monitor) throws JavaModelException {
        if (monitor.isCanceled()) {
            return;
        }

        final IType type = (IType) typeBinding.getJavaElement();
        final List<JavaTestItem> testMethods = new LinkedList<>();
        searchers = searchers.stream().filter(s -> {
            try {
                return CoreTestSearchEngine.isAccessibleClass(type, s.getJdtTestKind());
            } catch (JavaModelException e) {
                return false;
            }
        }).collect(Collectors.toList());

        for (final IMethodBinding methodBinding : typeBinding.getDeclaredMethods()) {
            for (final TestFrameworkSearcher searcher : searchers) {
                if (searcher.isTestMethod(methodBinding)) {
                    final JavaTestItem methodItem = TestItemUtils.constructJavaTestItem(
                        (IMethod) methodBinding.getJavaElement(),
                        TestLevel.METHOD,
                        searcher.getTestKind()
                    );
                    testMethods.add(methodItem);
                    break;
                }
            }
        }

        JavaTestItem classItem = null;
        if (testMethods.size() > 0) {
            classItem = TestItemUtils.constructJavaTestItem(type, TestLevel.CLASS, testMethods.get(0).getTestKind());
            classItem.setChildren(testMethods);
        } else {
            if (TestFrameworkUtils.JUNIT4_TEST_SEARCHER.isTestClass(type)) {
                // to handle @RunWith classes
                classItem = TestItemUtils.constructJavaTestItem(type, TestLevel.CLASS, TestKind.JUnit);
            } else if (TestFrameworkUtils.JUNIT5_TEST_SEARCHER.isTestClass(type)) {
                // to handle @Nested and @Testable classes
                classItem = TestItemUtils.constructJavaTestItem(type, TestLevel.CLASS, TestKind.JUnit5);
            }
        }

        // set the class item as the child of its declaring type
        if (classItem != null && parentItem != null) {
            parentItem.addChild(classItem);
        }

        for (final ITypeBinding childTypeBinding : typeBinding.getDeclaredTypes()) {
            findTestItemsInTypeBinding(childTypeBinding, classItem, searchers, monitor);
        }
    }

    /**
     * Given a file Uri, resolve its belonging project and package node in the test explorer, this is
     * used to find the test item node when a test file is changed
     * @param arguments A list containing a uri of the file
     * @param monitor Progress monitor
     * @throws JavaModelException
     */
    public static List<JavaTestItem> resolvePath(List<Object> arguments, IProgressMonitor monitor)
            throws JavaModelException {
        final List<JavaTestItem> result = new LinkedList<>();
        final String uriString = (String) arguments.get(0);
        if (JavaCore.isJavaLikeFileName(uriString)) {
            final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(uriString);
            if (unit == null) {
                return Collections.emptyList();
            }
            final IJavaProject project = unit.getJavaProject();
            if (project == null) {
                return Collections.emptyList();
            }

            final TestKind testKind;
            final List<TestKind> testKinds = TestKindProvider.getTestKindsFromCache(project);
            if (testKinds.isEmpty()) {
                return Collections.emptyList();
            } else {
                testKind = testKinds.get(0);
            }
            result.add(TestItemUtils.constructJavaTestItem(project, TestLevel.PROJECT, testKind));

            final IPackageFragment packageFragment = (IPackageFragment) unit.getParent();
            if (packageFragment == null || !(packageFragment instanceof IPackageFragment)) {
                return Collections.emptyList();
            }
            result.add(TestItemUtils.constructJavaTestItem(packageFragment, TestLevel.PACKAGE, testKind));
        }

        return result;
    }

    /**
     * Given the test item's full name, get its location. This is used to calculate the location for each test message.
     */
    public static Location findTestLocation(List<Object> arguments, IProgressMonitor monitor)
            throws JavaModelException {
        final String fullName = (String) arguments.get(0);
        if (StringUtils.isEmpty(fullName)) {
            return null;
        }

        final int projectNameEnd = fullName.indexOf("@");
        if (projectNameEnd < 0) {
            return null;
        }

        final String projectName = fullName.substring(0, projectNameEnd);
        if (StringUtils.isEmpty(projectName)) {
            return null;
        }

        final IJavaProject javaProject = ProjectUtils.getJavaProject(projectName);
        if (javaProject == null) {
            return null;
        }

        final int methodStart = fullName.indexOf("#");
        final String typeName;
        final String methodName;
        if (methodStart > 0) {
            typeName = fullName.substring(projectNameEnd + 1, methodStart);
            methodName = fullName.substring(methodStart + 1);
        } else {
            typeName = fullName.substring(projectNameEnd + 1);
            methodName = null;
        }

        final IType type = findType(javaProject, typeName, monitor);
        if (type == null) {
            return null;
        }

        if (StringUtils.isEmpty(methodName)) {
            return new Location(JDTUtils.getFileURI(type.getResource()), TestItemUtils.parseTestItemRange(type));
        }

        for (final IMethod method : type.getMethods()) {
            if (methodName.equals(method.getElementName())) {
                // TODO: handle the override method
                return new Location(JDTUtils.getFileURI(method.getResource()),
                        TestItemUtils.parseTestItemRange(method));
            }
        }

        return null;
    }

    protected static final IType findType(final IJavaProject project, String className, IProgressMonitor monitor) {
        final IType[] result = { null };
        final String dottedName = className.replace('$', '.'); // for nested classes...
        try {
            if (project != null) {
                result[0] = internalFindType(project, dottedName, new HashSet<IJavaProject>(), monitor);
            }
            if (result[0] == null) {
                final int lastDot = dottedName.lastIndexOf('.');
                final TypeNameMatchRequestor nameMatchRequestor = new TypeNameMatchRequestor() {
                    @Override
                    public void acceptTypeNameMatch(TypeNameMatch match) {
                        result[0] = match.getType();
                    }
                };
                new SearchEngine().searchAllTypeNames(
                        lastDot >= 0 ? dottedName.substring(0, lastDot).toCharArray() : null,
                        SearchPattern.R_EXACT_MATCH | SearchPattern.R_CASE_SENSITIVE,
                        (lastDot >= 0 ? dottedName.substring(lastDot + 1) : dottedName).toCharArray(),
                        SearchPattern.R_EXACT_MATCH | SearchPattern.R_CASE_SENSITIVE,
                        IJavaSearchConstants.TYPE,
                        SearchEngine.createWorkspaceScope(),
                        nameMatchRequestor,
                        IJavaSearchConstants.WAIT_UNTIL_READY_TO_SEARCH,
                        monitor);
            }
        } catch (JavaModelException e) {
            JUnitPlugin.log(e);
        }
        
        return result[0];
    }

    /**
     * copied from org.eclipse.jdt.internal.junit.ui.OpenEditorAction.internalFindType()
     */
    private static IType internalFindType(IJavaProject project, String className, Set<IJavaProject> visitedProjects,
            IProgressMonitor monitor) throws JavaModelException {
        try {
            if (visitedProjects.contains(project)) {
                return null;
            }
            monitor.beginTask("", 2); //$NON-NLS-1$
            IType type = project.findType(className, new SubProgressMonitor(monitor, 1));
            if (type != null) {
                return type;
            }
            //fix for bug 87492: visit required projects explicitly to also find not exported types
            visitedProjects.add(project);
            final IJavaModel javaModel = project.getJavaModel();
            final String[] requiredProjectNames = project.getRequiredProjectNames();
            final IProgressMonitor reqMonitor = new SubProgressMonitor(monitor, 1);
            reqMonitor.beginTask("", requiredProjectNames.length); //$NON-NLS-1$
            for (final String requiredProjectName : requiredProjectNames) {
                final  IJavaProject requiredProject = javaModel.getJavaProject(requiredProjectName);
                if (requiredProject.exists()) {
                    type = internalFindType(requiredProject, className, visitedProjects,
                            new SubProgressMonitor(reqMonitor, 1));
                    if (type != null) {
                        return type;
                    }
                }
            }
            return null;
        } finally {
            monitor.done();
        }
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
