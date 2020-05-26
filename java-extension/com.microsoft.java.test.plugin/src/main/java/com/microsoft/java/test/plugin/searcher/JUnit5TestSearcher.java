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
import org.eclipse.jdt.core.dom.MethodDeclaration;
import org.eclipse.jdt.core.dom.NodeFinder;
import org.eclipse.jdt.core.dom.SingleVariableDeclaration;
import org.eclipse.jdt.core.manipulation.CoreASTProvider;

import java.util.LinkedList;
import java.util.List;
import java.util.Optional;

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
}
