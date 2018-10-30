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
import com.microsoft.java.test.runner.common.MessageUtils;
import com.microsoft.java.test.runner.common.Pair;
import com.microsoft.java.test.runner.common.TestMessageConstants;
import com.microsoft.java.test.runner.common.TestOutputStream;

import org.junit.platform.console.options.CommandLineOptions;
import org.junit.platform.console.options.CommandLineOptionsParser;
import org.junit.platform.console.options.JOptSimpleCommandLineOptionsParser;

public class CustomizedConsoleLauncher implements ITestLauncher {

    @Override
    public int execute(String[] args) {
        try {
            final CommandLineOptionsParser parser = new JOptSimpleCommandLineOptionsParser();
            final CommandLineOptions options = parser.parse(args);
            return new CustomizedConsoleTestExecutor(options).executeTests();
        } catch (final Exception exception) {
            TestOutputStream.instance().println(MessageUtils.create(TestMessageConstants.TEST_FAILED,
                    new Pair(TestMessageConstants.MESSAGE, exception.getMessage())));
            return 1;
        }
    }
}
