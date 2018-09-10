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

package com.microsoft.java.test.plugin.internal.searcher;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchMatch;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.SearchRequestor;
import org.eclipse.jdt.internal.core.ClasspathEntry;
import org.eclipse.jdt.ls.core.internal.JDTUtils;

import com.microsoft.java.test.plugin.internal.ProjectUtils;
import com.microsoft.java.test.plugin.internal.searcher.model.SearchResult;
import com.microsoft.java.test.plugin.internal.searcher.model.TestTreeNodeType;
import com.microsoft.java.test.plugin.internal.testsuit.TestSuite;

@SuppressWarnings("restriction")
public class PackageSearcher extends TestEntrySearcher {

    @Override
    protected SearchPattern resolveSearchPattern(String fullyqualifiedName) {
        return SearchPattern.createPattern("*", IJavaSearchConstants.PACKAGE, IJavaSearchConstants.DECLARATIONS, SearchPattern.R_PATTERN_MATCH);
    }

    @Override
    protected SearchRequestor resolveSeartchRequestor(List<SearchResult> entryList, String fullyqualifiedName) {
        return new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {
                final Object element = match.getElement();
                if (element instanceof IPackageFragment) {
                    final IPackageFragment packageFragment = (IPackageFragment) element;
                    if (packageFragment.getCompilationUnits().length > 0) {
                        entryList.add(parseSearchEntriesResponse(packageFragment));
                    }
                }
            }
        };
    }

    @Override
    protected IJavaSearchScope resolveSearchScope(String uri) throws JavaModelException, URISyntaxException {
        final Set<IJavaProject> projectSet = ProjectUtils.parseProjects(new URI(uri));
        final List<IJavaElement> elementList = new ArrayList<>();
        for (final IJavaProject project : projectSet) {
            final IClasspathEntry[] entries = project.getRawClasspath();
            final List<IPath> testPathList = Arrays.stream(entries)
                    .filter(entry -> entry.isTest() && entry.getEntryKind() == ClasspathEntry.CPE_SOURCE)
                    .map(entry -> entry.getPath())
                    .collect(Collectors.toList());
            if (testPathList.size() > 0) {
                elementList.addAll(testPathList.stream()
                        .map(path -> {
                            try {
                                return project.findPackageFragmentRoot(path);
                            } catch (final JavaModelException e) {
                                return null;
                            }
                        })
                        .filter(Objects::nonNull)
                        .collect(Collectors.toList()));
            }
        }
        return SearchEngine.createJavaSearchScope(elementList.toArray(new IJavaElement[elementList.size()]), IJavaSearchScope.SOURCES);
    }

    private SearchResult parseSearchEntriesResponse(IPackageFragment packageFragment) {
        final TestSuite suite = new TestSuite(
            null,
            JDTUtils.getFileURI(packageFragment.getResource()),
            packageFragment.getElementName(),
            packageFragment.getElementName(),
            null,
            null,
            packageFragment.getJavaProject().getProject().getName()
        );
        return new SearchResult(suite, packageFragment.getElementName(), TestTreeNodeType.Package);
    }
}
