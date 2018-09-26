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

package com.microsoft.java.test.plugin.util;

import com.google.gson.Gson;
import com.microsoft.java.test.plugin.model.SearchRequest;
import com.microsoft.java.test.plugin.model.TestItem;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.searcher.ClassSearcher;
import com.microsoft.java.test.plugin.searcher.MethodSearcher;
import com.microsoft.java.test.plugin.searcher.NestedClassSearcher;
import com.microsoft.java.test.plugin.searcher.PackageSearcher;
import com.microsoft.java.test.plugin.searcher.TestItemSearcher;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.ISourceReference;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.lsp4j.Range;

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@SuppressWarnings("restriction")
public class TestSearchUtils {
    private static final Map<TestLevel, TestItemSearcher[]> searcherMap = initializeSearcherMap();

    private static Map<TestLevel, TestItemSearcher[]> initializeSearcherMap() {
        final Map<TestLevel, TestItemSearcher[]> map = new HashMap<TestLevel, TestItemSearcher[]>();
        map.put(TestLevel.FOLDER, new TestItemSearcher[] {new PackageSearcher()});
        map.put(TestLevel.PACKAGE, new TestItemSearcher[] {new ClassSearcher() });
        map.put(TestLevel.CLASS, new TestItemSearcher[] {new NestedClassSearcher(), new MethodSearcher()});
        map.put(TestLevel.NESTED_CLASS, new TestItemSearcher[] {new NestedClassSearcher(), new MethodSearcher()});
        return map;
    }

    public static List<TestItem> searchTestEntries(List<Object> arguments, IProgressMonitor monitor) {
        if (arguments == null || arguments.size() == 0) {
            return Collections.<TestItem>emptyList();
        }
        final Gson gson = new Gson();
        final SearchRequest request = gson.fromJson((String) arguments.get(0), SearchRequest.class);
        final List<TestItem> resultList = searchTestEntries(request.getLevel(),
                request.getUri(), request.getFullName(), monitor);
        if (request.isFetchAll()) {
            for (final TestItem entry: resultList) {
                searchChildren(resultList, entry, monitor);
            }
        }
        return resultList;
    }

    private static List<TestItem> searchTestEntries(TestLevel parentType, String uriString, String fullName,
            IProgressMonitor monitor) {
        final List<TestItem> resultList = new ArrayList<>();
        final TestItemSearcher[] searchers = searcherMap.get(parentType);
        if (searchers != null) {
            for (final TestItemSearcher searcher : searchers) {
                try {
                    resultList.addAll(searcher.search(uriString, fullName, monitor));
                } catch (CoreException | URISyntaxException e) {
                    // swallow the exceptions
                    e.printStackTrace();
                }
            }
        }
        return resultList;
    }

    private static void searchChildren(List<TestItem> resultList, TestItem parent, IProgressMonitor monitor) {
        if (parent.getLevel() == TestLevel.METHOD) {
            return;
        }
        final List<TestItem> childrenList = searchTestEntries(parent.getLevel(),
                parent.getUri(), parent.getFullName(), monitor);
        parent.setChildren(childrenList);
        for (final TestItem child : childrenList) {
            searchChildren(resultList, child, monitor);
        }
    }

    public static Range getRange(ICompilationUnit typeRoot, IJavaElement element) throws JavaModelException {
        final ISourceRange range = ((ISourceReference) element).getNameRange();
        return JDTUtils.toRange(typeRoot, range.getOffset(), range.getLength());
    }

    public static TestItem constructTestItem(IJavaElement element, TestLevel level) throws JavaModelException {
        return constructTestItem(element, level, null);
    }

    public static TestItem constructTestItem(IJavaElement element, TestLevel level, TestKind kind)
            throws JavaModelException {
        return new TestItem(
                element.getElementName(),
                parseTestItemFullName(element, level),
                JDTUtils.getFileURI(element.getResource()),
                parseTestItemRange(element, level),
                level,
                kind,
                element.getJavaProject().getProject().getName()
        );

    }

    private static String parseTestItemFullName(IJavaElement element, TestLevel level) {
        switch (level) {
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

    private static Range parseTestItemRange(IJavaElement element, TestLevel level) throws JavaModelException {
        switch (level) {
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
