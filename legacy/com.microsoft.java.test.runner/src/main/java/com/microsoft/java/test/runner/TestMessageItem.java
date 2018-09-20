package com.microsoft.java.test.runner;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Arrays;
import java.util.List;

public class TestMessageItem {
    String name;

    List<Pair> attributes;
    
    TestMessageType type;

    public TestMessageItem(TestMessageType type, String name, List<Pair> attributes) {
        this.type = type;
        this.name = name;
        this.attributes = attributes;
    }

    public TestMessageItem(TestMessageType type, String name, Pair... attributes) {
        this(type, name, attributes != null ? Arrays.asList(attributes) : null);
    }

    public TestMessageItem(String message, Throwable e) {
        this(
                TestMessageType.Error,
                TestMessageConstants.TEST_RUNNER_ERROR,
                new Pair(TestMessageConstants.MESSAGE, message),
                new Pair(TestMessageConstants.DETAILS, getStacktrace(e)));
    }

    private static String getStacktrace(Throwable throwable) {
        StringWriter errors = new StringWriter();
        throwable.printStackTrace(new PrintWriter(errors));
        return errors.toString();
    }
}
