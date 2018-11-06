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
import com.microsoft.java.test.plugin.model.SearchTestItemParams;
import com.microsoft.java.test.plugin.model.TestItem;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.searcher.ClassSearcher;
import com.microsoft.java.test.plugin.searcher.JUnit4TestSearcher;
import com.microsoft.java.test.plugin.searcher.JUnit5TestSearcher;
import com.microsoft.java.test.plugin.searcher.MethodSearcher;
import com.microsoft.java.test.plugin.searcher.NestedClassSearcher;
import com.microsoft.java.test.plugin.searcher.PackageSearcher;
import com.microsoft.java.test.plugin.searcher.TestFrameworkSearcher;
import com.microsoft.java.test.plugin.searcher.TestItemSearcher;
import com.microsoft.java.test.plugin.searcher.TestNGTestSearcher;

import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.core.runtime.OperationCanceledException;
import org.eclipse.core.runtime.jobs.Job;
import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.IAnnotation;
import org.eclipse.jdt.core.IClassFile;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.ISourceReference;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.handlers.DocumentLifeCycleHandler;
import org.eclipse.lsp4j.Range;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@SuppressWarnings("restriction")
public class TestSearchUtils {
    private static final Map<TestLevel, TestItemSearcher[]> searcherMap;
    private static final TestFrameworkSearcher[] frameworkSearchers = new TestFrameworkSearcher[] {
        new JUnit4TestSearcher(),
        new JUnit5TestSearcher(),
        new TestNGTestSearcher()
    };

    static {
        searcherMap = new HashMap<TestLevel, TestItemSearcher[]>();
        searcherMap.put(TestLevel.FOLDER, new TestItemSearcher[] {new PackageSearcher()});
        searcherMap.put(TestLevel.PACKAGE, new TestItemSearcher[] {new ClassSearcher()});
        searcherMap.put(TestLevel.CLASS, new TestItemSearcher[] {new NestedClassSearcher(), new MethodSearcher()});
        searcherMap.put(TestLevel.NESTED_CLASS, new TestItemSearcher[] {
            new NestedClassSearcher(), new MethodSearcher()
        });
    }

    public static List<TestItem> searchTestItems(List<Object> arguments, IProgressMonitor monitor) {
        if (arguments == null || arguments.size() == 0) {
            return Collections.<TestItem>emptyList();
        }
        final Gson gson = new Gson();
        final SearchTestItemParams params = gson.fromJson((String) arguments.get(0),
                SearchTestItemParams.class);
        final List<TestItem> resultList = new ArrayList<>();
        final TestItemSearcher[] searchers = searcherMap.get(params.getLevel());
        if (searchers != null) {
            for (final TestItemSearcher searcher : searchers) {
                try {
                    resultList.addAll(searcher.search(params.getUri(), params.getFullName(), monitor));
                } catch (final Exception e) {
                    // swallow the exceptions
                    e.printStackTrace();
                }
            }
        }
        return resultList;
    }

    public static List<TestItem> searchCodeLens(List<Object> arguments, IProgressMonitor monitor)
            throws OperationCanceledException, InterruptedException, JavaModelException {
        final List<TestItem> resultList = new ArrayList<>();
        if (arguments == null || arguments.size() == 0) {
            return resultList;
        }

        final String uri = (String) arguments.get(0);
        final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(uri);
        if (!isJavaElementExist(unit) || !isInTestScope(unit) || monitor.isCanceled()) {
            return resultList;
        }

        // wait for the LS finishing to update the compilation unit
        Job.getJobManager().join(DocumentLifeCycleHandler.DOCUMENT_LIFE_CYCLE_JOBS, new NullProgressMonitor());
        final IType[] childrenTypes = unit.getAllTypes();
        for (final IType type : childrenTypes) {
            if (!isTestableClass(type)) {
                continue;
            }
            final List<TestItem> testMethodList = Arrays.stream(type.getMethods()).map(m -> {
                try {
                    final TestKind kind = resolveTestKindForMethod(m);
                    if (kind != null) {
                        return constructTestItem(m, TestLevel.METHOD, kind);
                    }
                    return null;
                } catch (final JavaModelException e) {
                    return null;
                }
            }).filter(Objects::nonNull).collect(Collectors.toList());
            if (testMethodList.size() > 0) {
                final TestItem parent = constructTestItem(type, getTestLevelForIType(type));
                parent.setChildren(testMethodList);
                parent.setKind(testMethodList.get(0).getKind());
                resultList.add(parent);
            }
        }

        return resultList;
    }

    public static Range getRange(ICompilationUnit typeRoot, IJavaElement element) throws JavaModelException {
        final ISourceRange range = ((ISourceReference) element).getNameRange();
        return JDTUtils.toRange(typeRoot, range.getOffset(), range.getLength());
    }

    public static TestItem constructTestItem(IJavaElement element, TestLevel level) throws JavaModelException {
        return constructTestItem(element, level, null);
    }

    public static boolean isTestableClass(IType type) throws JavaModelException {
        int flags = type.getFlags();
        if (Flags.isInterface(flags) || Flags.isAbstract(flags)) {
            return false;
        }
        IJavaElement parent = type.getParent();
        while (true) {
            if (parent instanceof ICompilationUnit || parent instanceof IClassFile) {
                return true;
            }
            if (!(parent instanceof IType) || !Flags.isStatic(flags) || !Flags.isPublic(flags)) {
                return false;
            }
            flags = ((IType) parent).getFlags();
            parent = parent.getParent();
        }
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

    public static TestKind resolveTestKindForMethod(IMethod method) {
        for (final TestFrameworkSearcher searcher : frameworkSearchers) {
            if (searcher.isTestMethod(method)) {
                return searcher.getTestKind();
            }
        }
        return null;
    }

    public static boolean hasTestAnnotation(IMethod method, String annotation) {
        try {
            final Optional<IAnnotation> matched = Arrays.stream(method.getAnnotations())
                    .filter(a -> annotation.endsWith(a.getElementName())).findAny();
            if (!matched.isPresent()) {
                return false;
            }
            final IAnnotation anno = matched.get();
            if (!anno.exists()) {
                return false;
            }
            final String name = anno.getElementName();
            final String[][] fullNameArr = method.getDeclaringType().resolveType(name);
            if (fullNameArr == null) {
                final ICompilationUnit cu = method.getCompilationUnit();
                return cu != null && cu.getImport(annotation).exists();
            }
            final String fullName = Arrays.stream(fullNameArr[0]).collect(Collectors.joining("."));
            return fullName.equals(annotation);
        } catch (final JavaModelException e) {
            return false;
        }
    }

    private static boolean isJavaElementExist(IJavaElement element) {
        return element != null && element.getResource() != null && element.getResource().exists();
    }

    private static boolean isInTestScope(IJavaElement element) throws JavaModelException {
        final IJavaProject project = element.getJavaProject();
        for (final IPath testRootPath : ProjectUtils.getTestPath(project)) {
            if (testRootPath.isPrefixOf(element.getPath())) {
                return true;
            }
        }
        return false;
    }

    private static TestLevel getTestLevelForIType(IType type) {
        if (type.getParent() instanceof ICompilationUnit) {
            return TestLevel.CLASS;
        } else {
            return TestLevel.NESTED_CLASS;
        }
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
