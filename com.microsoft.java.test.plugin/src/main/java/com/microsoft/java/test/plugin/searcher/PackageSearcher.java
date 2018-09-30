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

package com.microsoft.java.test.plugin.searcher;

import com.microsoft.java.test.plugin.model.TestItem;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.util.ProjectUtils;
import com.microsoft.java.test.plugin.util.TestSearchUtils;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchMatch;
import org.eclipse.jdt.core.search.SearchRequestor;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@SuppressWarnings("restriction")
public class PackageSearcher extends TestItemSearcher {

    public PackageSearcher() {
        super(IJavaSearchConstants.PACKAGE);
    }

    @Override
    protected SearchRequestor resolveSearchRequestor(List<TestItem> itemList, String fullyQualifiedName) {
        return new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {
                final Object element = match.getElement();
                if (element instanceof IPackageFragment) {
                    final IPackageFragment packageFragment = (IPackageFragment) element;
                    if (packageFragment.getCompilationUnits().length > 0) {
                        itemList.add(TestSearchUtils.constructTestItem(packageFragment, TestLevel.PACKAGE));
                    }
                }
            }
        };
    }

    @Override
    protected IJavaSearchScope resolveSearchScope(String workspaceFolderUri)
            throws JavaModelException, URISyntaxException {
        final Set<IJavaProject> projectSet = ProjectUtils.parseProjects(new URI(workspaceFolderUri));
        final List<IJavaElement> elementList = new ArrayList<>();
        for (final IJavaProject project : projectSet) {
            elementList.addAll(ProjectUtils.getPackageFragmentRootForTest(project));
        }
        return SearchEngine.createJavaSearchScope(elementList.toArray(new IJavaElement[elementList.size()]),
                IJavaSearchScope.SOURCES);
    }
}
