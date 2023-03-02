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

import org.testng.IConfigurationListener;
import org.testng.ISuite;
import org.testng.ISuiteListener;
import org.testng.ITestContext;
import org.testng.ITestListener;
import org.testng.ITestNGListener;
import org.testng.ITestResult;

public class TestNGListener
        implements ISuiteListener, ITestListener, ITestNGListener, IConfigurationListener {
    private ITestResult lastConfigFailure = null;

    @Override
    public void onTestStart(ITestResult result) {
        TestRunnerMessageHelper.testStarted(createTestName(result));
    }

    @Override
    public void onTestSuccess(ITestResult result) {
        final long duration = result.getEndMillis() - result.getStartMillis();
        TestRunnerMessageHelper.testFinished(createTestName(result), duration);
    }

    @Override
    public void onTestFailure(ITestResult result) {
        final long duration = result.getEndMillis() - result.getStartMillis();
        TestRunnerMessageHelper.testFailed(createTestName(result),
                result.getThrowable(), duration);
    }

    @Override
    public void onTestSkipped(ITestResult result) {
        final Throwable throwable = result.getThrowable();
        if (throwable != null) {
            onTestFailure(result);
            return;
        } else if (this.lastConfigFailure != null) {
            result.setThrowable(this.lastConfigFailure.getThrowable());
            result.setStatus(this.lastConfigFailure.getStatus());
            this.lastConfigFailure = null;

            onTestFailure(result);
            return;
        }
        TestRunnerMessageHelper.testIgnored(createTestName(result));
    }

    @Override
    public void onTestFailedButWithinSuccessPercentage(ITestResult result) {
        onTestFailure(result);
    }

    private String createTestName(ITestResult result) {
        final String className = result.getTestClass().getName();
        final String methodName = result.getMethod().getMethodName();
        final StringBuilder params = new StringBuilder();

        for (final Class<?> paramClazz : result.getMethod().getConstructorOrMethod().getMethod().getParameterTypes()) {
            params.append(paramClazz.getSimpleName().replaceAll("<.*?>", ""));
            params.append(",");
        }

        // Remove the last ", "
        if (params.length() > 0) {
            params.delete(params.length() - 1, params.length());
        }

        return className + "#" + methodName + "(" + params.toString() + ")";
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
    }

    @Override
    public void onConfigurationSuccess(ITestResult itr) {
    }

    @Override
    public void onConfigurationFailure(ITestResult result) {
        this.lastConfigFailure = result;
    }

    @Override
    public void onConfigurationSkip(ITestResult result) {
    }
}
