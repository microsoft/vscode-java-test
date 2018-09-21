/*
 * Copyright (c) 2012-2017 Red Hat, Inc.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

package com.microsoft.java.test.runner;

import org.junit.runner.Description;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class TestingMessageHelper {
    /**
     * Prints a message when the test reported was attached.
     *
     * @param stream output stream
     */
    public static void reporterAttached(TestOutputStream stream) {
        stream.println(create(TestMessageConstants.TEST_REPORTER_ATTACHED, (List<Pair>) null));
    }

    /**
     * Prints an information about the root test execution.
     *
     * @param out output stream
     */
    public static void rootPresentation(TestOutputStream stream) {
        stream.println(create(TestMessageConstants.ROOT_NAME, new Pair(TestMessageConstants.NAME, "Default Suite")));
    }

    /**
     * Prints an information when an atomic test is about to be started.
     *
     * @param description information about test
     * @param out output stream
     */
    public static void testStarted(TestOutputStream stream, Description description) {
        final String location = description.getClassName() + "." + description.getMethodName();
        stream.println(
                create(
                        TestMessageConstants.TEST_STARTED,
                        new Pair(TestMessageConstants.NAME, description.getMethodName()),
                        new Pair(TestMessageConstants.LOCATION, "java:test://" + location)));
    }

    /**
     * Prints an information when a test will not be run.
     *
     * @param name method name
     * @param out output stream
     */
    public static void testIgnored(TestOutputStream stream, String name) {
        stream.println(create(TestMessageConstants.TEST_IGNORED, new Pair(TestMessageConstants.NAME, name)));
    }

    /**
     * Prints an information when an atomic test has finished.
     *
     * @param description information about test method
     * @param out output stream
     * @param duration time of test running
     */
    public static void testFinished(TestOutputStream stream, Description description, long duration) {
        stream.println(
                create(
                        TestMessageConstants.TEST_FINISHED,
                        new Pair(TestMessageConstants.NAME, description.getMethodName()),
                        new Pair(TestMessageConstants.DURATION, String.valueOf(duration))));
    }

    /**
     * Prints an information when an test node has added.
     *
     * @param description information about test node
     * @param out output stream
     */
    public static void treeNode(TestOutputStream stream, Description description) {
        final String location = description.getClassName() + "." + description.getMethodName();
        stream.println(
                create(
                        TestMessageConstants.SUITE_TREE_NODE,
                        new Pair(TestMessageConstants.NAME, description.getMethodName()),
                        new Pair(TestMessageConstants.LOCATION, "java:test://" + location)));
    }

    /**
     * Prints an information when running of test suite started.
     *
     * @param currentSuite name of test suite
     * @param out output stream
     */
    public static void testSuiteFinished(TestOutputStream stream, String currentSuite) {
        stream.println(create(TestMessageConstants.TEST_SUITE_FINISHED,
                new Pair(TestMessageConstants.NAME, currentSuite)));
    }

    /**
     * Prints an information when running of test suite started.
     *
     * @param description information about suite
     * @param out output stream
     */
    public static void testSuiteStarted(TestOutputStream stream, Description description) {
        stream.println(
                create(
                        TestMessageConstants.TEST_SUITE_STARTED,
                        new Pair(TestMessageConstants.NAME, description.getClassName()),
                        new Pair(TestMessageConstants.LOCATION, "java:test://" + description.getClassName())));
    }

    /**
     * Prints an information when building of test tree started.
     *
     * @param description information about suite
     * @param out output stream
     */
    public static void suiteTreeNodeStarted(TestOutputStream stream, Description description) {
        stream.println(
                create(
                        TestMessageConstants.SUITE_TREE_STARTED,
                        new Pair(TestMessageConstants.NAME, description.getClassName()),
                        new Pair(TestMessageConstants.LOCATION, "java:test://" + description.getClassName())));
    }

    /**
     * Prints an information when building of test tree ended.
     *
     * @param description information about suite
     * @param out output stream
     */
    public static void suiteTreeNodeEnded(TestOutputStream stream, Description description) {
        stream.println(
                create(
                        TestMessageConstants.SUITE_TREE_ENDED,
                        new Pair(TestMessageConstants.NAME, description.getClassName()),
                        new Pair(TestMessageConstants.LOCATION, "java:test://" + description.getClassName())));
    }

    /**
     * Prints an information when a test fails.
     *
     * @param out output stream
     * @param failure describes the test that failed and the exception that was thrown
     * @param duration time of test running
     */
    public static void testFailed(TestOutputStream stream, Failure failure, long duration) {
        final List<Pair> attributes = new ArrayList<>();
        attributes.add(new Pair(TestMessageConstants.NAME, failure.getDescription().getMethodName()));
        final Throwable exception = failure.getException();
        if (exception != null) {
            final String failMessage = failure.getMessage();
            final StringWriter writer = new StringWriter();
            final PrintWriter printWriter = new PrintWriter(writer);
            exception.printStackTrace(printWriter);
            final String stackTrace = writer.getBuffer().toString();
            attributes.add(new Pair(TestMessageConstants.MESSAGE, failMessage));
            attributes.add(new Pair(TestMessageConstants.DETAILS, stackTrace));
        } else {
            attributes.add(new Pair(TestMessageConstants.MESSAGE, ""));
        }
        attributes.add(new Pair(TestMessageConstants.DURATION, String.valueOf(duration)));

        stream.println(create(TestMessageConstants.TEST_FAILED, attributes));
    }

    /**
     * Prints an information about result of the test running.
     *
     * @param out output stream
     * @param result the summary of the test run, including all the tests that failed
     */
    public static void testRunFinished(TestOutputStream stream, Result result) {
        final String message = String.format("Total tests run: %d, Failures: %d, Skips: %d",
                result.getRunCount(), result.getFailureCount(), result.getIgnoreCount());
        stream.println(create(
                TestMessageConstants.TEST_RESULT_SUMMARY,
                new Pair(TestMessageConstants.MESSAGE, message)));
    }

    private static TestMessageItem create(String name, Pair... attributes) {
        List<Pair> pairList = null;
        if (attributes != null) {
            pairList = Arrays.asList(attributes);
        }
        return create(name, pairList);
    }

    private static TestMessageItem create(String name, List<Pair> attributes) {
        final TestMessageItem item = new TestMessageItem(TestMessageType.Info, name, attributes);
        return item;
    }
}
