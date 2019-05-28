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

    public static final String NESTED = "org.junit.jupiter.api.Nested";

    protected static final String DISPLAY_NAME_ANNOTATION_JUNIT5 = "org.junit.jupiter.api.DisplayName";

    public JUnit5TestSearcher() {
        super();
        this.testMethodAnnotations = new String[] { "org.junit.jupiter.api.Test",
            "org.junit.jupiter.params.ParameterizedTest", "org.junit.jupiter.api.RepeatedTest",
            "org.junit.jupiter.api.TestFactory" };
        this.testClassAnnotations = new String[] { NESTED };
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
                if (TestFrameworkUtils.hasAnnotation(method, annotation)) {
                    if ("org.junit.jupiter.api.TestFactory".equals(annotation)) {
                        return true;
                    } else if ("V".equals(method.getReturnType())) {
                        // Other annotations need the return type to be void
                        return true;
                    }
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
                DISPLAY_NAME_ANNOTATION_JUNIT5);
        if (annotation.isPresent()) {
            item.setDisplayName((String) annotation.get().getMemberValuePairs()[0].getValue());
        }

        // Get the parameter type information
        final List<String> result = new LinkedList<>();
        final CompilationUnit astRoot = CoreASTProvider.getInstance().getAST(
                method.getDeclaringType().getCompilationUnit(), CoreASTProvider.WAIT_YES, new NullProgressMonitor());
        final ASTNode name = NodeFinder.perform(astRoot, method.getSourceRange());
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
