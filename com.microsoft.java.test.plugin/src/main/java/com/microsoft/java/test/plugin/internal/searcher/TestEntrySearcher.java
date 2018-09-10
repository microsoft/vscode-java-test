package com.microsoft.java.test.plugin.internal.searcher;

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchParticipant;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.SearchRequestor;

import com.microsoft.java.test.plugin.internal.searcher.model.SearchResult;

public abstract class TestEntrySearcher {
    protected final SearchEngine searchEngine;
    protected SearchParticipant[] searchParticipants;

    public TestEntrySearcher() {
        this.searchEngine = new SearchEngine();
        this.searchParticipants = new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant() };
    }

    public List<SearchResult> search(String uri, String fullyqualifiedName, IProgressMonitor monitor) throws JavaModelException, CoreException, URISyntaxException {
        final List<SearchResult> entryList = new ArrayList<>();
        this.searchEngine.search(
                this.resolveSearchPattern(fullyqualifiedName),
                this.searchParticipants,
                this.resolveSearchScope(uri),
                this.resolveSeartchRequestor(entryList, fullyqualifiedName),
                monitor
        );
        return entryList;
    }

    abstract protected SearchPattern resolveSearchPattern(String fullyqualifiedName);

    abstract protected SearchRequestor resolveSeartchRequestor(List<SearchResult> entryList, String fullyqualifiedName);

    abstract protected IJavaSearchScope resolveSearchScope(String uri) throws JavaModelException, URISyntaxException;
}
