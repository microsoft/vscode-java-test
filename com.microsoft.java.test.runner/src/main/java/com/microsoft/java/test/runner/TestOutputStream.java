package com.microsoft.java.test.runner;

import java.io.PrintStream;
import java.util.StringJoiner;

public class TestOutputStream implements TestStream {
    private final PrintStream out;
    private final PrintStream err;
    private static final TestOutputStream instance = new TestOutputStream();

    private TestOutputStream() {
        this.out = System.out;
        this.err = System.err;
    }

    public static TestOutputStream instance() {
        return instance;
    }

    @Override
    public void print(TestMessageItem item) {
        final String content = toJson(item);
        if (item.type == TestMessageType.Error) {
            this.err.print(content);
        } else {
            this.out.print(content);
        }
    }

    @Override
    public void println(TestMessageItem item) {
        final String content = toJson(item);
        if (item.type == TestMessageType.Error) {
            this.err.println(content);
        } else {
            this.out.println(content);
        }
    }

    @Override
    public void flush() {
        this.out.flush();
        this.err.flush();
    }

    private static String toJson(TestMessageItem item) {
        final StringBuilder builder = new StringBuilder("@@<TestRunner-{\"name\":");
        builder.append('"').append(item.name).append('"');
        if (item.attributes != null) {
            builder.append(", \"attributes\":{");
            final StringJoiner joiner = new StringJoiner(", ");
            for (final Pair attribute : item.attributes) {
                joiner.add("\"" + attribute.first + "\":\"" + escape(attribute.second) + "\"");
            }
            builder.append(joiner.toString());
            builder.append("}");
        }

        builder.append("}-TestRunner>");
        return builder.toString();
    }

    private static String escape(String str) {
        if (str == null) {
            return str;
        }
        final int len = str.length();
        final StringBuilder sb = new StringBuilder(len);
        String t;
        for (int i = 0; i < len; i += 1) {
            final char c = str.charAt(i);
            switch (c) {
                case '\\':
                case '\"':
                    sb.append('\\');
                    sb.append(c);
                    break;
                case '\b':
                    sb.append("\\b");
                    break;
                case '\t':
                    sb.append("\\t");
                    break;
                case '\n':
                    sb.append("\\n");
                    break;
                case '\f':
                    sb.append("\\f");
                    break;
                case '\r':
                    sb.append("\\r");
                    break;
                case '@':
                    sb.append("&#x40;");
                    break;
                default:
                    if (c < ' ') {
                        t = "000" + Integer.toHexString(c);
                        sb.append("\\u" + t.substring(t.length() - 4));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }
}
