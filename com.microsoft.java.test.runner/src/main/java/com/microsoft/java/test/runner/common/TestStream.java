package com.microsoft.java.test.runner.common;

public interface TestStream {
    void print(TestMessageItem item);

    void println(TestMessageItem item);

    void flush();
}
