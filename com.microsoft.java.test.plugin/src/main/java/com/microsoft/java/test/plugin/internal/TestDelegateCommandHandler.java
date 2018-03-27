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

package com.microsoft.java.test.plugin.internal;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.ls.core.internal.IDelegateCommandHandler;

import com.microsoft.java.test.plugin.internal.testsuit.TestSuite;

public class TestDelegateCommandHandler implements IDelegateCommandHandler {

    public static String FETCH_TEST = "vscode.java.test.fetch";
    public static String SEARCH_ALL_TEST = "vscode.java.test.search.all";
    public static String COMPUTE_RUNTIME_CLASSPATH = "vscode.java.test.runtime.classpath";
    public static String GET_PROJECT_INFO = "vscode.java.test.project.info";
    private static final JUnitTestSearcher[] Searchers = new JUnitTestSearcher[] {
            new JUnit4TestSearcher(),
            new JUnit5TestSearcher(),
    };

    @Override
    public Object executeCommand(String commandId, List<Object> arguments, IProgressMonitor monitor) throws Exception {
        if (FETCH_TEST.equals(commandId)) {
            return new JUnitTestFetcher().fetchTests(arguments, monitor);
        } else if (COMPUTE_RUNTIME_CLASSPATH.equals(commandId)) {
        	return new RuntimeClassPathResolver().resolveRunTimeClassPath(arguments);
        } else if (SEARCH_ALL_TEST.equals(commandId)) {
            List<TestSuite> res = new ArrayList<>();
            for (JUnitTestSearcher searcher : Searchers) {
                if (monitor.isCanceled()) {
                    return Collections.emptyList();
                }
                searcher.searchAllTests(res, monitor);
            }
        	return res;
        } else if (GET_PROJECT_INFO.equals(commandId)) {
            return new ProjectInfoFetcher().getProjectInfo(arguments);
        }
        throw new UnsupportedOperationException(String.format("Java test plugin doesn't support the command '%s'.", commandId));
    }

}
