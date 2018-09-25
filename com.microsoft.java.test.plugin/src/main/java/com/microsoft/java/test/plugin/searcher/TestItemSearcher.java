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
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.util.TestSearchUtils;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchParticipant;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.SearchRequestor;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.lsp4j.Range;

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;

@SuppressWarnings("restriction")
public abstract class TestItemSearcher {
    protected final SearchEngine searchEngine;
    protected SearchParticipant[] searchParticipants;
    protected int searchFor;
    protected TestLevel searchResultLevel;

    public TestItemSearcher(int searchFor, TestLevel searchResultLevel) {
        this.searchEngine = new SearchEngine();
        this.searchParticipants = new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant() };
        this.searchFor = searchFor;
        this.searchResultLevel = searchResultLevel;
    }

    public List<TestItem> search(String uri, String fullyqualifiedName, IProgressMonitor monitor)
            throws JavaModelException, CoreException, URISyntaxException {
        final List<TestItem> entryList = new ArrayList<>();
        this.searchEngine.search(this.resolveSearchPattern(fullyqualifiedName), this.searchParticipants,
                this.resolveSearchScope(uri), this.resolveSeartchRequestor(entryList, fullyqualifiedName), monitor);
        return entryList;
    }

    protected SearchPattern resolveSearchPattern(String fullyqualifiedName) {
        return SearchPattern.createPattern("*", this.searchFor, IJavaSearchConstants.DECLARATIONS,
                SearchPattern.R_PATTERN_MATCH);
    }

    protected abstract SearchRequestor resolveSeartchRequestor(List<TestItem> entryList, String fullyqualifiedName);

    protected abstract IJavaSearchScope resolveSearchScope(String uri) throws JavaModelException, URISyntaxException;

    protected TestItem parseSearchItems(IJavaElement element) throws JavaModelException {
        return parseSearchItems(element, null);
    }

    protected TestItem parseSearchItems(IJavaElement element, TestKind kind) throws JavaModelException {
        return new TestItem(
                element.getElementName(),
                parseTestItemFullName(element),
                JDTUtils.getFileURI(element.getResource()),
                parseTestItemRange(element),
                this.searchResultLevel,
                kind,
                element.getJavaProject().getProject().getName()
        );

    }

    private String parseTestItemFullName(IJavaElement element) {
        switch (this.searchResultLevel) {
            case CLASS:
            case NESTED_CLASS:
                final IType type = (IType) element;
                return type.getFullyQualifiedName();
            case METHOD:
                final IMethod method = (IMethod) element;
                return method.getDeclaringType().getFullyQualifiedName() + "#" + method.getElementName();
            default:
                return element.getElementName();
        }
    }

    private Range parseTestItemRange(IJavaElement element) throws JavaModelException {
        switch (this.searchResultLevel) {
            case CLASS:
            case NESTED_CLASS:
                final IType type = (IType) element;
                return TestSearchUtils.getRange(type.getCompilationUnit(), type);
            case METHOD:
                final IMethod method = (IMethod) element;
                return TestSearchUtils.getRange(method.getCompilationUnit(), method);
            default:
                return null;
        }
    }
}
