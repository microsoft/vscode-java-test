/*******************************************************************************
* Copyright (c) 2017-2021 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.handler;

import com.microsoft.java.test.plugin.launchers.JUnitLaunchUtils;
import com.microsoft.java.test.plugin.util.ProjectTestUtils;
import com.microsoft.java.test.plugin.util.TestGenerationUtils;
import com.microsoft.java.test.plugin.util.TestNavigationUtils;
import com.microsoft.java.test.plugin.util.TestSearchUtils;

import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.jdt.ls.core.internal.IDelegateCommandHandler;

import java.util.List;

@SuppressWarnings("restriction")
public class TestDelegateCommandHandler implements IDelegateCommandHandler {

    private static final String GET_TEST_SOURCE_PATH = "vscode.java.test.get.testpath";
    private static final String RESOLVE_JUNIT_ARGUMENT = "vscode.java.test.junit.argument";
    private static final String GENERATE_TESTS = "vscode.java.test.generateTests";
    private static final String FIND_JAVA_PROJECT = "vscode.java.test.findJavaProjects";
    private static final String FIND_PACKAGES_AND_TYPES = "vscode.java.test.findTestPackagesAndTypes";
    private static final String FIND_DIRECT_CHILDREN_FOR_CLASS = "vscode.java.test.findDirectTestChildrenForClass";
    private static final String FIND_TYPES_AND_METHODS = "vscode.java.test.findTestTypesAndMethods";
    private static final String RESOLVE_PATH = "vscode.java.test.resolvePath";
    private static final String FIND_TEST_LOCATION = "vscode.java.test.findTestLocation";
    private static final String NAVIGATE_TO_TEST_OR_TARGET = "vscode.java.test.navigateToTestOrTarget";

    @Override
    public Object executeCommand(String commandId, List<Object> arguments, IProgressMonitor monitor) throws Exception {
        if (monitor == null) {
            monitor = new NullProgressMonitor();
        }

        switch (commandId) {
            case GET_TEST_SOURCE_PATH:
                return ProjectTestUtils.listTestSourcePaths(arguments, monitor);
            case RESOLVE_JUNIT_ARGUMENT:
                return JUnitLaunchUtils.resolveLaunchArgument(arguments, monitor);
            case GENERATE_TESTS:
                return TestGenerationUtils.generateTests(arguments, monitor);
            case FIND_JAVA_PROJECT:
                return TestSearchUtils.findJavaProjects(arguments, monitor);
            case FIND_PACKAGES_AND_TYPES:
                return TestSearchUtils.findTestPackagesAndTypes(arguments, monitor);
            case FIND_DIRECT_CHILDREN_FOR_CLASS:
                return TestSearchUtils.findDirectTestChildrenForClass(arguments, monitor);
            case FIND_TYPES_AND_METHODS:
                return TestSearchUtils.findTestTypesAndMethods(arguments, monitor);
            case RESOLVE_PATH:
                return TestSearchUtils.resolvePath(arguments, monitor);
            case FIND_TEST_LOCATION:
                return TestSearchUtils.findTestLocation(arguments, monitor);
            case NAVIGATE_TO_TEST_OR_TARGET:
                return TestNavigationUtils.findTestOrTarget(arguments, monitor);
            default:
                throw new UnsupportedOperationException(
                        String.format("Java test plugin doesn't support the command '%s'.", commandId));
        }
    }
}
