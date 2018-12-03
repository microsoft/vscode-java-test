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

public class JUnit5TestSearcher extends BaseFrameworkSearcher {

    protected static final String[] TEST_METHOD_ANNOTATIONS = {
        "org.junit.jupiter.api.Test",
        "org.junit.jupiter.params.ParameterizedTest"
    };

    public JUnit5TestSearcher() {
        super(TEST_METHOD_ANNOTATIONS);
    }

    @Override
    public TestKind getTestKind() {
        return TestKind.JUnit5;
    }
}
