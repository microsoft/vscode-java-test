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
import org.eclipse.jdt.ls.core.internal.JDTUtils.LocationType;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.lsp4j.Location;

import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Utils for test navigation features
 */
public class TestNavigationUtils {
    /**
     * find test or test subject according to the given java source file uri.
     * @param arguments arguments
     * @param monitor monitor
     * @return the search result for test navigation
     * @throws JavaModelException
     */
    public static TestNavigationResult findTestOrTarget(List<Object> arguments, IProgressMonitor monitor)
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
        final IType primaryType = unit.findPrimaryType();
        final String typeName;
        Location location = null;
        if (primaryType != null) {
            typeName = primaryType.getElementName();
            location = JDTUtils.toLocation(primaryType, LocationType.NAME_RANGE);
        } else {
            typeName = unit.getElementName().substring(0, unit.getElementName().lastIndexOf(".java"));
        }
        final SearchEngine searchEngine = new SearchEngine();
        final boolean goToTest = (boolean) arguments.get(1);
        final String nameToSearch = goToTest ? typeName : guessTestSubjectName(typeName);
        final IJavaSearchScope scope = getSearchScope(goToTest);
        final IJavaProject javaProject = unit.getJavaProject();
        final Set<TestNavigationItem> items = new HashSet<>();
        searchEngine.searchAllTypeNames(
            null,
            SearchPattern.R_EXACT_MATCH,
            ("*" + nameToSearch + "*").toCharArray(),
            SearchPattern.R_PATTERN_MATCH,
            IJavaSearchConstants.CLASS,
            scope,
            new TestNavigationNameRequestor(items, javaProject, nameToSearch, typeName, goToTest),
            IJavaSearchConstants.WAIT_UNTIL_READY_TO_SEARCH,
            monitor
        );

        return new TestNavigationResult(items, location);
    }

    /**
     * Return the search scope that contains all source package fragment roots.
     * @param isTest Whether containing test source or not
     * @throws JavaModelException
     */
    private static IJavaSearchScope getSearchScope(boolean isTest) throws JavaModelException {
        final List<IJavaElement> javaElements = new LinkedList<>();
        final IJavaProject[] javaProjects = ProjectUtils.getJavaProjects();
        for (final IJavaProject project : javaProjects) {
            final List<IClasspathEntry> testEntries = isTest ? ProjectTestUtils.getTestEntries(project) :
                    ProjectTestUtils.getSourceEntries(project);
            for (final IClasspathEntry entry : testEntries) {
                javaElements.addAll(Arrays.asList(project.findPackageFragmentRoots(entry)));
            }
        }

        return SearchEngine.createJavaSearchScope(
            !isTest /*excludeTestCode*/,
            javaElements.toArray(new IJavaElement[0]),
            true /*includeReferencedProjects*/
        );
    }

    /**
     * Remove all the "Test" and "Tests" (case sensitive) in the input string.
     */
    private static String guessTestSubjectName(String testTypeName) {
        return testTypeName.replaceAll("Tests?", "");
    }

    static final class TestNavigationNameRequestor extends TypeNameRequestor {
        private final Set<TestNavigationItem> results;
        private final IJavaProject javaProject;
        private final String typeNameToSearch;
        private final String from;
        private final boolean isTest;

        private TestNavigationNameRequestor(Set<TestNavigationItem> results, IJavaProject javaProject,
                String typeNameToSearch, String from, boolean isTest) {
            this.results = results;
            this.javaProject = javaProject;
            this.typeNameToSearch = typeNameToSearch;
            this.from = from;
            this.isTest = isTest;
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
            final String simpleName;
            if (enclosingTypeNames.length == 0) {
                simpleName = String.valueOf(simpleTypeName);
            } else {
                // All the nested classes are ignored.
                simpleName = String.valueOf(enclosingTypeNames[0]);
            }
            // for invisible project and Eclipse project, all the package root are both test and source,
            // so the search result might be itself.
            if (Objects.equals(simpleName, from)) {
                return;
            }

            if (!isTest && (simpleName.endsWith("Test") || simpleName.endsWith("Tests"))) {
                return;
            }
            final String fullyQualifiedName = String.valueOf(packageName) + "." + simpleName;
            final int relevance = calculateRelevance(simpleName);
            final boolean outOfBelongingProject = !Objects.equals(this.javaProject.getElementName(),
                    fullPath.segment(0));
            results.add(new TestNavigationItem(simpleName, fullyQualifiedName, uri, relevance, outOfBelongingProject));
        }

        // todo: better relevance calculation
        private int calculateRelevance(String simpleName) {
            if (isTest && (Objects.equals(simpleName, this.typeNameToSearch + "Test") ||
                    Objects.equals(simpleName, this.typeNameToSearch + "Tests"))) {
                return Integer.MIN_VALUE;
            } else {
                int relevance = simpleName.indexOf(this.typeNameToSearch);
                if (relevance < 0) {
                    relevance = Integer.MAX_VALUE;
                }
                return relevance;
            }
        }
    }

    static final class TestNavigationResult {
        public Collection<TestNavigationItem> items;
        public Location location;

        public TestNavigationResult(Collection<TestNavigationItem> items, Location location) {
            this.items = items;
            this.location = location;
        }
    }

    static final class TestNavigationItem {
        public String simpleName;
        public String fullyQualifiedName;
        public String uri;
        public int relevance;
        public boolean outOfBelongingProject;

        public TestNavigationItem(String simpleName, String fullyQualifiedName, String uri,
                int relevance, boolean outOfBelongingProject) {
            this.simpleName = simpleName;
            this.fullyQualifiedName = fullyQualifiedName;
            this.uri = uri;
            this.relevance = relevance;
            this.outOfBelongingProject = outOfBelongingProject;
        }

        @Override
        public int hashCode() {
            final int prime = 31;
            int result = 1;
            result = prime * result + ((uri == null) ? 0 : uri.hashCode());
            return result;
        }

        @Override
        public boolean equals(Object obj) {
            if (this == obj) {
                return true;
            }
            if (obj == null) {
                return false;
            }
            if (getClass() != obj.getClass()) {
                return false;
            }
            final TestNavigationItem other = (TestNavigationItem) obj;
            if (uri == null) {
                if (other.uri != null) {
                    return false;
                }
            } else if (!uri.equals(other.uri)) {
                return false;
            }
            return true;
        }
    }
}
