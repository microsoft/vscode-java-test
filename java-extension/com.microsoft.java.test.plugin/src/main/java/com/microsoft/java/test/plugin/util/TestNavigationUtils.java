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

import org.eclipse.core.resources.IFile;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.Path;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.TypeNameRequestor;
import org.eclipse.jdt.ls.core.internal.JDTUtils;

import java.util.Arrays;
import java.util.LinkedList;
import java.util.List;

/**
 * Utils for test navigation features
 */
public class TestNavigationUtils {
    /**
     * find test or test target according to the given java source file uri.
     * @param arguments arguments
     * @param monitor monitor
     * @return the search result for test navigation
     * @throws JavaModelException
     */
    public static List<TestFindResult> findTestOrTarget(List<Object> arguments, IProgressMonitor monitor)
            throws JavaModelException {
        if (arguments == null || arguments.size() < 2) {
            throw new IllegalArgumentException("Wrong arguments passed to findTestOrTarget().");
        }
        final String typeUri = (String) arguments.get(0);
        final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(typeUri);
        if (unit == null) {
            JUnitPlugin.logError("Failed to resolve compilation unit from " + typeUri);
            return null;
        }
        final boolean goToTest = (boolean) arguments.get(1);
        final String typeName = getPrimaryTypeName(unit);
        final SearchEngine searchEngine = new SearchEngine();
        final IJavaProject javaProject = unit.getJavaProject();
        final IJavaSearchScope scope = goToTest ? getSearchScopeForTest(javaProject) :
                getSearchScopeForTarget(javaProject);
        final List<TestFindResult> results = new LinkedList<>();
        searchEngine.searchAllTypeNames(
            null,
            SearchPattern.R_EXACT_MATCH,
            ("*" + typeName + "*").toCharArray(),
            SearchPattern.R_PREFIX_MATCH,
            IJavaSearchConstants.CLASS,
            scope,
            new TestNavigationNameRequestor(results, javaProject),
            IJavaSearchConstants.WAIT_UNTIL_READY_TO_SEARCH,
            monitor
        );

        return results;
    }

    private static String getPrimaryTypeName(ICompilationUnit unit) {
        final IType primaryType = unit.findPrimaryType();
        if (primaryType != null) {
            return primaryType.getElementName();
        }

        return unit.getElementName().substring(0, unit.getElementName().lastIndexOf(".java"));
    }

    private static IJavaSearchScope getSearchScopeForTarget(IJavaProject javaProject) {
        // TODO: unimplemented
        return null;
    }

    private static IJavaSearchScope getSearchScopeForTest(IJavaProject javaProject) throws JavaModelException {
        final List<IClasspathEntry> testEntries = ProjectTestUtils.getTestEntries(javaProject);
        final List<IJavaElement> javaElements = new LinkedList<>();
        for (final IClasspathEntry entry : testEntries) {
            javaElements.addAll(Arrays.asList(javaProject.findPackageFragmentRoots(entry)));
        }
        return SearchEngine.createJavaSearchScope(javaElements.toArray(new IJavaElement[0]));
    }

    static final class TestNavigationNameRequestor extends TypeNameRequestor {
        private final List<TestFindResult> results;
        private final IJavaProject javaProject;

        private TestNavigationNameRequestor(List<TestFindResult> results, IJavaProject javaProject) {
            this.results = results;
            this.javaProject = javaProject;
        }

        @Override
        public void acceptType(int modifiers, char[] packageName, char[] simpleTypeName,
                char[][] enclosingTypeNames, String path) {
            if (!path.endsWith(".java")) {
                return;
            }

            final IPath fullPath = new Path(path);
            final IFile file = javaProject.getProject().getFile(
                    fullPath.makeRelativeTo(javaProject.getProject().getFullPath()));
            if (!file.exists()) {
                return;
            }
            final String uri = file.getLocation().toFile().toURI().toString();
            final String simpleName = String.valueOf(simpleTypeName);
            String fullyQualifiedName = String.valueOf(packageName) + ".";
            for (final char[] enclosingTypeName : enclosingTypeNames) {
                fullyQualifiedName += String.valueOf(enclosingTypeName) + "$";
            }
            fullyQualifiedName += simpleName;
            results.add(new TestFindResult(simpleName, fullyQualifiedName, uri));
        }
    }

    static final class TestFindResult {
        public String simpleName;
        public String fullyQualifiedName;
        public String uri;

        public TestFindResult(String simpleName, String fullyQualifiedName, String uri) {
            this.simpleName = simpleName;
            this.fullyQualifiedName = fullyQualifiedName;
            this.uri = uri;
        }
    }
}
