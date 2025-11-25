/*******************************************************************************
 * Copyright (c) 2017-2025 Microsoft Corporation and others.
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

/**
 * Test searcher for JUnit 6 (Jupiter API 6.x).
 * 
 * Key differences from JUnit 5:
 * - Uses standard @Test annotation directly (org.junit.jupiter.api.Test)
 * - Does not rely on @Testable meta-annotation
 * - Still supports @Nested for nested test classes
 */
public class JUnit6TestSearcher extends BaseFrameworkSearcher {

    private static final JUnit5TestFinder JUNIT5_TEST_FINDER = new JUnit5TestFinder();

    // Standard JUnit Jupiter annotations
    public static final String JUPITER_TEST = "org.junit.jupiter.api.Test";
    public static final String JUPITER_PARAMETERIZED_TEST = "org.junit.jupiter.api.params.ParameterizedTest";
    public static final String JUPITER_REPEATED_TEST = "org.junit.jupiter.api.RepeatedTest";
    public static final String JUPITER_TEST_FACTORY = "org.junit.jupiter.api.TestFactory";
    public static final String JUPITER_TEST_TEMPLATE = "org.junit.jupiter.api.TestTemplate";
    public static final String JUPITER_NESTED = "org.junit.jupiter.api.Nested";
    
    protected static final String DISPLAY_NAME_ANNOTATION_JUNIT6 = "org.junit.jupiter.api.DisplayName";

    public JUnit6TestSearcher() {
        super();
        // JUnit 6 uses standard test annotations, not @Testable
        this.testMethodAnnotations = new String[] { 
            JUPITER_TEST,
            JUPITER_PARAMETERIZED_TEST,
            JUPITER_REPEATED_TEST,
            JUPITER_TEST_FACTORY,
            JUPITER_TEST_TEMPLATE
        };
    }

    @Override
    public TestKind getTestKind() {
        return TestKind.JUnit6;
    }

    @Override
    public String getJdtTestKind() {
        // JUnit 6 uses the same JDT test kind as JUnit 5
        return TestKindRegistry.JUNIT6_TEST_KIND_ID;
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

        // Check for standard JUnit test annotations directly
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
    
                // Special handling for @Nested to check annotation hierarchy
                if (JUPITER_NESTED.equals(annotationName)) {
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
        // Reuse JUnit 5 test finder as it works for JUnit 6 as well
        return JUNIT5_TEST_FINDER.isTest(type);
    }

    private boolean matchesName(ITypeBinding annotationType, String annotationName) {
        return TestFrameworkUtils.isEquivalentAnnotationType(annotationType, annotationName);
    }

    /**
     * Recursively checks the annotation hierarchy to find matching annotations.
     * This is useful for meta-annotations like @Nested.
     */
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
            // Reuse JUnit 5 test finder as the test discovery mechanism is compatible
            JUNIT5_TEST_FINDER.findTestsInContainer(element, types, monitor);
        } catch (OperationCanceledException e) {
            return Collections.emptySet();
        }
        return types;
    }
}
