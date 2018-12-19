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
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;

import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.OperationCanceledException;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchMatch;
import org.eclipse.jdt.core.search.SearchParticipant;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.SearchRequestor;
import org.eclipse.jdt.ls.core.internal.JDTUtils;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@SuppressWarnings("restriction")
public class TestExplorerUtils {

    public static List<TestItem> searchTestItems(List<Object> arguments, IProgressMonitor monitor)
            throws OperationCanceledException, InterruptedException, URISyntaxException, JavaModelException {
        final List<TestItem> resultList = new ArrayList<>();

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
                searchInClass(resultList, params);
                break;
            case NESTED_CLASS:
                searchInNestedClass(resultList, params);
                break;
            default:
                break;
        }

        return resultList;
    }

    public static List<TestItem> searchAllTestItems(List<Object> arguments, IProgressMonitor monitor)
            throws CoreException, OperationCanceledException, InterruptedException {
        final List<TestItem> searchResult = new ArrayList<>();

        if (arguments == null || arguments.size() == 0) {
            return searchResult;
        }

        final Gson gson = new Gson();
        final SearchTestItemParams params = gson.fromJson((String) arguments.get(0), SearchTestItemParams.class);

        final IJavaSearchScope scope = createSearchScope(params);

        SearchPattern pattern = TestSearchUtils.frameworkSearchers[0].getSearchPattern();
        for (int i = 1; i < TestSearchUtils.frameworkSearchers.length; i++) {
            pattern = SearchPattern.createOrPattern(pattern, TestSearchUtils.frameworkSearchers[i].getSearchPattern());
        }

        final Map<String, TestItem> classMap = new HashMap<>();
        final SearchRequestor requestor = new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {
                final Object element = match.getElement();
                if (element instanceof IMethod) {
                    final IMethod method = (IMethod) element;
                    // Fix bug https://github.com/Microsoft/vscode-java-test/issues/441
                    // - The SearchEngine doesn't honer method level search scope.
                    if (params.getLevel() == TestLevel.METHOD && !scope.encloses(method)) {
                        return;
                    }
                    final TestItem methodItem = TestSearchUtils.constructTestItem(method, TestLevel.METHOD,
                            TestSearchUtils.resolveTestKindForMethod(method));
                    final IType type = (IType) method.getParent();
                    final TestItem classItem = classMap.get(type.getFullyQualifiedName());
                    if (classItem != null) {
                        classItem.addChild(methodItem);
                    } else {
                        final TestItem newClassItem = TestSearchUtils.constructTestItem(type,
                                TestSearchUtils.getTestLevelForIType(type));
                        newClassItem.addChild(methodItem);
                        classMap.put(type.getFullyQualifiedName(), newClassItem);
                    }
                }
            }

        };

        new SearchEngine().search(pattern, new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant() },
                scope, requestor, monitor);

        for (final TestItem testClass : classMap.values()) {
            if (testClass.getChildren() == null || testClass.getChildren().size() <= 0) {
                continue;
            } else if (testClass.getChildren().size() == 1) {
                searchResult.add(testClass.getChildren().get(0));
            } else {
                // Assume the kinds of all methods are the same.
                testClass.setKind(testClass.getChildren().get(0).getKind());
                searchResult.add(testClass);
            }
        }
        return searchResult;
    }

    private static IJavaSearchScope createSearchScope(SearchTestItemParams params) throws JavaModelException {
        switch (params.getLevel()) {
            case ROOT:
                final IJavaProject[] projects = JavaCore.create(ResourcesPlugin.getWorkspace().getRoot())
                        .getJavaProjects();
                return SearchEngine.createJavaSearchScope(projects, IJavaSearchScope.SOURCES);
            case FOLDER:
                final IJavaElement project = JavaCore.create(JDTUtils.findFolder(params.getUri()));
                return SearchEngine.createJavaSearchScope(new IJavaElement[] { project }, IJavaSearchScope.SOURCES);
            case PACKAGE:
                final IJavaElement packageElement = JDTUtils.resolvePackage(params.getUri());
                return SearchEngine.createJavaSearchScope(new IJavaElement[] { packageElement },
                        IJavaSearchScope.SOURCES);
            case CLASS:
            case NESTED_CLASS:
                final ICompilationUnit compilationUnit = JDTUtils.resolveCompilationUnit(params.getUri());
                final IType[] types = compilationUnit.getAllTypes();
                for (final IType type : types) {
                    if (type.getFullyQualifiedName().equals(params.getFullName())) {
                        return SearchEngine.createJavaSearchScope(new IJavaElement[] { type },
                                IJavaSearchScope.SOURCES);
                    }
                }
                break;
            case METHOD:
                final String fullName = params.getFullName();
                final String className = fullName.substring(0, fullName.lastIndexOf("#"));
                final String methodName =  fullName.substring(fullName.lastIndexOf("#") + 1);
                final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(params.getUri());
                final IType[] allTypes = unit.getAllTypes();
                for (final IType type : allTypes) {
                    if (type.getFullyQualifiedName().equals(className)) {
                        for (final IMethod method : type.getMethods()) {
                            if (method.getElementName().equals(methodName)) {
                                return SearchEngine.createJavaSearchScope(new IJavaElement[] { method },
                                        IJavaSearchScope.SOURCES);
                            }
                        }
                    }
                }
        }

        throw new RuntimeException("Cannot resolve the search scope for " + params.getFullName());
    }

    private static void searchInFolder(List<TestItem> resultList, SearchTestItemParams params)
            throws URISyntaxException, JavaModelException {
        final Set<IJavaProject> projectSet = ProjectUtils.parseProjects(new URI(params.getUri()));
        for (final IJavaProject project : projectSet) {
            for (final IPackageFragment packageFragment : project.getPackageFragments()) {
                if (TestSearchUtils.isInTestScope(packageFragment) &&
                        packageFragment.getCompilationUnits().length > 0) {
                    resultList.add(TestSearchUtils.constructTestItem(packageFragment, TestLevel.PACKAGE));
                }
            }
        }
    }

    private static void searchInPackage(List<TestItem> resultList, SearchTestItemParams params)
            throws JavaModelException {
        final IPackageFragment packageFragment = JDTUtils.resolvePackage(params.getUri());
        for (final ICompilationUnit unit : packageFragment.getCompilationUnits()) {
            for (final IType type : unit.getTypes()) {
                resultList.add(TestSearchUtils.constructTestItem(type, TestLevel.CLASS));
            }
        }
    }

    private static void searchInClass(List<TestItem> resultList, SearchTestItemParams params)
            throws JavaModelException {
        final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(params.getUri());
        for (final IType type : unit.getTypes()) {
            if (type.getFullyQualifiedName().equals(params.getFullName())) {
                for (final IType innerType : type.getTypes()) {
                    resultList.add(TestSearchUtils.constructTestItem(innerType, TestLevel.NESTED_CLASS));
                }
                for (final IMethod method : type.getMethods()) {
                    final TestKind kind = TestSearchUtils.resolveTestKindForMethod(method);
                    if (kind != null) {
                        resultList.add(TestSearchUtils.constructTestItem(method, TestLevel.METHOD, kind));
                    }
                }
            }
        }
    }

    private static void searchInNestedClass(List<TestItem> resultList, SearchTestItemParams params)
            throws JavaModelException {
        final ICompilationUnit compilationUnit = JDTUtils.resolveCompilationUnit(params.getUri());
        for (final IType type : compilationUnit.getAllTypes()) {
            if (type.getFullyQualifiedName().equals(params.getFullName())) {
                for (final IMethod method : type.getMethods()) {
                    final TestKind kind = TestSearchUtils.resolveTestKindForMethod(method);
                    if (kind != null) {
                        resultList.add(TestSearchUtils.constructTestItem(method, TestLevel.METHOD, kind));
                    }
                }
            }
        }
    }
}
