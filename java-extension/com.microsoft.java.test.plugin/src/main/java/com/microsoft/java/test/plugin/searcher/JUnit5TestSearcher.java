/*******************************************************************************
 * Copyright (c) 2017-2021 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.searcher;

import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.util.TestFrameworkUtils;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.OperationCanceledException;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.IAnnotationBinding;
import org.eclipse.jdt.core.dom.IMethodBinding;
import org.eclipse.jdt.core.dom.ITypeBinding;
import org.eclipse.jdt.core.dom.Modifier;
import org.eclipse.jdt.internal.junit.launcher.JUnit5TestFinder;
import org.eclipse.jdt.internal.junit.launcher.TestKindRegistry;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public class JUnit5TestSearcher extends BaseFrameworkSearcher {

    private static final JUnit5TestFinder JUNIT5_TEST_FINDER = new JUnit5TestFinder();

    public static final String JUPITER_NESTED = "org.junit.jupiter.api.Nested";
    public static final String JUNIT_PLATFORM_TESTABLE = "org.junit.platform.commons.annotation.Testable";

    protected static final String DISPLAY_NAME_ANNOTATION_JUNIT5 = "org.junit.jupiter.api.DisplayName";

    public JUnit5TestSearcher() {
        super();
        this.testMethodAnnotations = new String[] { JUNIT_PLATFORM_TESTABLE };
    }

    @Override
    public TestKind getTestKind() {
        return TestKind.JUnit5;
    }

    @Override
    public String getJdtTestKind() {
        return TestKindRegistry.JUNIT5_TEST_KIND_ID;
    }

    @Override
    public boolean isTestMethod(IMethodBinding methodBinding) {
        final int modifiers = methodBinding.getModifiers();
        if (Modifier.isAbstract(modifiers) || Modifier.isStatic(modifiers) || Modifier.isPrivate(modifiers)) {
            return false;
        }

        if (methodBinding.isConstructor()) {
            return false;
        }

        return this.findAnnotation(methodBinding.getAnnotations(), this.getTestMethodAnnotations());
    }

    @Override
    public boolean findAnnotation(IAnnotationBinding[] annotations, String[] annotationNames) {
        for (final IAnnotationBinding annotation : annotations) {
            if (annotation == null) {
                continue;
            }
            for (final String annotationName : annotationNames) {
                if (matchesName(annotation.getAnnotationType(), annotationName)) {
                    return true;
                }
    
                if (JUPITER_NESTED.equals(annotationName) || JUNIT_PLATFORM_TESTABLE.equals(annotationName)) {
                    final Set<ITypeBinding> hierarchy = new HashSet<>();
                    if (matchesNameInAnnotationHierarchy(annotation, annotationName, hierarchy)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    @Override
    public boolean isTestClass(IType type) throws JavaModelException {
        return JUNIT5_TEST_FINDER.isTest(type);
    }

    private boolean matchesName(ITypeBinding annotationType, String annotationName) {
        return TestFrameworkUtils.isEquivalentAnnotationType(annotationType, annotationName);
    }

    private boolean matchesNameInAnnotationHierarchy(IAnnotationBinding annotation, String annotationName,
            Set<ITypeBinding> hierarchy) {
        final ITypeBinding type = annotation.getAnnotationType();
        if (type == null) {
            return false;
        }

        for (final IAnnotationBinding annotationBinding : type.getAnnotations()) {
            if (annotationBinding == null) {
                continue;
            }
            final ITypeBinding annotationType = annotationBinding.getAnnotationType();
            if (annotationType != null && hierarchy.add(annotationType)) {
                if (matchesName(annotationType, annotationName) ||
                        matchesNameInAnnotationHierarchy(annotationBinding, annotationName, hierarchy)) {
                    return true;
                }
            }
        }

        return false;
    }

    @Override
    public Set<IType> findTestItemsInContainer(IJavaElement element, IProgressMonitor monitor) throws CoreException {
        final Set<IType> types = new HashSet<>();
        try {
            JUNIT5_TEST_FINDER.findTestsInContainer(element, types, monitor);
        } catch (OperationCanceledException e) {
            return Collections.emptySet();
        }
        return types;
    }
}
