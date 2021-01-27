/*******************************************************************************
 * Copyright (c) 2018 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.util;

import com.google.gson.Gson;
import com.microsoft.java.test.plugin.model.SearchTestItemParams;
import com.microsoft.java.test.plugin.model.TestItem;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.searcher.TestFrameworkSearcher;

import org.eclipse.core.resources.IFolder;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.OperationCanceledException;
import org.eclipse.core.runtime.jobs.Job;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
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
import org.eclipse.jdt.core.dom.ITypeBinding;
import org.eclipse.jdt.core.dom.TypeDeclaration;
import org.eclipse.jdt.core.manipulation.CoreASTProvider;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchMatch;
import org.eclipse.jdt.core.search.SearchParticipant;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.SearchRequestor;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.jdt.ls.core.internal.handlers.DocumentLifeCycleHandler;
import org.eclipse.jdt.ls.core.internal.managers.ProjectsManager;
import org.eclipse.lsp4j.Location;

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Stream;

@SuppressWarnings("restriction")
public class TestSearchUtils {

    /**
     * Method to search the Code Lenses
     *
     * @param arguments contains the URI of the file to search the Code Lens.
     * @param monitor
     * @throws OperationCanceledException
     * @throws InterruptedException
     * @throws JavaModelException
     */
    public static List<TestItem> searchCodeLens(List<Object> arguments, IProgressMonitor monitor)
            throws OperationCanceledException, InterruptedException, JavaModelException {
        final List<TestItem> resultList = new LinkedList<>();
        if (arguments == null || arguments.size() == 0) {
            return resultList;
        }

        final String uri = (String) arguments.get(0);

        // wait for the LS finishing updating
        Job.getJobManager().join(DocumentLifeCycleHandler.DOCUMENT_LIFE_CYCLE_JOBS, monitor);

        final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(uri);
        final IType primaryType = unit.findPrimaryType();
        if (!isJavaElementExist(unit) || primaryType == null || monitor.isCanceled()) {
            return resultList;
        }

        final CompilationUnit root = (CompilationUnit) parseToAst(unit, true /* fromCache */, monitor);
        if (root == null) {
            return resultList;
        }

        final ASTNode node = root.findDeclaringNode(primaryType.getKey());
        if (!(node instanceof TypeDeclaration)) {
            return resultList;
        }

        final ITypeBinding binding = ((TypeDeclaration) node).resolveBinding();
        if (binding == null) {
            return resultList;
        }

        TestFrameworkUtils.findTestItemsInTypeBinding(binding, resultList, null /* parentClassItem */, monitor);

        return resultList;
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

    /**
     * Method to expand the node in Test Explorer
     *
     * @param arguments {@link com.microsoft.java.test.plugin.model.SearchTestItemParams}
     * @param monitor
     * @throws OperationCanceledException
     * @throws InterruptedException
     * @throws URISyntaxException
     * @throws JavaModelException
     */
    public static List<TestItem> searchTestItems(final List<Object> arguments, final IProgressMonitor monitor)
            throws OperationCanceledException, InterruptedException, URISyntaxException, JavaModelException {
        final List<TestItem> resultList = new LinkedList<>();

        if (arguments == null || arguments.size() == 0) {
            return resultList;
        }
        final Gson gson = new Gson();
        final SearchTestItemParams params = gson.fromJson((String) arguments.get(0), SearchTestItemParams.class);

        switch (params.getLevel()) {
            case FOLDER:
                searchInFolder(resultList, params);
                break;
            case PACKAGE:
                searchInPackage(resultList, params);
                break;
            case CLASS:
                searchInClass(resultList, params, monitor);
                break;
            default:
                break;
        }

        return resultList;
    }

    /**
     * Method to get all the test items when running tests from Test Explorer
     *
     * @param arguments {@link com.microsoft.java.test.plugin.model.SearchTestItemParams}
     * @param monitor
     * @throws CoreException
     * @throws InterruptedException
     * @throws URISyntaxException
     */
    public static List<TestItem> searchAllTestItems(List<Object> arguments, IProgressMonitor monitor)
            throws CoreException, InterruptedException, URISyntaxException {
        if (arguments == null || arguments.size() == 0) {
            return Collections.emptyList();
        }

        final Gson gson = new Gson();
        final SearchTestItemParams params = gson.fromJson((String) arguments.get(0), SearchTestItemParams.class);

        if (params.getLevel() == TestLevel.METHOD) {
            // unreachable code since the client will directly run the test when it's triggered from method level
            throw new UnsupportedOperationException("Method level execution is not supported at server side.");
        } else if (params.getLevel() == TestLevel.CLASS) {
            final IJavaElement[] elements = getJavaElementForSearch(params);
            if (elements == null) {
                return Collections.emptyList();
            }
            final IType type = (IType) elements[0];
            TestItem[] testItems = null;
            if (TestFrameworkUtils.JUNIT4_TEST_SEARCHER.isTestClass(type)) {
                testItems = TestFrameworkUtils.JUNIT4_TEST_SEARCHER.findTestsInContainer(type, monitor);
            } else if (TestFrameworkUtils.JUNIT5_TEST_SEARCHER.isTestClass(type)) {
                testItems = TestFrameworkUtils.JUNIT5_TEST_SEARCHER.findTestsInContainer(type, monitor);
            } else if (TestFrameworkUtils.TESTNG_TEST_SEARCHER.isTestClass(type)) {
                testItems = TestFrameworkUtils.TESTNG_TEST_SEARCHER.findTestsInContainer(type, monitor);
            }

            if (testItems != null) {
                return Arrays.asList(testItems);
            }

            return Collections.emptyList();
        } else {
            final IJavaElement[] elements = getJavaElementForSearch(params);
            final Map<IJavaProject, List<TestFrameworkSearcher>> javaProjectMapping = new HashMap<>();
            final Set<IJavaProject> javaProjects = new HashSet<>();
            for (final IJavaElement element : elements) {
                javaProjects.add(element.getJavaProject());
            }

            final List<TestFrameworkSearcher> searchers = new LinkedList<>();
            for (final IJavaProject javaProject : javaProjects) {

                // We don't check JUnit 4 when JUnit 5 is available since it's backward compatible
                if (javaProject.findType("org.junit.jupiter.api.Test") != null) {
                    searchers.add(TestFrameworkUtils.JUNIT5_TEST_SEARCHER);
                } else if (javaProject.findType("org.junit.Test") != null) {
                    searchers.add(TestFrameworkUtils.JUNIT4_TEST_SEARCHER);
                }

                if (javaProject.findType("org.testng.annotations.Test") != null) {
                    searchers.add(TestFrameworkUtils.TESTNG_TEST_SEARCHER);
                }
                javaProjectMapping.put(javaProject, searchers);
            }

            final Map<String, TestItem> map = new HashMap<>();
            for (final IJavaElement element : elements) {
                for (final TestFrameworkSearcher searcher : javaProjectMapping.get(element.getJavaProject())) {
                    final TestItem[] items = searcher.findTestsInContainer(element, monitor);
                    Arrays.stream(items).forEach(item -> {
                        map.put(item.getId(), item);
                    });
                }
            }

            return new ArrayList<>(map.values());
        }

    }

    public static List<Location> searchLocation(List<Object> arguments, IProgressMonitor monitor) throws CoreException {
        final List<Location> searchResult = new LinkedList<>();
        if (arguments == null || arguments.size() == 0) {
            throw new IllegalArgumentException("Invalid arguments to search the location.");
        }
        String searchString = ((String) arguments.get(0)).replaceAll("[$#]", ".");
        int searchFor = IJavaSearchConstants.METHOD;
        if (searchString.endsWith("<TestError>")) {
            searchString = searchString.substring(0, searchString.indexOf("<TestError>") - 1);
            searchFor = IJavaSearchConstants.CLASS;
        }
        final SearchPattern pattern = SearchPattern.createPattern(searchString, searchFor,
                IJavaSearchConstants.DECLARATIONS, SearchPattern.R_PATTERN_MATCH);
        final IJavaProject[] projects = JavaCore.create(ResourcesPlugin.getWorkspace().getRoot())
                .getJavaProjects();
        final IJavaSearchScope scope = SearchEngine.createJavaSearchScope(projects, IJavaSearchScope.SOURCES);
        final SearchRequestor requestor = new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {
                final Object element = match.getElement();
                if (element instanceof IMethod || element instanceof IType) {
                    final IJavaElement javaElement = (IJavaElement) element;
                    searchResult.add(new Location(JDTUtils.getFileURI(javaElement.getResource()),
                            TestItemUtils.parseTestItemRange(javaElement)));
                }
            }
        };
        new SearchEngine().search(pattern, new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant() },
                scope, requestor, monitor);
        return searchResult;
    }

    private static boolean isInTestScope(IJavaElement element) throws JavaModelException {
        final IJavaProject project = element.getJavaProject();
        for (final IPath sourcePath : ProjectUtils.listSourcePaths(project)) {
            if (!ProjectTestUtils.isTest(project, sourcePath)) {
                continue;
            }
            if (sourcePath.isPrefixOf(element.getPath())) {
                return true;
            }
        }
        return false;
    }

    private static IJavaElement[] getJavaElementForSearch(SearchTestItemParams params) throws JavaModelException {
        switch (params.getLevel()) {
            case ROOT:
                return Stream.of(ProjectUtils.getJavaProjects())
                        .filter(javaProject -> !ProjectsManager.DEFAULT_PROJECT_NAME
                                .equals(javaProject.getProject().getName()))
                        .toArray(IJavaProject[]::new);
            case FOLDER:
                final Set<IJavaProject> projectSet = ProjectTestUtils.parseProjects(params.getUri());
                return projectSet.toArray(new IJavaElement[projectSet.size()]);
            case PACKAGE:
                final IJavaElement packageElement = resolvePackage(params.getUri(), params.getFullName());
                return new IJavaElement[] { packageElement };
            case CLASS:
                final ICompilationUnit compilationUnit = JDTUtils.resolveCompilationUnit(params.getUri());
                if (compilationUnit == null) {
                    return null;
                }
                for (final IType type : compilationUnit.getAllTypes()) {
                    if (Objects.equals(type.getFullyQualifiedName(), params.getFullName())) {
                        return new IJavaElement[] { type };
                    }
                }
                return null;
        }

        return new IJavaElement[] {};
    }

    private static void searchInFolder(List<TestItem> resultList, SearchTestItemParams params)
            throws URISyntaxException, JavaModelException {
        final Set<IJavaProject> projectSet = ProjectTestUtils.parseProjects(params.getUri());
        for (final IJavaProject project : projectSet) {
            for (final IPackageFragment packageFragment : project.getPackageFragments()) {
                if (isInTestScope(packageFragment) && packageFragment.getCompilationUnits().length > 0) {
                    resultList.add(TestItemUtils.constructTestItem(packageFragment, TestLevel.PACKAGE));
                }
            }
        }
    }

    private static void searchInPackage(List<TestItem> resultList, SearchTestItemParams params)
            throws JavaModelException {
        final IPackageFragment packageFragment = resolvePackage(params.getUri(), params.getFullName());
        if (packageFragment == null) {
            return;
        }

        for (final ICompilationUnit unit : packageFragment.getCompilationUnits()) {
            for (final IType type : unit.getTypes()) {
                resultList.add(TestItemUtils.constructTestItem(type, TestLevel.CLASS));
            }
        }
    }

    private static IPackageFragment resolvePackage(String uriString, String fullName) throws JavaModelException {
        if (TestItemUtils.DEFAULT_PACKAGE_NAME.equals(fullName)) {
            final IFolder resource = (IFolder) JDTUtils.findResource(JDTUtils.toURI(uriString),
                    ResourcesPlugin.getWorkspace().getRoot()::findContainersForLocationURI);
            final IJavaElement element = JavaCore.create(resource);
            if (element instanceof IPackageFragmentRoot) {
                final IPackageFragmentRoot packageRoot = (IPackageFragmentRoot) element;
                for (final IJavaElement child : packageRoot.getChildren()) {
                    if (child instanceof IPackageFragment && ((IPackageFragment) child).isDefaultPackage()) {
                        return (IPackageFragment) child;
                    }
                }
            }
        } else {
            return JDTUtils.resolvePackage(uriString);
        }

        return null;
    }

    private static void searchInClass(List<TestItem> resultList, SearchTestItemParams params,
            IProgressMonitor monitor) throws JavaModelException {
        final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(params.getUri());
        final CompilationUnit root = (CompilationUnit) parseToAst(unit, false /* fromCache */, monitor);
        for (final IType type : unit.getAllTypes()) {
            if (type.getFullyQualifiedName().equals(params.getFullName())) {
                final ASTNode node = root.findDeclaringNode(type.getKey());
                if (!(node instanceof TypeDeclaration)) {
                    continue;
                }

                final ITypeBinding binding = ((TypeDeclaration) node).resolveBinding();
                if (binding == null) {
                    continue;
                }

                TestFrameworkUtils.findTestItemsInTypeBinding(binding, resultList, null /* parentClassItem */, monitor);
                resultList.removeIf(item -> item.getLevel() != TestLevel.METHOD ||
                        !item.getFullName().startsWith(params.getFullName() + "#"));
                for (final IType innerType : type.getTypes()) {
                    resultList.add(TestItemUtils.constructTestItem(innerType, TestLevel.CLASS));
                }
                break;
            }
        }
    }

    private static boolean isJavaElementExist(IJavaElement element) {
        return element != null && element.getResource() != null && element.getResource().exists();
    }
}
