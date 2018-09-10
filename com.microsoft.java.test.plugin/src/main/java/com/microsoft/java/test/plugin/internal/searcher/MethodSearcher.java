package com.microsoft.java.test.plugin.internal.searcher;

import java.net.URISyntaxException;
import java.util.List;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchMatch;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.SearchRequestor;
import org.eclipse.jdt.ls.core.internal.JDTUtils;

import com.microsoft.java.test.plugin.internal.JUnit4TestSearcher;
import com.microsoft.java.test.plugin.internal.JUnit5TestSearcher;
import com.microsoft.java.test.plugin.internal.JUnitTestSearcher;
import com.microsoft.java.test.plugin.internal.JUnitUtility;
import com.microsoft.java.test.plugin.internal.searcher.model.SearchResult;
import com.microsoft.java.test.plugin.internal.searcher.model.TestTreeNodeType;
import com.microsoft.java.test.plugin.internal.testsuit.TestKind;
import com.microsoft.java.test.plugin.internal.testsuit.TestLevel;
import com.microsoft.java.test.plugin.internal.testsuit.TestSuite;

@SuppressWarnings("restriction")
public class MethodSearcher extends TestEntrySearcher {

    private static final JUnitTestSearcher[] SEARCHERS = new JUnitTestSearcher[] {
            new JUnit4TestSearcher(),
            new JUnit5TestSearcher(),
    };

    @Override
    protected SearchPattern resolveSearchPattern(String fullyqualifiedName) {
        return SearchPattern.createPattern(fullyqualifiedName + ".*", IJavaSearchConstants.METHOD, IJavaSearchConstants.DECLARATIONS, SearchPattern.R_PATTERN_MATCH);
    }

    @Override
    protected SearchRequestor resolveSeartchRequestor(List<SearchResult> entryList, String fullyqualifiedName) {
        return new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {
                final Object element = match.getElement();
                if (element instanceof IMethod) {
                    final IMethod method = (IMethod) element;
                    for (final JUnitTestSearcher searcher : SEARCHERS) {
                        if (JUnitUtility.isTestMethod(method, searcher.getTestMethodAnnotation())) {
                            final SearchResult child = parseSearchEntriesResponse(method, searcher.getTestKind());
                            entryList.add(child);
                            break;
                        }
                    }
                }
            }
        };
    }

    @Override
    protected IJavaSearchScope resolveSearchScope(String uri) throws JavaModelException, URISyntaxException {
        final ICompilationUnit compilationUnit = JDTUtils.resolveCompilationUnit(uri);
        return SearchEngine.createJavaSearchScope(new IJavaElement[] {compilationUnit}, IJavaSearchScope.SOURCES);
    }

    private SearchResult parseSearchEntriesResponse(IMethod method, TestKind kind) throws JavaModelException {
        final ICompilationUnit unit = method.getCompilationUnit();
        final String uri = JDTUtils.getFileURI(unit.getResource());
        final String project = unit.getJavaProject().getProject().getName();
        final IType type = method.getDeclaringType();
        final TestSuite suite = new TestSuite(
                TestSearchUtility.getRange(unit, method),
                uri,
                type.getFullyQualifiedName() + "#" + method.getElementName(),
                type.getPackageFragment().getElementName(),
                TestLevel.Method,
                kind,
                project
        );
        return new SearchResult(suite, method.getElementName(), TestTreeNodeType.Method);
    }
}
