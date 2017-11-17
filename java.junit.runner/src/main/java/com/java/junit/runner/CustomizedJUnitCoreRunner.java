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
package com.java.junit.runner;

import com.java.junit.runner.listeners.CustomizedJUnitTestListener;
import com.java.junit.runner.listeners.JUnitExecutionListener;
import java.util.List;

import org.junit.runner.JUnitCore;
import org.junit.runner.Result;
import org.junit.runner.notification.RunListener;
import org.junit.runner.notification.RunNotifier;

public class CustomizedJUnitCoreRunner extends JUnitCore {
    private CustomizedJUnitTestListener listener;
    public void run(String[] suites) {
        createListener();
        List<JUnit4TestReference> newSuites = TestRunnerUtil.createTestReferences(suites);

        if (newSuites.isEmpty()) {
            TestingMessageHelper.reporterAttached(System.out);
            return;
        }

        RunNotifier runNotifier = new RunNotifier();
        runNotifier.addListener(new JUnitExecutionListener(listener));
        listener.testRunStarted();

        for (JUnit4TestReference jUnit4TestReference : newSuites) {
            jUnit4TestReference.sendTree(listener);
        }

        Result result = new Result();
        final RunListener resultListener = result.createListener();
        runNotifier.addListener(resultListener);

        for (JUnit4TestReference testReference : newSuites) {
            testReference.run(runNotifier);
        }
        runNotifier.fireTestRunFinished(result);
    }

    private void createListener() {
        listener = new CustomizedJUnitTestListener();
        this.addListener(new JUnitExecutionListener(listener));
    }
}

