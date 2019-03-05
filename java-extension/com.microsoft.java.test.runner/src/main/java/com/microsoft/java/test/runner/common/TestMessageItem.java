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

package com.microsoft.java.test.runner.common;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Arrays;
import java.util.List;

public class TestMessageItem {
    String name;

    List<Pair> attributes;

    TestMessageType type;

    public TestMessageItem(TestMessageType type, String name, List<Pair> attributes) {
        this.type = type;
        this.name = name;
        this.attributes = attributes;
    }

    public TestMessageItem(TestMessageType type, String name, Pair... attributes) {
        this(type, name, attributes != null ? Arrays.asList(attributes) : null);
    }

    public TestMessageItem(String message, Throwable e) {
        this(TestMessageType.Error, TestMessageConstants.TEST_RUNNER_ERROR,
                new Pair(TestMessageConstants.MESSAGE, message),
                new Pair(TestMessageConstants.TRACE, getStacktrace(e)));
    }

    private static String getStacktrace(Throwable throwable) {
        final StringWriter errors = new StringWriter();
        throwable.printStackTrace(new PrintWriter(errors));
        return errors.toString();
    }
}
