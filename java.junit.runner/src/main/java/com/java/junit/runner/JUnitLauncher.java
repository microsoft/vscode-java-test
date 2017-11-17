package com.java.junit.runner;

public class JUnitLauncher
{
    public static void main(String[] args) {
        if (args.length == 0) {
            TestingMessageHelper.reporterAttached(System.out);
            System.err.print("No test found to run");
        } else {
            CustomizedJUnitCoreRunner jUnitCore = new CustomizedJUnitCoreRunner();
            jUnitCore.run(args);
        }
    }
}
