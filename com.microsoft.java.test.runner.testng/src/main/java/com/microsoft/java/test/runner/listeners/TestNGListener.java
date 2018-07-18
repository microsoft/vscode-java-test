package com.microsoft.java.test.runner.listeners;

import java.io.PrintStream;

import com.microsoft.java.test.runner.TestingMessageHelper;

import org.testng.IClassListener;
import org.testng.ISuite;
import org.testng.ISuiteListener;
import org.testng.ITestClass;
import org.testng.ITestContext;
import org.testng.ITestListener;
import org.testng.ITestResult;

/**
 * @author Aigensberger Christoph
 */
public class TestNGListener implements ISuiteListener, ITestListener, IClassListener {
    private final PrintStream out;

    public TestNGListener() {
        this.out = System.out;
        TestingMessageHelper.reporterAttached(out);
    }

    @Override
    public void onStart(ISuite suite) {
        
    }

    @Override
    public void onFinish(ISuite suite) {
        TestingMessageHelper.testRunFinished(out, suite);
    }

    // -- IClassListener

    @Override
    public void onAfterClass(ITestClass testClass) {
        TestingMessageHelper.testSuiteStarted(out, testClass);
    }

    @Override
    public void onBeforeClass(ITestClass testClass) {
        TestingMessageHelper.testSuiteFinished(out, testClass.getName());
    }

    // -- ITestListener

    @Override
    public void onFinish(ITestContext context) {
        TestingMessageHelper.suiteTreeNodeStarted(out, context);
    }

    @Override
    public void onStart(ITestContext context) {
        TestingMessageHelper.suiteTreeNodeEnded(out, context);
    }

    @Override
    public void onTestFailedButWithinSuccessPercentage(ITestResult result) {
        onTestFailure(result);
    }

    @Override
    public void onTestFailure(ITestResult result) {
        long duration = result.getEndMillis() - result.getStartMillis();
        TestingMessageHelper.testFinished(out, result, duration);
        TestingMessageHelper.testFailed(out, result, duration);
    }

    @Override
    public void onTestSkipped(ITestResult result) {
        TestingMessageHelper.testIgnored(out, result.getName());
    }

    @Override
    public void onTestStart(ITestResult result) {
        TestingMessageHelper.testStarted(out, result);
    }

    @Override
    public void onTestSuccess(ITestResult result) {
        long duration = result.getEndMillis() - result.getStartMillis();
        TestingMessageHelper.testFinished(out, result, duration);
    }
}