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

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.OperationCanceledException;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.IMethodBinding;
import org.eclipse.jdt.core.dom.Modifier;
import org.eclipse.jdt.internal.junit.launcher.JUnit4TestFinder;
import org.eclipse.jdt.internal.junit.launcher.TestKindRegistry;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public class JUnit4TestSearcher extends BaseFrameworkSearcher {

    private static final JUnit4TestFinder JUNIT4_TEST_FINDER = new JUnit4TestFinder();

    public JUnit4TestSearcher() {
        super();
        this.testMethodAnnotations = new String[] { "org.junit.Test", "org.junit.experimental.theories.Theory" };
    }

    @Override
    public TestKind getTestKind() {
        return TestKind.JUnit;
    }

    @Override
    public String getJdtTestKind() {
        return TestKindRegistry.JUNIT4_TEST_KIND_ID;
    }

    @Override
    public boolean isTestMethod(IMethodBinding methodBinding) {
        final int modifiers = methodBinding.getModifiers();
        if (Modifier.isAbstract(modifiers) || Modifier.isStatic(modifiers) || !Modifier.isPublic(modifiers)) {
            return false;
        }

        if (methodBinding.isConstructor() || !"void".equals(methodBinding.getReturnType().getName())) {
            return false;
        }

        return this.findAnnotation(methodBinding.getAnnotations(), this.getTestMethodAnnotations());
    }

    @Override
    public boolean isTestClass(IType type) throws JavaModelException {
        return JUNIT4_TEST_FINDER.isTest(type);
    }

    @Override
    public Set<IType> findTestItemsInContainer(IJavaElement element, IProgressMonitor monitor) throws CoreException {
        final Set<IType> types = new HashSet<>();
        try {
            JUNIT4_TEST_FINDER.findTestsInContainer(element, types, monitor);
        } catch (OperationCanceledException e) {
            return Collections.emptySet();
        }

        return types;
    }
}
