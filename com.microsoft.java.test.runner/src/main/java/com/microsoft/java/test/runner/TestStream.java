package com.microsoft.java.test.runner;

public interface TestStream {
    void print(TestReportItem item);
    void println(TestReportItem item);
    void flush();
}
