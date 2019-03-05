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
import java.util.ArrayList;
import java.util.List;

public class TestRunnerMessageHelper {
    public static void reporterAttached() {
        TestOutputStream.instance()
                .println(MessageUtils.create(TestMessageConstants.TEST_REPORTER_ATTACHED, (List<Pair>) null));
    }

    public static void rootPresentation() {
        TestOutputStream.instance()
                .println(MessageUtils.createWithName(TestMessageConstants.ROOT_NAME, "Default Suite"));
    }

    public static void testStarted(String name) {
        TestOutputStream.instance().println(MessageUtils.createWithName(TestMessageConstants.TEST_STARTED, name));
    }

    public static void testIgnored(String name) {
        TestOutputStream.instance().println(MessageUtils.createWithName(TestMessageConstants.TEST_IGNORED, name));
    }

    public static void testFinished(String name, long duration) {
        TestOutputStream.instance()
                .println(MessageUtils.create(TestMessageConstants.TEST_FINISHED,
                        new Pair(TestMessageConstants.NAME, name),
                        new Pair(TestMessageConstants.DURATION, String.valueOf(duration))));
    }

    public static void testSuiteFinished(String className) {
        TestOutputStream.instance()
                .println(MessageUtils.createWithName(TestMessageConstants.TEST_SUITE_FINISHED, className));
    }

    public static void testSuiteStarted(String className) {
        TestOutputStream.instance()
                .println(MessageUtils.createWithName(TestMessageConstants.TEST_SUITE_STARTED, className));
    }

    public static void treeNode(String className, String methodName) {
        TestOutputStream.instance()
                .println(MessageUtils.createWithName(TestMessageConstants.SUITE_TREE_NODE, methodName));
    }

    public static void suiteTreeNodeStarted(String className) {
        TestOutputStream.instance()
                .println(MessageUtils.createWithName(TestMessageConstants.SUITE_TREE_STARTED, className));
    }

    public static void suiteTreeNodeEnded(String className) {
        TestOutputStream.instance()
                .println(MessageUtils.createWithName(TestMessageConstants.SUITE_TREE_ENDED, className));
    }

    public static void testFailed(String name, Throwable exception, long duration) {
        final List<Pair> attributes = new ArrayList<>();
        attributes.add(new Pair(TestMessageConstants.NAME, name));
        if (exception != null) {
            final String failMessage = exception.getMessage();
            final StringWriter writer = new StringWriter();
            final PrintWriter printWriter = new PrintWriter(writer);
            exception.printStackTrace(printWriter);
            final String stackTrace = writer.getBuffer().toString();
            attributes.add(new Pair(TestMessageConstants.MESSAGE, failMessage));
            attributes.add(new Pair(TestMessageConstants.TRACE, stackTrace));
        } else {
            attributes.add(new Pair(TestMessageConstants.MESSAGE, ""));
        }
        attributes.add(new Pair(TestMessageConstants.DURATION, String.valueOf(duration)));

        TestOutputStream.instance().println(MessageUtils.create(TestMessageConstants.TEST_FAILED, attributes));
    }

    public static void testRunFinished(int all, int fail, int skip) {
        final String message = String.format("Total tests run: %d, Failures: %d, Skips: %d", all, fail, skip);
        TestOutputStream.instance().println(MessageUtils.create(TestMessageConstants.TEST_RESULT_SUMMARY,
                new Pair(TestMessageConstants.MESSAGE, message)));
    }
}
