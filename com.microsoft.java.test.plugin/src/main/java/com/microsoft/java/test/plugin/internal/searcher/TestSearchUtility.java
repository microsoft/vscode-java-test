package com.microsoft.java.test.plugin.internal.searcher;

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.ISourceReference;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.lsp4j.Range;

import com.microsoft.java.test.plugin.internal.searcher.model.SearchEntriesRequest;
import com.microsoft.java.test.plugin.internal.searcher.model.SearchResult;
import com.microsoft.java.test.plugin.internal.searcher.model.TestTreeNodeType;

@SuppressWarnings("restriction")
public class TestSearchUtility {
    private static final Map<TestTreeNodeType, TestEntrySearcher[]> searcherMap = initializeSearcherMap();

    private static Map<TestTreeNodeType, TestEntrySearcher[]> initializeSearcherMap() {
        final Map<TestTreeNodeType, TestEntrySearcher[]> map = new HashMap<TestTreeNodeType, TestEntrySearcher[]>();
        map.put(TestTreeNodeType.Folder, new TestEntrySearcher[] {new PackageSearcher()});
        map.put(TestTreeNodeType.Package, new TestEntrySearcher[] {new ClassSearcherInPackage() });
        map.put(TestTreeNodeType.Class, new TestEntrySearcher[] {new ClassSearcherInClass(), new MethodSearcher()});
        return map;
    }

    public static List<SearchResult> searchTestEntries(SearchEntriesRequest request, IProgressMonitor monitor) throws JavaModelException, CoreException, URISyntaxException {
        final List<SearchResult> response = new ArrayList<>();
        final TestEntrySearcher[] searchers = searcherMap.get(request.getType());
        if (searchers != null ) {
            for (final TestEntrySearcher searcher : searcherMap.get(request.getType())) {
                if (monitor.isCanceled()) {
                    return Collections.<SearchResult>emptyList();
                }
                response.addAll(searcher.search(request.getUri(), request.getFullName(), monitor));
            }
        }
        return response;
    }

    public static Range getRange(ICompilationUnit typeRoot, IJavaElement element) throws JavaModelException {
        final ISourceRange range = ((ISourceReference) element).getNameRange();
        return JDTUtils.toRange(typeRoot, range.getOffset(), range.getLength());
    }
}
