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
import com.microsoft.java.test.plugin.util.JUnitUtility;

import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.JavaModelException;

public class JUnit4TestSearcher implements TestFrameworkSearcher {

    public static final String JUNIT_TEST_ANNOTATION = "org.junit.Test";
    public static final String JUNIT_RUN_WITH_ANNOTATION = "org.junit.runner.RunWith";

    @Override
    public TestKind getTestKind() {
        return TestKind.JUnit;
    }

    @Override
    public boolean isTestMethod(IMethod method) {
        final int flags;
        try {
            flags = method.getFlags();
            // 'V' is void signature
            return !(method.isConstructor() || !Flags.isPublic(flags) || Flags.isAbstract(flags) ||
                    Flags.isStatic(flags) || !"V".equals(method.getReturnType())) &&
                    JUnitUtility.hasTestAnnotation(method, JUNIT_TEST_ANNOTATION);
        } catch (final JavaModelException e) {
            // ignore
            return false;
        }
    }
}
