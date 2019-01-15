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

import com.microsoft.java.test.runner.common.ITestLauncher;
import com.microsoft.java.test.runner.common.TestMessageItem;
import com.microsoft.java.test.runner.common.TestOutputStream;

import org.junit.platform.console.options.CommandLineOptions;
import org.junit.platform.console.options.CommandLineOptionsParser;
import org.junit.platform.console.options.PicocliCommandLineOptionsParser;

public class CustomizedConsoleLauncher implements ITestLauncher {

    @Override
    public void execute(String[] args) {
        try {
            final CommandLineOptionsParser parser = new PicocliCommandLineOptionsParser();
            final CommandLineOptions options = parser.parse(args);
            new CustomizedConsoleTestExecutor(options).executeTests();
        } catch (final Exception ex) {
            TestOutputStream.instance().println(new TestMessageItem("Failed to run Junit tests", ex));
        }
    }
}
