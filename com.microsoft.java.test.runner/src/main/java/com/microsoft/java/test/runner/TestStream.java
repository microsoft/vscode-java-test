package com.microsoft.java.test.runner;

public interface TestStream {
    void print(TestMessageItem item);

    void println(TestMessageItem item);

    void flush();
}
