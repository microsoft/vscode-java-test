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

import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.util.TestFrameworkUtils;

import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.JavaModelException;

public class JUnit4TestSearcher extends BaseFrameworkSearcher {

    public static final String RUN_WITH = "org.junit.runner.RunWith";

    public JUnit4TestSearcher() {
        super();
        this.testMethodAnnotations = new String[] { "org.junit.Test", "org.junit.experimental.theories.Theory" };
        this.testClassAnnotations = new String[] { RUN_WITH };
    }

    @Override
    public TestKind getTestKind() {
        return TestKind.JUnit;
    }

    @Override
    public boolean isTestMethod(IMethod method) {
        try {
            final int flags = method.getFlags();
            if (Flags.isAbstract(flags) || Flags.isStatic(flags) || !Flags.isPublic(flags)) {
                return false;
            }
            // 'V' is void signature
            if (method.isConstructor() || !"V".equals(method.getReturnType())) {
                return false;
            }
            for (final String annotation : this.testMethodAnnotations) {
                if (TestFrameworkUtils.hasAnnotation(method, annotation)) {
                    return true;
                }
            }
            return false;
        } catch (final JavaModelException e) {
            // ignore
            return false;
        }
    }
}
