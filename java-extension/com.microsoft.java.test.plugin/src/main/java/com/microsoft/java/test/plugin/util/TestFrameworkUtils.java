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

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

public class TestFrameworkUtils {

    public static final TestFrameworkSearcher[] FRAMEWORK_SEARCHERS = new TestFrameworkSearcher[] {
            new JUnit4TestSearcher(), new JUnit5TestSearcher(), new TestNGTestSearcher() };

    public static TestItem resoveTestItemForMethod(IMethod method) throws JavaModelException {
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
    public static Optional<IAnnotation> getAnnotation(IMember member, String annotationToSearch,
            boolean checkHierarchy) {
        if (!IAnnotatable.class.isInstance(member)) {
            return Optional.empty();
        }

        final IJavaProject javaProject = member.getJavaProject();
        if (javaProject == null) {
            return Optional.empty();
        }

        final IType declaringType = member.getDeclaringType();
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
