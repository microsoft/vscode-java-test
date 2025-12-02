/*******************************************************************************
 * Copyright (c) 2021 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.provider;

import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.util.JUnitPlugin;

import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.internal.junit.util.CoreTestSearchEngine;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

public class TestKindProvider {
    private static Map<IJavaProject, List<TestKind>> map = new HashMap<>();
    private static final String JUNIT4_TEST = "org.junit.Test";
    private static final String JUNIT5_TEST = "org.junit.jupiter.api.Test";
    private static final String TESTNG_TEST = "org.testng.annotations.Test";

    public static void updateTestKinds(IJavaProject javaProject) {
        map.put(javaProject, getTestKinds(javaProject));
    }

    public static List<TestKind> getTestKindsFromCache(IJavaProject javaProject) {
        List<TestKind> kinds = map.get(javaProject);
        if (kinds == null) {
            kinds = getTestKinds(javaProject);
            map.put(javaProject, kinds);
        }
        return kinds;
    }

    private static List<TestKind> getTestKinds(IJavaProject javaProject) {
        final List<TestKind> result = new LinkedList<>();
        try {
            // Check for JUnit 6 first using Eclipse JDT's built-in detection
            if (CoreTestSearchEngine.hasJUnit6TestAnnotation(javaProject)) {
                result.add(TestKind.JUnit6);
            } else if (CoreTestSearchEngine.hasJUnit5TestAnnotation(javaProject)) {
                result.add(TestKind.JUnit5);
            }

            if (javaProject.findType(JUNIT4_TEST) != null) {
                result.add(TestKind.JUnit);
            }

            if (javaProject.findType(TESTNG_TEST) != null) {
                result.add(TestKind.TestNG);
            }
        } catch (JavaModelException e) {
            JUnitPlugin.logError("failed to find the test kinds from project: " + javaProject.getElementName());
        }
        return result;
    }
}
