package com.microsoft.java.test.plugin.internal.searcher;

import java.net.URISyntaxException;
import java.util.List;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchMatch;
import org.eclipse.jdt.core.search.SearchRequestor;
import org.eclipse.jdt.ls.core.internal.JDTUtils;

import com.microsoft.java.test.plugin.internal.searcher.model.SearchResult;

@SuppressWarnings("restriction")
public class ClassSearcherInPackage extends ClassSearcher {

    @Override
    protected SearchRequestor resolveSeartchRequestor(List<SearchResult> entryList, String fullyqualifiedName) {
        return new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {
                final Object element = match.getElement();
                if (element instanceof IType) {
                    final IType type = (IType) element;
                    if (type.getParent() instanceof ICompilationUnit) {
                        entryList.add(parseSearchEntriesResponse(type));
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
