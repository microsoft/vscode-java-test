/*******************************************************************************
* Copyright (c) 2018 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.runner.junit5;

import com.microsoft.java.test.runner.common.MessageUtils;
import com.microsoft.java.test.runner.common.Pair;
import com.microsoft.java.test.runner.common.TestMessageConstants;
import com.microsoft.java.test.runner.common.TestOutputStream;

import org.junit.platform.engine.TestExecutionResult;
import org.junit.platform.launcher.TestExecutionListener;
import org.junit.platform.launcher.TestIdentifier;
import org.junit.platform.launcher.TestPlan;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class TestResultListener implements TestExecutionListener {
    private final Clock clock;
    private final Map<TestIdentifier, Instant> startInstants = new ConcurrentHashMap<>();
    private final Map<TestIdentifier, Instant> endInstants = new ConcurrentHashMap<>();

    public TestResultListener() {
        this.clock = Clock.systemDefaultZone();
    }

    @Override
    public void testPlanExecutionStarted(TestPlan testPlan) {
    }

    @Override
    public void testPlanExecutionFinished(TestPlan testPlan) {
    }

    @Override
    public void executionStarted(TestIdentifier testIdentifier) {
        this.startInstants.put(testIdentifier, this.clock.instant());
        TestOutputStream.instance()
                .println(MessageUtils.create(TestMessageConstants.TEST_STARTED,
                        new Pair(TestMessageConstants.ID, testIdentifier.getUniqueId()),
                        new Pair(TestMessageConstants.TYPE, testIdentifier.getType().toString())));
    }

    @Override
    public void executionSkipped(TestIdentifier testIdentifier, String reason) {
        TestOutputStream.instance()
                .println(MessageUtils.create(TestMessageConstants.TEST_IGNORED,
                        new Pair(TestMessageConstants.ID, testIdentifier.getUniqueId()),
                        new Pair(TestMessageConstants.TYPE, testIdentifier.getType().toString()),
                        new Pair(TestMessageConstants.TRACE, reason)));
    }

    @Override
    public void executionFinished(TestIdentifier testIdentifier, TestExecutionResult result) {
        this.endInstants.put(testIdentifier, this.clock.instant());
        String detailMsg = "";

        final Optional<Throwable> throwable = result.getThrowable();
        if (throwable.isPresent()) {
            final StringWriter writer = new StringWriter();
            final PrintWriter printWriter = new PrintWriter(writer);
            throwable.get().printStackTrace(printWriter);
            detailMsg = writer.getBuffer().toString();
        }

        TestOutputStream.instance()
                .println(MessageUtils.create(TestMessageConstants.TEST_FINISHED,
                        new Pair(TestMessageConstants.ID, testIdentifier.getUniqueId()),
                        new Pair(TestMessageConstants.TYPE, testIdentifier.getType().toString()),
                        new Pair(TestMessageConstants.DURATION, String.valueOf(getDuration(testIdentifier))),
                        new Pair(TestMessageConstants.STATUS, result.getStatus().toString()),
                        new Pair(TestMessageConstants.TRACE, detailMsg)));

    }

    private long getDuration(TestIdentifier testIdentifier) {
        final Instant startInstant = this.startInstants.getOrDefault(testIdentifier, Instant.EPOCH);
        final Instant endInstant = this.endInstants.getOrDefault(testIdentifier, startInstant);
        return Duration.between(startInstant, endInstant).toMillis();
    }
}
