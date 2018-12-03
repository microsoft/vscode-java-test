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

package com.microsoft.java.test.plugin.searcher;

import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.util.TestSearchUtils;

import org.eclipse.jdt.core.IMethod;

public class TestNGTestSearcher extends BaseFrameworkSearcher {

    protected static final String[] TEST_METHOD_ANNOTATIONS = { "org.testng.annotations.Test" };

    public TestNGTestSearcher() {
        super(TEST_METHOD_ANNOTATIONS);
    }

    @Override
    public TestKind getTestKind() {
        return TestKind.TestNG;
    }

    @Override
    public boolean isTestMethod(IMethod method) {
        if (!super.isTestMethod(method)) {
            return false;
        }

        for (final String annotation : TEST_METHOD_ANNOTATIONS) {
            if (TestSearchUtils.hasAnnotation(method, annotation)) {
                return true;
            }
        }
        return false;
    }
}
