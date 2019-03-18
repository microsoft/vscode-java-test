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
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IMember;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;

import java.util.Arrays;
import java.util.Optional;
import java.util.stream.Collectors;

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

    public static Optional<IAnnotation> getAnnotation(IMember member, String memberAnnotation) {
        try {
            final Optional<IAnnotation> matched = getMatchedAnnotation(member, memberAnnotation);
            if (!matched.isPresent()) {
                return Optional.empty();
            }
            final IAnnotation annotation = matched.get();
            if (!annotation.exists()) {
                return Optional.empty();
            }

            final String name = annotation.getElementName();

            String[][] fullNameArr = null;
            if (IType.class.isInstance(member) && member.getDeclaringType() == null) {
                fullNameArr = ((IType) member).resolveType(name);
            } else {
                fullNameArr = member.getDeclaringType().resolveType(name);
            }
            if (fullNameArr == null) {
                final ICompilationUnit cu = member.getCompilationUnit();
                if (cu != null && cu.getImport(memberAnnotation).exists()) {
                    return Optional.of(annotation);
                } else {
                    return Optional.empty();
                }
            }
            final String fullName = Arrays.stream(fullNameArr[0]).collect(Collectors.joining("."));
            return fullName.equals(memberAnnotation) ?
                Optional.of(annotation) : Optional.empty();
        } catch (final JavaModelException e) {
            return Optional.empty();
        }
    }

    public static boolean hasAnnotation(IMember member, String annotation) {
        return getAnnotation(member, annotation).isPresent();
    }

    protected static Optional<IAnnotation> getMatchedAnnotation(IMember member, String annotationToSearch)
            throws JavaModelException {
        if (!IAnnotatable.class.isInstance(member)) {
            return Optional.empty();
        }
        return Arrays.stream(((IAnnotatable) member).getAnnotations())
                .filter(annotation -> annotationToSearch.endsWith(annotation.getElementName())).findAny();
    }
}
