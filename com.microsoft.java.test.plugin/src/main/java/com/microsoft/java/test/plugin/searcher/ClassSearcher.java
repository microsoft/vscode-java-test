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

import org.eclipse.core.runtime.CoreException;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchMatch;
import org.eclipse.jdt.core.search.SearchRequestor;
import org.eclipse.jdt.ls.core.internal.JDTUtils;

import java.net.URISyntaxException;
import java.util.List;

@SuppressWarnings("restriction")
public class ClassSearcher extends TestItemSearcher {

    public ClassSearcher() {
        super(IJavaSearchConstants.CLASS, TestLevel.Class);
    }

    @Override
    protected SearchRequestor resolveSeartchRequestor(List<TestItem> entryList, String fullyqualifiedName) {
        return new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {
                final Object element = match.getElement();
                if (element instanceof IType) {
                    final IType type = (IType) element;
                    if (type.getParent() instanceof ICompilationUnit) {
                        entryList.add(parseSearchItems(type));
                    }
                }
            }
        };
    }

    @Override
    protected IJavaSearchScope resolveSearchScope(String uri) throws JavaModelException, URISyntaxException {
        final IPackageFragment packageFragment = JDTUtils.resolvePackage(uri);
        final IJavaElement[] elements = packageFragment.getChildren();
        return SearchEngine.createJavaSearchScope(elements, IJavaSearchScope.SOURCES);
    }
}
