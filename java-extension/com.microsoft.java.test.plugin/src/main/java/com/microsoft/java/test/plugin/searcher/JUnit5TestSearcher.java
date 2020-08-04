/*******************************************************************************
 * Copyright (c) 2017 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.searcher;

import com.microsoft.java.test.plugin.model.TestItem;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.util.TestFrameworkUtils;

import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.IAnnotation;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.ASTNode;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.dom.IAnnotationBinding;
import org.eclipse.jdt.core.dom.IMethodBinding;
import org.eclipse.jdt.core.dom.ITypeBinding;
import org.eclipse.jdt.core.dom.MethodDeclaration;
import org.eclipse.jdt.core.dom.Modifier;
import org.eclipse.jdt.core.dom.NodeFinder;
import org.eclipse.jdt.core.dom.SingleVariableDeclaration;
import org.eclipse.jdt.core.manipulation.CoreASTProvider;
import org.eclipse.jdt.internal.junit.launcher.TestKindRegistry;

import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public class JUnit5TestSearcher extends BaseFrameworkSearcher {

    public static final String JUPITER_NESTED = "org.junit.jupiter.api.Nested";
    public static final String JUNIT_PLATFORM_TESTABLE = "org.junit.platform.commons.annotation.Testable";

    // TODO: Remove the following annotations once we can find tests without the search engine
    //       - The search engine cannot find the meta-annotation and testable annotated ones.
    public static final String JUPITER_TEST = "org.junit.jupiter.api.Test";
    public static final String JUPITER_PARAMETERIZED_TEST = "org.junit.jupiter.params.ParameterizedTest";
    public static final String JUPITER_REPEATED_TEST = "org.junit.jupiter.api.RepeatedTest";
    public static final String JUPITER_TEST_FACTORY = "org.junit.jupiter.api.TestFactory";
    public static final String JUPITER_TEST_TEMPLATE = "org.junit.jupiter.api.TestTemplate";

    protected static final String DISPLAY_NAME_ANNOTATION_JUNIT5 = "org.junit.jupiter.api.DisplayName";

    public JUnit5TestSearcher() {
        super();
        this.testMethodAnnotations = new String[] { JUPITER_TEST, JUPITER_PARAMETERIZED_TEST,
            JUPITER_REPEATED_TEST, JUPITER_TEST_FACTORY, JUPITER_TEST_TEMPLATE, JUNIT_PLATFORM_TESTABLE };
        this.testClassAnnotations = new String[] { JUNIT_PLATFORM_TESTABLE, JUPITER_NESTED };
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
    public boolean isTestMethod(IMethod method) {
        try {
            final int flags = method.getFlags();
            if (Flags.isAbstract(flags) || Flags.isStatic(flags) || Flags.isPrivate(flags)) {
                return false;
            }
            if (method.isConstructor()) {
                return false;
            }
            for (final String annotation : this.testMethodAnnotations) {
                if (TestFrameworkUtils.hasAnnotation(method, annotation, true /*checkHierarchy*/)) {
                    return true;
                }
            }
            return false;
        } catch (final JavaModelException e) {
            // ignore
            return false;
        }
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
        for (final String annotationName : this.getTestMethodAnnotations()) {
            if (this.annotates(methodBinding.getAnnotations(), annotationName)) {
                return true;
            }
        }
        return false;
    }

    @SuppressWarnings("rawtypes")
    @Override
    public TestItem parseTestItem(IMethod method) throws JavaModelException {
        final TestItem item = super.parseTestItem(method);
        // Check if the method has annotated with @DisplayName
        final Optional<IAnnotation> annotation = TestFrameworkUtils.getAnnotation(method,
                DISPLAY_NAME_ANNOTATION_JUNIT5, false /*checkHierarchy*/);
        if (annotation.isPresent()) {
            item.setDisplayName((String) annotation.get().getMemberValuePairs()[0].getValue());
        }

        // Get the parameter type information
        final List<String> result = new LinkedList<>();
        final CompilationUnit astRoot = CoreASTProvider.getInstance().getAST(
                method.getDeclaringType().getCompilationUnit(), CoreASTProvider.WAIT_YES, new NullProgressMonitor());
        final ISourceRange sourceRange = method.getSourceRange();
        final ASTNode name = NodeFinder.perform(astRoot, sourceRange.getOffset(), sourceRange.getLength(),
                method.getCompilationUnit());
        if (name instanceof MethodDeclaration) {
            final List parameterList = ((MethodDeclaration) name).parameters();
            for (final Object obj : parameterList) {
                if (obj instanceof SingleVariableDeclaration) {
                    result.add(((SingleVariableDeclaration) obj).getType().resolveBinding().getQualifiedName());
                }
            }
        }
        item.setParamTypes(result);
        return item;
    }

    @Override
    public TestItem parseTestItem(IMethodBinding methodBinding) throws JavaModelException {
        final TestItem item = super.parseTestItem(methodBinding);

        // deal with @DisplayName
        for (final IAnnotationBinding annotation : methodBinding.getAnnotations()) {
            if (annotation == null) {
                continue;
            }
            if (matchesName(annotation.getAnnotationType(), DISPLAY_NAME_ANNOTATION_JUNIT5)) {
                item.setDisplayName((String) annotation.getAllMemberValuePairs()[0].getValue());
                break;
            }
        }

        // parse the parameters
        final ITypeBinding[] parameters = methodBinding.getParameterTypes();
        if (parameters.length > 0) {
            final List<String> result = new LinkedList<>();
            for (final ITypeBinding parameter : parameters) {
                result.add(parameter.getQualifiedName());
            }
            item.setParamTypes(result);
        }

        return item;
    }

    @Override
    public boolean annotates(IAnnotationBinding[] annotations, String annotationName) {
        for (final IAnnotationBinding annotation : annotations) {
            if (annotation == null) {
                continue;
            }
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
        return false;
    }

    private boolean matchesName(ITypeBinding annotationType, String annotationName) {
        if (annotationType != null) {
            if (annotationType.getQualifiedName().equals(annotationName)) {
                return true;
            }
        }

        return false;
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
                        matchesNameInAnnotationHierarchy(annotation, annotationName, hierarchy)) {
                    return true;
                }
            }
        }

        return false;
    }
}
