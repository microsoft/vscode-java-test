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

import com.microsoft.java.test.plugin.model.TestItem;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.searcher.JUnit4TestSearcher;
import com.microsoft.java.test.plugin.searcher.JUnit5TestSearcher;
import com.microsoft.java.test.plugin.searcher.TestFrameworkSearcher;
import com.microsoft.java.test.plugin.searcher.TestNGTestSearcher;

import org.eclipse.jdt.core.IAnnotatable;
import org.eclipse.jdt.core.IAnnotation;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMember;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.IMethodBinding;
import org.eclipse.jdt.core.dom.ITypeBinding;
import org.eclipse.jdt.internal.junit.launcher.JUnit4TestFinder;
import org.eclipse.jdt.internal.junit.launcher.JUnit5TestFinder;
import org.eclipse.jdt.internal.junit.util.CoreTestSearchEngine;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public class TestFrameworkUtils {

    public static final TestFrameworkSearcher[] FRAMEWORK_SEARCHERS = new TestFrameworkSearcher[] {
        new JUnit4TestSearcher(), new JUnit5TestSearcher(), new TestNGTestSearcher() };

    private static final JUnit4TestFinder JUNIT4_TEST_FINDER = new JUnit4TestFinder();
    private static final JUnit5TestFinder JUNIT5_TEST_FINDER = new JUnit5TestFinder();

    public static void findTestItemsInTypeBinding(ITypeBinding typeBinding, List<TestItem> result,
            Map<String, TestItem> classMapping) throws JavaModelException {
        final List<TestFrameworkSearcher> searchers = new ArrayList<>();
        final IType type = (IType) typeBinding.getJavaElement();
        for (final TestFrameworkSearcher searcher : FRAMEWORK_SEARCHERS) {
            if (CoreTestSearchEngine.isAccessibleClass(type, searcher.getJdtTestKind())) {
                searchers.add(searcher);
            }
        }

        if (searchers.size() == 0) {
            return;
        }

        final List<TestItem> testMethods = new LinkedList<>();
        final List<String> testMethodIds = new LinkedList<>();
        for (final IMethodBinding methodBinding : typeBinding.getDeclaredMethods()) {
            for (final TestFrameworkSearcher searcher : searchers) {
                if (searcher.isTestMethod(methodBinding)) {
                    final TestItem methodItem = searcher.parseTestItem(methodBinding);
                    testMethods.add(methodItem);
                    testMethodIds.add(methodItem.getId());
                    break;
                }
            }
        }
        TestItem classItem = null;
        if (testMethods.size() > 0) {
            result.addAll(testMethods);
            classItem = TestItemUtils.constructTestItem((IType) typeBinding.getJavaElement(),
                    TestLevel.CLASS);
            classItem.setChildren(testMethodIds);
            classItem.setKind(testMethods.get(0).getKind());
            result.add(classItem);
        } else {
            if (JUNIT4_TEST_FINDER.isTest(type)) {
                // Leverage JUnit4TestFinder to handle @RunWithclasses
                classItem = TestItemUtils.constructTestItem(type, TestLevel.CLASS, TestKind.JUnit);
                result.add(classItem);
            } else if (JUNIT5_TEST_FINDER.isTest(type)) {
                // Leverage JUnit5TestFinder to handle @Nested and @Testable classes
                classItem = TestItemUtils.constructTestItem(type, TestLevel.CLASS, TestKind.JUnit5);
                result.add(classItem);
            }
        }

        // set the class item as the child of its declaring type
        if (classItem != null) {
            classMapping.put(typeBinding.getQualifiedName(), classItem);
            final ITypeBinding declarationType = typeBinding.getDeclaringClass();
            if (declarationType != null) {
                final TestItem declarationTypeItem = classMapping.get(declarationType.getQualifiedName());
                if (declarationTypeItem != null) {
                    declarationTypeItem.addChild(classItem.getId());
                }
            }
        }

        for (final ITypeBinding childTypeBinding : typeBinding.getDeclaredTypes()) {
            findTestItemsInTypeBinding(childTypeBinding, result, classMapping);
        }
    }

    public static TestItem resolveTestItemForMethod(IMethod method) throws JavaModelException {
        for (final TestFrameworkSearcher searcher : FRAMEWORK_SEARCHERS) {
            if (searcher.isTestMethod(method)) {
                return searcher.parseTestItem(method);
            }
        }
        return null;
    }

    public static TestItem resolveTestItemForClass(IType type) throws JavaModelException {
        for (final TestFrameworkSearcher searcher : FRAMEWORK_SEARCHERS) {
            if (searcher.isTestClass(type)) {
                return searcher.parseTestItem(type);
            }
        }
        return null;
    }

    /**
     * Find the {@link IAnnotation} if the {@link IMember} is annotated with the given annotation string.
     *
     * @param member the {@link IMember} to search.
     * @param annotationToSearch The annotation string.
     * @param checkHierarchy Specify whether to search the whole annotation hierarchy.
     */
    @Deprecated
    public static Optional<IAnnotation> getAnnotation(IMember member, String annotationToSearch,
            boolean checkHierarchy) {
        if (!IAnnotatable.class.isInstance(member)) {
            return Optional.empty();
        }

        final IJavaProject javaProject = member.getJavaProject();
        if (javaProject == null) {
            return Optional.empty();
        }

        IType declaringType = null;
        if (IMethod.class.isInstance(member)) {
            declaringType = member.getDeclaringType();
        } else if (IType.class.isInstance(member)) {
            declaringType = (IType) member;
        }
        if (declaringType == null) {
            return Optional.empty();
        }

        final IAnnotatable annotatable = (IAnnotatable) member;
        try {
            for (final IAnnotation annotation : annotatable.getAnnotations()) {
                final IType annotationType = getResolvedType(annotation.getElementName(), declaringType, javaProject);
                if (annotationType != null) {
                    if (annotationToSearch.equals(annotationType.getFullyQualifiedName())) {
                        return Optional.of(annotation);
                    }
                }
                if (checkHierarchy) {
                    final Set<IType> hierarchy = new HashSet<>();
                    if (matchesInAnnotationHierarchy(annotationToSearch, annotationType, javaProject, hierarchy)) {
                        return Optional.of(annotation);
                    }
                }
            }
        } catch (final JavaModelException e) {
            // Swallow the exception
            return Optional.empty();
        }
        return Optional.empty();
    }

    /**
     * Check the given {@link IMember} has annotated with the given annotation string.
     *
     * @param member the {@link IMember} to search.
     * @param annotationToSearch The annotation string.
     * @param checkHierarchy Specify whether to search the whole annotation hierarchy.
     */
    @Deprecated
    public static boolean hasAnnotation(IMember member, String annotationToSearch, boolean checkHierarchy) {
        return getAnnotation(member, annotationToSearch, checkHierarchy).isPresent();
    }

    private static IType getResolvedType(String typeName, IType type, IJavaProject javaProject)
            throws JavaModelException {
        IType resolvedType = null;
        if (typeName != null) {
            final int pos = typeName.indexOf('<');
            if (pos != -1) {
                typeName = typeName.substring(0, pos);
            }
            final String[][] resolvedTypeNames = type.resolveType(typeName);
            if (resolvedTypeNames != null && resolvedTypeNames.length > 0) {
                final String[] resolvedTypeName = resolvedTypeNames[0];
                resolvedType = javaProject.findType(resolvedTypeName[0], resolvedTypeName[1]);
            }
        }
        return resolvedType;
    }

    private static boolean matchesInAnnotationHierarchy(String annotationFullName, IType annotationType,
            IJavaProject javaProject, Set<IType> hierarchy) throws JavaModelException {
        if (annotationType != null) {
            for (final IAnnotation annotation : annotationType.getAnnotations()) {
                final IType annType = getResolvedType(annotation.getElementName(), annotationType, javaProject);
                if (annType != null && hierarchy.add(annType)) {
                    if (annotationFullName.equals(annotationType.getFullyQualifiedName()) ||
                            matchesInAnnotationHierarchy(annotationFullName, annType, javaProject, hierarchy)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
