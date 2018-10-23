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
import com.microsoft.java.test.plugin.util.TestSearchUtils;

import org.eclipse.jdt.core.IMethod;

public class JUnit5TestSearcher extends BaseFrameworkSearcher {

    public static final String TEST_METHOD_ANNOTATION = "org.junit.jupiter.api.Test";

    @Override
    public TestKind getTestKind() {
        return TestKind.JUnit5;
    }

    @Override
    public boolean isTestMethod(IMethod method) {
        return super.isTestMethod(method) && TestSearchUtils.hasTestAnnotation(method, TEST_METHOD_ANNOTATION);
    }
}
