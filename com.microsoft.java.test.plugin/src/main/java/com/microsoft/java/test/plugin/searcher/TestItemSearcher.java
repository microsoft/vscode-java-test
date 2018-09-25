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
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchParticipant;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.SearchRequestor;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;

public abstract class TestItemSearcher {
    protected final SearchEngine searchEngine;
    protected SearchParticipant[] searchParticipants;
    protected int searchFor;

    public TestItemSearcher(int searchFor) {
        this.searchEngine = new SearchEngine();
        this.searchParticipants = new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant() };
        this.searchFor = searchFor;
    }

    public List<TestItem> search(String scopeUri, String fullyqualifiedName, IProgressMonitor monitor)
            throws JavaModelException, CoreException, URISyntaxException {
        final List<TestItem> entryList = new ArrayList<>();
        this.searchEngine.search(this.resolveSearchPattern(fullyqualifiedName), this.searchParticipants,
                this.resolveSearchScope(scopeUri), this.resolveSearchRequestor(entryList, fullyqualifiedName), monitor);
        return entryList;
    }

    protected SearchPattern resolveSearchPattern(String fullyqualifiedName) {
        return SearchPattern.createPattern("*", this.searchFor, IJavaSearchConstants.DECLARATIONS,
                SearchPattern.R_PATTERN_MATCH);
    }

    protected abstract SearchRequestor resolveSearchRequestor(List<TestItem> itemList, String fullyqualifiedName);

    protected abstract IJavaSearchScope resolveSearchScope(String uri) throws JavaModelException, URISyntaxException;
}
