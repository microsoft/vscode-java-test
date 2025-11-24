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

import org.eclipse.core.runtime.CoreException;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.launching.IVMInstall;
import org.eclipse.jdt.launching.IVMInstall2;
import org.eclipse.jdt.launching.JavaRuntime;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
            if (javaProject.findType(JUNIT5_TEST) != null) {
                if (isJUnit6(javaProject)) {
                    result.add(TestKind.JUnit6);
                } else {
                    result.add(TestKind.JUnit5);
                }
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

    private static boolean isJUnit6(IJavaProject project) {
        if (!isJava17OrHigher(project)) {
            return false;
        }
        return isJUnitJupiterApiVersion6OrHigher(project);
    }

    private static boolean isJava17OrHigher(IJavaProject project) {
        try {
            final IVMInstall vm = JavaRuntime.getVMInstall(project);
            if (vm instanceof IVMInstall2) {
                final String javaVersion = ((IVMInstall2) vm).getJavaVersion();
                if (javaVersion != null) {
                    return getMajorVersion(javaVersion) >= 17;
                }
            }
        } catch (CoreException e) {
            // ignore
        }
        return false;
    }

    private static int getMajorVersion(String version) {
        if (version.startsWith("1.")) {
            return Integer.parseInt(version.substring(2, 3));
        }
        final int dot = version.indexOf('.');
        if (dot != -1) {
            return Integer.parseInt(version.substring(0, dot));
        }
        try {
            return Integer.parseInt(version);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static boolean isJUnitJupiterApiVersion6OrHigher(IJavaProject project) {
        try {
            for (final IClasspathEntry entry : project.getResolvedClasspath(true)) {
                if (entry.getPath().lastSegment().contains("junit-jupiter-api")) {
                    final String fileName = entry.getPath().lastSegment();
                    final Matcher m = Pattern.compile("junit-jupiter-api-(\\d+)\\.").matcher(fileName);
                    if (m.find()) {
                        final int major = Integer.parseInt(m.group(1));
                        if (major >= 6) {
                            return true;
                        }
                    }
                }
            }
        } catch (JavaModelException e) {
            // ignore
        }
        return false;
    }
}
