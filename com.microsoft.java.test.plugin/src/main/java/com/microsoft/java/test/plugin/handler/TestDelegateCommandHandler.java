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

import com.microsoft.java.test.plugin.searcher.JUnitTestFetcher;
import com.microsoft.java.test.plugin.util.ProjectInfoFetcher;
import com.microsoft.java.test.plugin.util.RuntimeClassPathResolver;

import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.ls.core.internal.IDelegateCommandHandler;

import java.util.List;

@SuppressWarnings("restriction")
public class TestDelegateCommandHandler implements IDelegateCommandHandler {

    private static final String FETCH_TEST = "vscode.java.test.fetch";
    private static final String COMPUTE_RUNTIME_CLASSPATH = "vscode.java.test.runtime.classpath";
    private static final String GET_PROJECT_INFO = "vscode.java.test.project.info";

    @Override
    public Object executeCommand(String commandId, List<Object> arguments, IProgressMonitor monitor) throws Exception {

        switch (commandId) {
        case FETCH_TEST:
            return new JUnitTestFetcher().fetchTests(arguments, monitor);
        case COMPUTE_RUNTIME_CLASSPATH:
            return new RuntimeClassPathResolver().resolveRunTimeClassPath(arguments);
        case GET_PROJECT_INFO:
            return ProjectInfoFetcher.getProjectInfo(arguments);
        default:
            throw new UnsupportedOperationException(String.format("Java test plugin doesn't support the command '%s'.", commandId));
        }
    }
}
