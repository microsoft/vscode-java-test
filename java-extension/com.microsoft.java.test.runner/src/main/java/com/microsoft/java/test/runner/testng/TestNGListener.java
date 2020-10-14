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

package com.microsoft.java.test.runner.testng;

import com.microsoft.java.test.runner.common.TestRunnerMessageHelper;

import org.testng.ISuite;
import org.testng.ISuiteListener;
import org.testng.ITestContext;
import org.testng.ITestListener;
import org.testng.ITestNGListener;
import org.testng.ITestResult;

import java.util.Collection;

public class TestNGListener implements ISuiteListener, ITestListener, ITestNGListener {

    @Override
    public void onTestStart(ITestResult result) {
        TestRunnerMessageHelper.testStarted(result.getTestClass().getName() + "#" + result.getName());
    }

    @Override
    public void onTestSuccess(ITestResult result) {
        final long duration = result.getEndMillis() - result.getStartMillis();
        TestRunnerMessageHelper.testFinished(result.getTestClass().getName() + "#" + result.getName(), duration);
    }

    @Override
    public void onTestFailure(ITestResult result) {
        final long duration = result.getEndMillis() - result.getStartMillis();
        TestRunnerMessageHelper.testFailed(result.getTestClass().getName() + "#" + result.getName(),
                result.getThrowable(), duration);
    }

    @Override
    public void onTestSkipped(ITestResult result) {
        final Throwable throwable = result.getThrowable();
        if (throwable != null) {
            onTestFailure(result);
            return;
        }
        TestRunnerMessageHelper.testIgnored(result.getTestClass().getName() + "#" + result.getName());
    }

    @Override
    public void onTestFailedButWithinSuccessPercentage(ITestResult result) {
        onTestFailure(result);
    }

    @Override
    public void onStart(ITestContext context) {
    }

    @Override
    public void onFinish(ITestContext context) {
    }

    @Override
    public void onStart(ISuite suite) {
    }

    @Override
    public void onFinish(ISuite suite) {
        final ITestContext context = getFirst(suite.getResults().values()).getTestContext(); // Can only be one
        TestRunnerMessageHelper.testRunFinished(context.getAllTestMethods().length, context.getFailedTests().size(),
                context.getSkippedTests().size());
    }

    private static <T> T getFirst(Collection<T> collection) {
        for (final T entry : collection) {
            return entry;
        }
        return null;
    }

}
