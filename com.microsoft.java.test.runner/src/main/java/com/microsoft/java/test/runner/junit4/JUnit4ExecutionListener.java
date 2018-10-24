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

package com.microsoft.java.test.runner.junit4;

import com.microsoft.java.test.runner.common.TestRunnerMessageHelper;

import org.junit.runner.Description;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;
import org.junit.runner.notification.RunListener;

/**
 * Overridden JUnit run listener {@link RunListener}. The listener responds to the events during a test run.
 */
public class JUnit4ExecutionListener extends RunListener {
    private String currentSuite;
    private long myCurrentTestStart;

    public JUnit4ExecutionListener() {
        currentSuite = "";
    }

    @Override
    public void testRunStarted(Description description) throws Exception {
        TestRunnerMessageHelper.rootPresentation();
    }

    @Override
    public void testRunFinished(Result result) throws Exception {
        if (!currentSuite.isEmpty()) {
            TestRunnerMessageHelper.testSuiteFinished(currentSuite);
        }

        TestRunnerMessageHelper.testRunFinished(result.getRunCount(), result.getFailureCount(),
                result.getIgnoreCount());
    }

    @Override
    public void testStarted(Description description) throws Exception {
        updateCurrentSuite(description);
        myCurrentTestStart = System.currentTimeMillis();

        TestRunnerMessageHelper.testStarted(description.getClassName() + "#" + description.getMethodName());
    }

    @Override
    public void testFinished(Description description) throws Exception {
        final long duration = System.currentTimeMillis() - myCurrentTestStart;

        TestRunnerMessageHelper.testFinished(description.getClassName() + "#" + description.getMethodName(), duration);
    }

    @Override
    public void testFailure(Failure failure) throws Exception {
        final long duration = System.currentTimeMillis() - myCurrentTestStart;

        TestRunnerMessageHelper.testFailed(
                failure.getDescription().getClassName() + "#" + failure.getDescription().getMethodName(),
                failure.getException(), duration);
    }

    @Override
    public void testAssumptionFailure(Failure failure) {
        final long duration = System.currentTimeMillis() - myCurrentTestStart;

        TestRunnerMessageHelper.testFailed(failure.getDescription().getMethodName(), failure.getException(), duration);
    }

    @Override
    public void testIgnored(Description description) throws Exception {
        updateCurrentSuite(description);
        TestRunnerMessageHelper.testIgnored(description.getClassName() + "#" + description.getMethodName());
    }

    public void suiteSendTree(Description description) {
        if (description.isTest()) {
            TestRunnerMessageHelper.treeNode(description.getClassName(), description.getMethodName());
        } else {
            TestRunnerMessageHelper.suiteTreeNodeStarted(description.getClassName());
            for (final Description child : description.getChildren()) {
                suiteSendTree(child);
            }
            TestRunnerMessageHelper.suiteTreeNodeEnded(description.getClassName());
        }
    }

    public void suiteTreeStarted(Description description) {
        TestRunnerMessageHelper.suiteTreeNodeStarted(description.getClassName());
    }

    public void suiteTreeEnded(Description description) {
        TestRunnerMessageHelper.suiteTreeNodeEnded(description.getClassName());
    }

    private void updateCurrentSuite(Description description) {
        if (currentSuite.isEmpty()) {
            currentSuite = description.getClassName();
            TestRunnerMessageHelper.testSuiteStarted(description.getClassName());
        } else if (!currentSuite.equals(description.getClassName())) {
            TestRunnerMessageHelper.testSuiteFinished(currentSuite);
            currentSuite = description.getClassName();
            TestRunnerMessageHelper.testSuiteStarted(description.getClassName());
        }
    }
}
