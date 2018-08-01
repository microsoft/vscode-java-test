package com.microsoft.java.test.runner;

import java.io.PrintStream;

import com.google.gson.Gson;

public class TestOutputSream implements TestStream {
    private final PrintStream out;
    private final PrintStream err;
    private static final TestOutputSream instance = new TestOutputSream();

    TestOutputSream() {
        this.out = System.out;
        this.err = System.err;
    }
    
    public static TestOutputSream Instance() {
        return instance;
    }

    @Override
    public void print(TestReportItem item) {
        String content = ToJson(item);
        if (item.type == TestReportType.Error) {
            this.err.print(content);
        } else {
            this.out.print(content);
        }
    }

    @Override
    public void flush() {
        this.out.flush();
        this.err.flush();
    }

    @Override
    public void println(TestReportItem item) {
        String content = ToJson(item);
        if (item.type == TestReportType.Error) {
            this.err.println(content);
        } else {
            this.out.println(content);
        }
    }
    
    private static String ToJson(TestReportItem item) {
        Gson gson = new Gson();
        String jsonStr = gson.toJson(item);
        return jsonStr.length() + jsonStr;
    }
}
