/*******************************************************************************
* Copyright (c) 2017 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.runner.junit5;

import org.junit.platform.commons.util.Preconditions;
import org.junit.platform.engine.TestExecutionResult;
import org.junit.platform.launcher.TestExecutionListener;
import org.junit.platform.launcher.TestIdentifier;
import org.junit.platform.launcher.TestPlan;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import java.util.concurrent.ConcurrentHashMap;

public class TestResultListener implements TestExecutionListener {
    private final PrintWriter out;
    private final Clock clock;
    private final Map<TestIdentifier, Instant> startInstants = new ConcurrentHashMap<>();
    private final Map<TestIdentifier, Instant> endInstants = new ConcurrentHashMap<>();
    private static final String NAME = "name";
    private static final String ID = "id";
    private static final String TYPE = "type";
    private static final String DURATION = "duration";
    private static final String STATUS = "status";
    private static final String DETAILS = "details";
    private static final String TESTPLAN_EXECUTION_STARTED = "testPlanStarted";
    private static final String TESTPLAN_EXECUTION_FINISHED = "testPlanFinished";
    private static final String TEST_SKIPPED = "testSkipped";
    private static final String TEST_STARTED = "testStarted";
    private static final String TEST_FINISHED = "testFinished";

    TestResultListener(PrintWriter out) {
        this.out = out;
        this.clock = Clock.systemDefaultZone();
    }

    @Override
    public void testPlanExecutionStarted(TestPlan testPlan) {
        out.println(create(TESTPLAN_EXECUTION_STARTED, new Pair(NAME, testPlan.toString())));
    }

    @Override
    public void testPlanExecutionFinished(TestPlan testPlan) {
        out.println(create(TESTPLAN_EXECUTION_FINISHED, new Pair(NAME, testPlan.toString())));
    }

    @Override
    public void executionSkipped(TestIdentifier testIdentifier, String reason) {
        out.println(create(TEST_SKIPPED, new Pair(ID, testIdentifier.getUniqueId()),
                new Pair(TYPE, testIdentifier.getType().toString()), new Pair(DETAILS, escape(reason))));
    }

    @Override
    public void executionStarted(TestIdentifier testIdentifier) {
        this.startInstants.put(testIdentifier, this.clock.instant());
        out.println(create(TEST_STARTED, new Pair(ID, testIdentifier.getUniqueId()),
                new Pair(TYPE, testIdentifier.getType().toString())));
    }

    @Override
    public void executionFinished(TestIdentifier testIdentifier, TestExecutionResult result) {
        this.endInstants.put(testIdentifier, this.clock.instant());

        out.println(create(TEST_FINISHED, new Pair(ID, testIdentifier.getUniqueId()),
                new Pair(TYPE, testIdentifier.getType().toString()),
                new Pair(DURATION, String.valueOf(getDuration(testIdentifier))),
                new Pair(STATUS, result.getStatus().toString()),
                new Pair(DETAILS, escape(result.getThrowable().map(TestResultListener::readStackTrace).orElse("")))));
    }

    private long getDuration(TestIdentifier testIdentifier) {
        final Instant startInstant = this.startInstants.getOrDefault(testIdentifier, Instant.EPOCH);
        final Instant endInstant = this.endInstants.getOrDefault(testIdentifier, startInstant);
        return Duration.between(startInstant, endInstant).toMillis();
    }

    private static String create(String name, Pair... attributes) {
        List<Pair> pairList = null;
        if (attributes != null) {
            pairList = Arrays.asList(attributes);
        }
        return create(name, pairList);
    }

    private static String create(String name, List<Pair> attributes) {
        final StringBuilder builder = new StringBuilder("@@<{\"name\":");
        builder.append('"').append(name).append('"');
        if (attributes != null) {
            builder.append(", \"attributes\":{");
            final StringJoiner joiner = new StringJoiner(", ");
            for (final Pair attribute : attributes) {
                joiner.add("\"" + attribute.first + "\":\"" + attribute.second + "\"");
            }
            builder.append(joiner.toString());
            builder.append("}");
        }

        builder.append("}>");
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

    private static String readStackTrace(Throwable throwable) {
        Preconditions.notNull(throwable, "Throwable must not be null");
        final StringWriter stringWriter = new StringWriter();
        try (PrintWriter printWriter = new PrintWriter(stringWriter)) {
            throwable.printStackTrace(printWriter);
        }
        return stringWriter.toString();
    }

    private static class Pair {
        final String first;
        final String second;

        Pair(String first, String second) {
            this.first = first;
            this.second = second;
        }
    }
}
