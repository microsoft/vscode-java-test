/*******************************************************************************
* Copyright (c) 2017, 2018 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.handler;

import com.microsoft.java.test.plugin.util.ProjectInfoFetcher;
import com.microsoft.java.test.plugin.util.ProjectUtils;
import com.microsoft.java.test.plugin.util.RuntimeClassPathUtils;
import com.microsoft.java.test.plugin.util.TestSearchUtils;

import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.ls.core.internal.IDelegateCommandHandler;

import java.util.List;

@SuppressWarnings("restriction")
public class TestDelegateCommandHandler implements IDelegateCommandHandler {

    private static final String GET_TEST_SOURCE_PATH = "vscode.java.test.get.testpath";
    private static final String COMPUTE_RUNTIME_CLASSPATH = "vscode.java.test.runtime.classpath";
    private static final String GET_PROJECT_INFO = "vscode.java.test.project.info";
    private static final String SEARCH_TEST_ITEMS = "vscode.java.test.search.items";
    private static final String SEARCH_TEST_ALL_ITEMS = "vscode.java.test.search.items.all";
    private static final String SEARCH_TEST_CODE_LENS = "vscode.java.test.search.codelens";
    private static final String SEARCH_TEST_LOCATION = "vscode.java.test.search.location";

    @Override
    public Object executeCommand(String commandId, List<Object> arguments, IProgressMonitor monitor) throws Exception {

        switch (commandId) {
            case GET_TEST_SOURCE_PATH:
                return ProjectUtils.getTestSourcePaths(arguments, monitor);
            case COMPUTE_RUNTIME_CLASSPATH:
                return RuntimeClassPathUtils.resolveRuntimeClassPath(arguments);
            case GET_PROJECT_INFO:
                return ProjectInfoFetcher.getProjectInfo(arguments);
            case SEARCH_TEST_ITEMS:
                return TestSearchUtils.searchTestItems(arguments, monitor);
            case SEARCH_TEST_ALL_ITEMS:
                return TestSearchUtils.searchAllTestItems(arguments, monitor);
            case SEARCH_TEST_CODE_LENS:
                return TestSearchUtils.searchCodeLens(arguments, monitor);
            case SEARCH_TEST_LOCATION:
                return TestSearchUtils.searchLocation(arguments, monitor);
            default:
                throw new UnsupportedOperationException(
                        String.format("Java test plugin doesn't support the command '%s'.", commandId));
        }
    }
}
