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

import java.io.PrintStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import java.util.stream.Collectors;

import org.junit.runner.Description;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;

import com.google.gson.Gson;

public class TestingMessageHelper {
    private static final String TEST_REPORTER_ATTACHED = "testReporterAttached";
    private static final String ROOT_NAME = "rootName";
    private static final String NAME = "name";
    private static final String LOCATION = "location";
    private static final String TEST_STARTED = "testStarted";
    private static final String TEST_IGNORED = "testIgnored";
    private static final String TEST_FINISHED = "testFinished";
    private static final String DURATION = "duration";
    private static final String SUITE_TREE_NODE = "suiteTreeNode";
    private static final String TEST_SUITE_FINISHED = "testSuiteFinished";
    private static final String TEST_SUITE_STARTED = "testSuiteStarted";
    private static final String SUITE_TREE_STARTED = "suiteTreeStarted";
    private static final String SUITE_TREE_ENDED = "suiteTreeEnded";
    private static final String MESSAGE = "message";
    private static final String DETAILS = "details";
    private static final String TEST_FAILED = "testFailed";

    /**
     * Prints a message when the test reported was attached.
     *
     * @param stream output stream
     */
    public static void reporterAttached(TestOutputSream stream) {
        stream.println(create(TEST_REPORTER_ATTACHED, (List<Pair>) null));
    }

    /**
     * Prints an information about the root test execution.
     *
     * @param out output stream
     */
    public static void rootPresentation(TestOutputSream stream) {
        stream.println(create(ROOT_NAME, new Pair(NAME, "Default Suite")));
    }

    /**
     * Prints an information when an atomic test is about to be started.
     *
     * @param description information about test
     * @param out output stream
     */
    public static void testStarted(TestOutputSream stream, Description description) {
        String location = description.getClassName() + "." + description.getMethodName();
        stream.println(
                create(
                        TEST_STARTED,
                        new Pair(NAME, description.getMethodName()),
                        new Pair(LOCATION, "java:test://" + location)));
    }

    /**
     * Prints an information when a test will not be run.
     *
     * @param name method name
     * @param out output stream
     */
    public static void testIgnored(TestOutputSream stream, String name) {
        stream.println(create(TEST_IGNORED, new Pair(NAME, name)));
    }

    /**
     * Prints an information when an atomic test has finished.
     *
     * @param description information about test method
     * @param out output stream
     * @param duration time of test running
     */
    public static void testFinished(TestOutputSream stream, Description description, long duration) {
        stream.println(
                create(
                        TEST_FINISHED,
                        new Pair(NAME, description.getMethodName()),
                        new Pair(DURATION, String.valueOf(duration))));
    }

    /**
     * Prints an information when an test node has added.
     *
     * @param description information about test node
     * @param out output stream
     */
    public static void treeNode(TestOutputSream stream, Description description) {
        String location = description.getClassName() + "." + description.getMethodName();
        stream.println(
                create(
                        SUITE_TREE_NODE,
                        new Pair(NAME, description.getMethodName()),
                        new Pair(LOCATION, "java:test://" + location)));
    }

    /**
     * Prints an information when running of test suite started.
     *
     * @param currentSuite name of test suite
     * @param out output stream
     */
    public static void testSuiteFinished(TestOutputSream stream, String currentSuite) {
        stream.println(create(TEST_SUITE_FINISHED, new Pair(NAME, currentSuite)));
    }

    /**
     * Prints an information when running of test suite started.
     *
     * @param description information about suite
     * @param out output stream
     */
    public static void testSuiteStarted(TestOutputSream stream, Description description) {
        stream.println(
                create(
                        TEST_SUITE_STARTED,
                        new Pair(NAME, description.getClassName()),
                        new Pair(LOCATION, "java:test://" + description.getClassName())));
    }

    /**
     * Prints an information when building of test tree started.
     *
     * @param description information about suite
     * @param out output stream
     */
    public static void suiteTreeNodeStarted(TestOutputSream stream, Description description) {
        stream.println(
                create(
                        SUITE_TREE_STARTED,
                        new Pair(NAME, description.getClassName()),
                        new Pair(LOCATION, "java:test://" + description.getClassName())));
    }

    /**
     * Prints an information when building of test tree ended.
     *
     * @param description information about suite
     * @param out output stream
     */
    public static void suiteTreeNodeEnded(TestOutputSream stream, Description description) {
        stream.println(
                create(
                        SUITE_TREE_ENDED,
                        new Pair(NAME, description.getClassName()),
                        new Pair(LOCATION, "java:test://" + description.getClassName())));
    }

    /**
     * Prints an information when a test fails.
     *
     * @param out output stream
     * @param failure describes the test that failed and the exception that was thrown
     * @param duration time of test running
     */
    public static void testFailed(TestOutputSream stream, Failure failure, long duration) {
        List<Pair> attributes = new ArrayList<>();
        attributes.add(new Pair(NAME, failure.getDescription().getMethodName()));
        Throwable exception = failure.getException();
        if (exception != null) {
            String failMessage = failure.getMessage();
            StringWriter writer = new StringWriter();
            PrintWriter printWriter = new PrintWriter(writer);
            exception.printStackTrace(printWriter);
            String stackTrace = writer.getBuffer().toString();
            attributes.add(new Pair(MESSAGE, failMessage));
            attributes.add(new Pair(DETAILS, stackTrace));
        } else {
            attributes.add(new Pair(MESSAGE, ""));
        }
        attributes.add(new Pair(DURATION, String.valueOf(duration)));

        stream.println(create(TEST_FAILED, attributes));
    }

    /**
     * Prints an information about result of the test running.
     *
     * @param out output stream
     * @param result the summary of the test run, including all the tests that failed
     */
    public static void testRunFinished(TestOutputSream stream, Result result) {
        String message = String.format("Total tests run: %d, Failures: %d, Skips: %d",
                result.getRunCount(), result.getFailureCount(), result.getIgnoreCount());
        stream.println(new TestReportItem(TestReportType.Info, null, null, message, null));
    }

    private static TestReportItem create(String name, Pair... attributes) {
        List<Pair> pairList = null;
        if (attributes != null) {
            pairList = Arrays.asList(attributes);
        }
        return create(name, pairList);
    }

    private static TestReportItem create(String name, List<Pair> attributes) {
        Map<String, String> attrMap = null;
        if (attributes != null) {
            attrMap = attributes.stream().collect(Collectors.toMap((p) -> p.first, (p) -> p.second));
        }
        TestReportItem item = new TestReportItem(TestReportType.Info, name, attrMap, null, null);
        return item;
    }
    
    /*private static String escape(String str) {
    	if (str == null) {
    		return str;
    	}
        int len = str.length();
        StringBuilder sb = new StringBuilder(len);
        String t;
        for (int i = 0; i < len; i += 1) {
            char c = str.charAt(i);
            switch (c) {
            case '\\':
            case '\"':
                sb.append('\\');
                sb.append(c);
                break;
            case '\b':
                sb.append("\\b");
                break;
            case '\t':
                sb.append("\\t");
                break;
            case '\n':
                sb.append("\\n");
                break;
            case '\f':
                sb.append("\\f");
                break;
            case '\r':
               sb.append("\\r");
               break;
            case '@':
               sb.append("&#x40;");
               break;
            default:
                if (c < ' ') {
                    t = "000" + Integer.toHexString(c);
                    sb.append("\\u" + t.substring(t.length() - 4));
                } else {
                    sb.append(c);
                }
            }
        }
        return sb.toString();
    }*/

    private static class Pair {
        final String first;
        final String second;

        Pair(String first, String second) {
            this.first = first;
            this.second = second;
        }
    }
}
