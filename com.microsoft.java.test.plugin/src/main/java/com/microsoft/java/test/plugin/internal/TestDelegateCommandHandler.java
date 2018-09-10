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

package com.microsoft.java.test.plugin.internal;

import java.util.Collections;
import java.util.List;

import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.ls.core.internal.IDelegateCommandHandler;

import com.google.gson.Gson;
import com.microsoft.java.test.plugin.internal.searcher.TestSearchUtility;
import com.microsoft.java.test.plugin.internal.searcher.model.SearchRequest;
import com.microsoft.java.test.plugin.internal.testsuit.TestSuite;

public class TestDelegateCommandHandler implements IDelegateCommandHandler {

    private static final String FETCH_TEST = "vscode.java.test.fetch";
    private static final String COMPUTE_RUNTIME_CLASSPATH = "vscode.java.test.runtime.classpath";
    private static final String GET_PROJECT_INFO = "vscode.java.test.project.info";
    private static final String SEARCH_TEST_ENTRY = "vscode.java.test.search.entries";

    private static final JUnitTestSearcher[] Searchers = new JUnitTestSearcher[] {
            new JUnit4TestSearcher(),
            new JUnit5TestSearcher(),
    };

    @Override
    public Object executeCommand(String commandId, List<Object> arguments, IProgressMonitor monitor) throws Exception {

        switch (commandId) {
        case FETCH_TEST:
            return new JUnitTestFetcher().fetchTests(arguments, monitor);
        case COMPUTE_RUNTIME_CLASSPATH:
            return new RuntimeClassPathResolver().resolveRunTimeClassPath(arguments);
        case GET_PROJECT_INFO:
            return ProjectInfoFetcher.getProjectInfo(arguments);
        case SEARCH_TEST_ENTRY:
            if (arguments == null || arguments.size() == 0) {
                return Collections.<TestSuite>emptyList();
            }
            final Gson gson = new Gson();
            final SearchRequest request = gson.fromJson((String) arguments.get(0), SearchRequest.class);
            return TestSearchUtility.searchTestEntries(request, monitor);
        default:
            throw new UnsupportedOperationException(String.format("Java test plugin doesn't support the command '%s'.", commandId));
        }
    }
}
