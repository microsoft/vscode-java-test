package com.microsoft.java.test.runner;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Map;

public class TestReportItem {
    String phase;

    Map<String, String> attributes;

    String message;

    String stackTrace;
    
    TestReportType type;

    public TestReportItem(TestReportType type, String phase, Map<String, String> attributes, String message, Throwable throwable) {
        this.type = type;
        this.phase = phase;
        this.attributes = attributes;
        this.message = message;
        if (throwable != null) {
            this.stackTrace = this.getStacktrace(throwable);
        }
    }

    private String getStacktrace(Throwable throwable) {
        StringWriter errors = new StringWriter();
        throwable.printStackTrace(new PrintWriter(errors));
        return errors.toString();
    }
}
