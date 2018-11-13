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

import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
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
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchMatch;
import org.eclipse.jdt.core.search.SearchParticipant;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.SearchRequestor;
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
    protected static final String DISPLAY_NAME_ANNOTATION_JUNIT5 = "org.junit.jupiter.api.DisplayName";

    private static final Map<TestLevel, TestItemSearcher[]> searcherMap;
    private static final TestFrameworkSearcher[] frameworkSearchers = new TestFrameworkSearcher[] {
        new JUnit4TestSearcher(), new JUnit5TestSearcher(), new TestNGTestSearcher() };

    static {
        searcherMap = new HashMap<TestLevel, TestItemSearcher[]>();
        searcherMap.put(TestLevel.FOLDER, new TestItemSearcher[] { new PackageSearcher() });
        searcherMap.put(TestLevel.PACKAGE, new TestItemSearcher[] { new ClassSearcher() });
        searcherMap.put(TestLevel.CLASS, new TestItemSearcher[] { new NestedClassSearcher(), new MethodSearcher() });
        searcherMap.put(TestLevel.NESTED_CLASS,
                new TestItemSearcher[] { new NestedClassSearcher(), new MethodSearcher() });
    }

    public static List<TestItem> searchTestItems(List<Object> arguments, IProgressMonitor monitor)
            throws OperationCanceledException, InterruptedException {
        if (arguments == null || arguments.size() == 0) {
            return Collections.<TestItem>emptyList();
        }
        final Gson gson = new Gson();
        final SearchTestItemParams params = gson.fromJson((String) arguments.get(0), SearchTestItemParams.class);

        // wait for the LS finishing updating
        Job.getJobManager().join(DocumentLifeCycleHandler.DOCUMENT_LIFE_CYCLE_JOBS, monitor);

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

        // wait for the LS finishing updating
        Job.getJobManager().join(DocumentLifeCycleHandler.DOCUMENT_LIFE_CYCLE_JOBS, monitor);

        final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(uri);
        if (!isJavaElementExist(unit) || !isInTestScope(unit) || monitor.isCanceled()) {
            return resultList;
        }

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
                // Assume the kinds of all methods are the same.
                parent.setKind(testMethodList.get(0).getKind());
                resultList.add(parent);
            }
        }

        return resultList;
    }

    public static List<TestItem> searchAllTestItems(List<Object> arguments, IProgressMonitor monitor)
            throws CoreException, OperationCanceledException, InterruptedException {
        if (arguments == null || arguments.size() == 0) {
            return Collections.<TestItem>emptyList();
        }
        final Gson gson = new Gson();
        final SearchTestItemParams params = gson.fromJson((String) arguments.get(0), SearchTestItemParams.class);

        // wait for the LS finishing updating
        Job.getJobManager().join(DocumentLifeCycleHandler.DOCUMENT_LIFE_CYCLE_JOBS, monitor);

        final IJavaSearchScope scope = createSearchScope(params);

        SearchPattern pattern = frameworkSearchers[0].getSearchPattern();
        for (int i = 1; i < frameworkSearchers.length; i++) {
            pattern = SearchPattern.createOrPattern(pattern, frameworkSearchers[i].getSearchPattern());
        }

        final Map<String, TestItem> classMap = new HashMap<>();
        final SearchRequestor requestor = new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {
                final Object element = match.getElement();
                if (element instanceof IMethod) {
                    final IMethod method = (IMethod) element;
                    final TestItem methodItem = constructTestItem(method, TestLevel.METHOD,
                            resolveTestKindForMethod(method));
                    final IType type = (IType) method.getParent();
                    final TestItem classItem = classMap.get(type.getFullyQualifiedName());
                    if (classItem != null) {
                        classItem.addChild(methodItem);
                    } else {
                        final TestItem newClassItem = constructTestItem(type, getTestLevelForIType(type));
                        newClassItem.addChild(methodItem);
                        classMap.put(type.getFullyQualifiedName(), newClassItem);
                    }
                }
            }

        };

        new SearchEngine().search(pattern, new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant() },
                scope, requestor, monitor);

        for (final TestItem testClass : classMap.values()) {
            if (testClass.getChildren() != null && testClass.getChildren().size() > 0) {
                // Assume the kinds of all methods are the same.
                testClass.setKind(testClass.getChildren().get(0).getKind());
            }
        }
        return Arrays.asList(classMap.values().toArray(new TestItem[classMap.values().size()]));
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
        String displayName = element.getElementName();
        if (kind == TestKind.JUnit5 && element instanceof IMethod) {
            Optional<IAnnotation> annotation = getAnnotation((IMethod) element, DISPLAY_NAME_ANNOTATION_JUNIT5);
            if (annotation.isPresent()) {
                displayName = (String) annotation.get().getMemberValuePairs()[0].getValue();
            }
        }

        return new TestItem(displayName, parseTestItemFullName(element, level),
                JDTUtils.getFileURI(element.getResource()), parseTestItemRange(element, level), level, kind,
                element.getJavaProject().getProject().getName());
    }

    public static TestKind resolveTestKindForMethod(IMethod method) {
        for (final TestFrameworkSearcher searcher : frameworkSearchers) {
            if (searcher.isTestMethod(method)) {
                return searcher.getTestKind();
            }
        }
        return null;
    }

    public static Optional<IAnnotation> getAnnotation(IMethod method, String methodAnnotation) {
        try {
            final Optional<IAnnotation> matched = Arrays.stream(method.getAnnotations())
                    .filter(annotation -> methodAnnotation.endsWith(annotation.getElementName())).findAny();
            if (!matched.isPresent()) {
                return Optional.empty();
            }
            final IAnnotation annotation = matched.get();
            if (!annotation.exists()) {
                return Optional.empty();
            }

            final String name = annotation.getElementName();
            final String[][] fullNameArr = method.getDeclaringType().resolveType(name);
            if (fullNameArr == null) {
                final ICompilationUnit cu = method.getCompilationUnit();
                if (cu != null && cu.getImport(methodAnnotation).exists())
                    return Optional.of(annotation);
                else
                    return Optional.empty();
            }
            final String fullName = Arrays.stream(fullNameArr[0]).collect(Collectors.joining("."));
            return fullName.equals(methodAnnotation) ?
                Optional.of(annotation) : Optional.empty();
        } catch (final JavaModelException e) {
            return Optional.empty();
        }
    }

    public static boolean hasAnnotation(IMethod method, String methodAnnotation) {
        return getAnnotation(method, methodAnnotation).isPresent();
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

    private static IJavaSearchScope createSearchScope(SearchTestItemParams params) throws JavaModelException {
        switch (params.getLevel()) {
            case ROOT:
                final IJavaProject[] projects = JavaCore.create(ResourcesPlugin.getWorkspace().getRoot())
                        .getJavaProjects();
                return SearchEngine.createJavaSearchScope(projects, IJavaSearchScope.SOURCES);
            case FOLDER:
                final IJavaElement project = JavaCore.create(JDTUtils.findFolder(params.getUri()));
                return SearchEngine.createJavaSearchScope(new IJavaElement[] { project }, IJavaSearchScope.SOURCES);
            case PACKAGE:
                final IJavaElement packageElement = JDTUtils.resolvePackage(params.getUri());
                return SearchEngine.createJavaSearchScope(new IJavaElement[] { packageElement },
                        IJavaSearchScope.SOURCES);
            case CLASS:
            case NESTED_CLASS:
                final ICompilationUnit compilationUnit = JDTUtils.resolveCompilationUnit(params.getUri());
                final IType[] types = compilationUnit.getAllTypes();
                for (final IType type : types) {
                    if (type.getFullyQualifiedName().equals(params.getFullName())) {
                        return SearchEngine.createJavaSearchScope(new IJavaElement[] { type },
                                IJavaSearchScope.SOURCES);
                    }
                }
                break;
            case METHOD:
                final String fullName = params.getFullName();
                final String className = fullName.substring(0, fullName.lastIndexOf("#"));
                final String methodName =  fullName.substring(fullName.lastIndexOf("#") + 1);
                final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(params.getUri());
                final IType[] allTypes = unit.getAllTypes();
                for (final IType type : allTypes) {
                    if (type.getFullyQualifiedName().equals(className)) {
                        for (final IMethod method : type.getMethods()) {
                            if (method.getElementName().equals(methodName)) {
                                return SearchEngine.createJavaSearchScope(new IJavaElement[] { method },
                                        IJavaSearchScope.SOURCES);
                            }
                        }
                    }
                }
        }

        throw new RuntimeException("Cannot resolve the search scope for " + params.getFullName());
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
