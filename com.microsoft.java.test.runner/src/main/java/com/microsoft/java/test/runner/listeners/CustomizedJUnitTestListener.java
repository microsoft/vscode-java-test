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
package com.microsoft.java.test.runner.listeners;

import java.io.PrintStream;

import com.microsoft.java.test.runner.TestOutputSream;
import com.microsoft.java.test.runner.TestingMessageHelper;

import org.junit.runner.Description;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;

/** Listener for whole life cycle of the JUnit test run. */
public class CustomizedJUnitTestListener {
    private final TestOutputSream stream;

    private long myCurrentTestStart;

    public CustomizedJUnitTestListener() {
        this.stream = TestOutputSream.Instance();
        TestingMessageHelper.reporterAttached(stream);
    }

    /** Called before any tests have been run. */
    public void testRunStarted() {
        TestingMessageHelper.rootPresentation(stream);
    }

    /**
     * Called when an atomic test is about to be started.
     *
     * @param description the description of the test that is about to be run (generally a class and
     *     method name)
     */
    public void testStarted(Description description) {
        myCurrentTestStart = System.currentTimeMillis();

        TestingMessageHelper.testStarted(stream, description);
    }

    /**
     * Called when an atomic test has finished, whether the test succeeds or fails.
     *
     * @param description the description of the test that just ran
     */
    public void testFinished(Description description) {
        long duration = System.currentTimeMillis() - myCurrentTestStart;

        TestingMessageHelper.testFinished(stream, description, duration);
    }

    /**
     * Called when test suite starts.
     *
     * @param description the description of the test suite
     */
    public void testSuiteStarted(Description description) {
        TestingMessageHelper.testSuiteStarted(stream, description);
    }

    /**
     * Called when test suite finished.
     *
     * @param currentSuite name of test suite
     */
    public void testSuiteFinished(String currentSuite) {
        TestingMessageHelper.testSuiteFinished(stream, currentSuite);
    }

    /**
     * Called when an atomic test fails.
     *
     * @param failure describes the test that failed and the exception that was thrown
     */
    public void testFailure(Failure failure) {
        long duration = System.currentTimeMillis() - myCurrentTestStart;

        TestingMessageHelper.testFailed(stream, failure, duration);
    }

    /**
     * Called when all tests have finished
     *
     * @param result the summary of the test run, including all the tests that failed
     */
    public void testRunFinished(Result result) {
        TestingMessageHelper.testRunFinished(stream, result);
    }

    /**
     * Called when a test will not be run, generally because a test method is annotated with {@link
     * org.junit.Ignore}.
     *
     * @param description describes the test that will not be run
     */
    public void testIgnored(Description description) {
        TestingMessageHelper.testIgnored(stream, description.getMethodName());
    }

    /**
     * Parse test tree and send atomic test nodes.
     *
     * @param description the description of the test tree
     */
    public void suiteSendTree(Description description) {
        if (description.isTest()) {
            TestingMessageHelper.treeNode(stream, description);
        } else {
            suiteTreeStarted(description);
            for (Description child : description.getChildren()) {
                suiteSendTree(child);
            }
            suiteTreeEnded(description);
        }
    }

    /**
     * Called when build of test tree started.
     *
     * @param description describes the test suite
     */
    public void suiteTreeStarted(Description description) {
        TestingMessageHelper.suiteTreeNodeStarted(stream, description);
    }

    /**
     * Called when build of test tree finished.
     *
     * @param description describes the test suite
     */
    public void suiteTreeEnded(Description description) {
        TestingMessageHelper.suiteTreeNodeEnded(stream, description);
    }
}
