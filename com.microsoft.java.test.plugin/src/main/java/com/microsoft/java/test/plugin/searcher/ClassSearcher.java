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
import com.microsoft.java.test.plugin.util.TestSearchUtils;

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
        super(IJavaSearchConstants.CLASS);
    }

    @Override
    protected SearchRequestor resolveSearchRequestor(List<TestItem> itemList, String fullyQualifiedName) {
        return new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {
                final Object element = match.getElement();
                if (isTopLevelClass(element)) {
                    itemList.add(TestSearchUtils.constructTestItem((IType) element, TestLevel.CLASS));
                }
            }
        };
    }

    @Override
    protected IJavaSearchScope resolveSearchScope(String packageUri) throws JavaModelException, URISyntaxException {
        final IPackageFragment packageFragment = JDTUtils.resolvePackage(packageUri);
        final IJavaElement[] elements = packageFragment.getChildren();
        return SearchEngine.createJavaSearchScope(elements, IJavaSearchScope.SOURCES);
    }

    private boolean isTopLevelClass(Object element) {
        if (element instanceof IType) {
            final IType type = (IType) element;
            if (type.getParent() instanceof ICompilationUnit) {
                return true;
            }
        }
        return false;
    }
}
