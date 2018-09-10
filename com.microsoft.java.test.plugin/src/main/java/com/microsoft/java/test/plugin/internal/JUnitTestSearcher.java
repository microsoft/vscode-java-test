/*******************************************************************************
 * Copyright (c) 2017 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/
package com.microsoft.java.test.plugin.internal;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMember;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.ISourceReference;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchMatch;
import org.eclipse.jdt.core.search.SearchParticipant;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.SearchRequestor;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.ResourceUtils;
import org.eclipse.lsp4j.Range;

import com.microsoft.java.test.plugin.internal.testsuit.TestKind;
import com.microsoft.java.test.plugin.internal.testsuit.TestLevel;
import com.microsoft.java.test.plugin.internal.testsuit.TestSuite;

public abstract class JUnitTestSearcher {


    public abstract SearchPattern getSearchPattern();

    public abstract TestKind getTestKind();

    public abstract String getTestMethodAnnotation();

    public void searchAllTests(List<TestSuite> tests, IProgressMonitor monitor) {
        final SearchPattern pattern = this.getSearchPattern();
        final HashSet<IType> testClasses = new HashSet<>();

        final SearchRequestor requestor = new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {

                final Object element = match.getElement();
                if (element instanceof IType || element instanceof IMethod) {
                    final IMember member = (IMember) element;
                    final IType type = member.getElementType() == IJavaElement.TYPE ? (IType) member
                            : member.getDeclaringType();
                    testClasses.add(type);
                }
            }
        };

        try {
            final IJavaSearchScope scope = createSearchScope();
            new SearchEngine().search(pattern, new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant() },
                    scope, requestor, monitor);
            for (final IType type : testClasses) {
                if (JUnitUtility.isAccessibleClass(type) && !Flags.isAbstract(type.getFlags())) {
                    final TestSuite parent = getTestSuite(type);
                    tests.add(parent);
                    final int parentIndex = tests.size() - 1;
                    int childIndex = parentIndex + 1;
                    final List<Integer> children = new ArrayList<>();
                    for (final IMethod m : type.getMethods()) {
                        if (JUnitUtility.isTestMethod(m, getTestMethodAnnotation())) {
                            final TestSuite child = getTestSuite(m);
                            child.setParent(parentIndex);
                            tests.add(child);
                            children.add(childIndex);
                            childIndex++;
                        }
                    }
                    parent.setChildren(children);
                }
            }
        } catch (final CoreException e) {
            // ignore
        }
    }

    public List<TestSuite> searchTestChildren(IType type, IProgressMonitor monitor) throws CoreException, URISyntaxException {
        final List<TestSuite> testSuiteList = new ArrayList<>();

        final SearchRequestor requestor = new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {
                final Object element = match.getElement();
                if (element instanceof IMethod) {
                    final IMethod m = (IMethod) element;
                    if (JUnitUtility.isTestMethod(m, getTestMethodAnnotation())) {
                        final TestSuite child = getTestSuite(m);
                        testSuiteList.add(child);
                    }
                }
            }
        };

        final IJavaSearchScope scope = SearchEngine.createJavaSearchScope(new IJavaElement[] {type}, IJavaSearchScope.SOURCES);
        final SearchPattern searchPattern = SearchPattern.createPattern("*", IJavaSearchConstants.METHOD, IJavaSearchConstants.DECLARATIONS, SearchPattern.R_PATTERN_MATCH);
        new SearchEngine().search(searchPattern, new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant() },
                scope, requestor, monitor);

        return testSuiteList;
    }

    private static IJavaSearchScope createSearchScope() throws JavaModelException {
        final IJavaProject[] projects = JavaCore.create(ResourcesPlugin.getWorkspace().getRoot()).getJavaProjects();
        return SearchEngine.createJavaSearchScope(projects, IJavaSearchScope.SOURCES);
    }

    private static IJavaSearchScope createSearchScope(URI folderUri) throws JavaModelException {
        final String uriQuery = folderUri.getQuery();
        final IJavaElement element = JavaCore.create(uriQuery);
        return SearchEngine.createJavaSearchScope(new IJavaElement[] {element}, IJavaSearchScope.SOURCES);
    }

    //    private static IJavaSearchScope createHierarchyScope(String uri) throws JavaModelException, URISyntaxException {
    //        final IPackageFragment packageFragment = JDTUtils.resolvePackage(uri);
    //        if (packageFragment == null || !packageFragment.getResource().exists()) {
    //            return createSearchScope(new URI(uri));
    //        }
    //        final IJavaElement[] elements = packageFragment.getChildren();
    //        final List<IJavaElement> types = Arrays.stream(elements)
    //                .filter(e -> e.getElementType() == IJavaElement.TYPE && parent.getTest().endsWith(e.getElementName()))
    //                .collect(Collectors.toList());
    //        if (types.size() == 0) {
    //            return createSearchScope(new URI(uri));
    //        }
    //        return SearchEngine.createHierarchyScope((IType)types.get(0));
    //    }

    private TestSuite getTestSuite(IMember member) throws JavaModelException {
        final ICompilationUnit unit = member.getCompilationUnit();
        final String uri = ResourceUtils.toClientUri(JDTUtils.toUri(unit));
        final String project = unit.getJavaProject().getProject().getName();
        if (member.getElementType() == IJavaElement.TYPE) {
            final IType type = (IType) member;
            return new TestSuite(getRange(unit, member), uri, type.getFullyQualifiedName(),
                    type.getPackageFragment().getElementName(), TestLevel.Class, this.getTestKind(), project);
        } else {
            final IType type = ((IMethod) member).getDeclaringType();
            return new TestSuite(getRange(unit, member), uri,
                    type.getFullyQualifiedName() + "#" + member.getElementName(),
                    type.getPackageFragment().getElementName(), TestLevel.Method, this.getTestKind(), project);
        }
    }

    private Range getRange(ICompilationUnit typeRoot, IJavaElement element) throws JavaModelException {
        final ISourceRange r = ((ISourceReference) element).getNameRange();
        return JDTUtils.toRange(typeRoot, r.getOffset(), r.getLength());
    }
}
