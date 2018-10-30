package com.microsoft.java.test.runner.testng;

import com.microsoft.java.test.runner.common.TestRunnerMessageHelper;

import org.testng.ISuite;
import org.testng.ISuiteListener;
import org.testng.ITestContext;
import org.testng.ITestListener;
import org.testng.ITestResult;

import java.util.Collection;

public class TestNGListener implements ISuiteListener, ITestListener {

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
