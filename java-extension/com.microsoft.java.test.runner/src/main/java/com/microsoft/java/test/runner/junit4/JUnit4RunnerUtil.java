/*
 * Copyright (c) 2012-2017 Red Hat, Inc.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

package com.microsoft.java.test.runner.junit4;

import com.microsoft.java.test.runner.common.TestMessageItem;
import com.microsoft.java.test.runner.common.TestOutputStream;

import org.junit.runner.Request;
import org.junit.runner.Runner;

import java.util.LinkedList;
import java.util.List;

import static java.util.Collections.emptyList;

/** Utility class for building test executing request. */
public class JUnit4RunnerUtil {
    /**
     * Build list of {@clink JUnit4TestReference}.
     *
     * @param suites array of test classes or test method (if args.length == 1) to execute
     * @return list of {@link JUnit4TestReference}
     */
    private static TestOutputStream stream = TestOutputStream.instance();

    public static List<JUnit4TestReference> createTestReferences(String[] suites) {
        if (suites.length == 0) {
            return emptyList();
        }

        final List<JUnit4TestReference> referencesList = new LinkedList<>();
        for (final String suite : suites) {
            final int separatorIndex = suite.indexOf('#');
            final JUnit4TestReference reference = separatorIndex == -1 ? getRequestForClass(suite)
                    : getRequestForOneMethod(suite, separatorIndex);
            if (reference != null) {
                referencesList.add(reference);
            }
        }

        return referencesList;
    }

    private static JUnit4TestReference getRequestForOneMethod(String suite, int separatorIndex) {
        try {
            final Class<?> suiteClass = Class.forName(suite.substring(0, separatorIndex), false,
                    JUnit4RunnerUtil.class.getClassLoader());
            final String method = suite.substring(separatorIndex + 1);
            final Request request = Request.method(suiteClass, method);
            final Runner runner = request.getRunner();
            return new JUnit4TestReference(runner, runner.getDescription());
        } catch (final ClassNotFoundException e) {
            final String message = String.format("No test found to run for suite %s. Details: %s.", suite,
                    e.getMessage());
            stream.println(new TestMessageItem(message, e));
            return null;
        }
    }

    private static JUnit4TestReference getRequestForClass(String suite) {
        try {
            final Request request = Request.aClass(Class.forName(suite, false,
                    JUnit4RunnerUtil.class.getClassLoader()));
            final Runner runner = request.getRunner();
            return new JUnit4TestReference(runner, runner.getDescription());
        } catch (final ClassNotFoundException e) {
            final String message = String.format("No test found to run for suite %s. Details: %s.", suite,
                    e.getMessage());
            stream.println(new TestMessageItem(message, e));
            return null;
        }
    }
}
