/*
 * Copyright 2015-2018 the original author or authors.
 *
 * All rights reserved. This program and the accompanying materials are
 * made available under the terms of the Eclipse Public License v2.0 which
 * accompanies this distribution and is available at
 *
 * http://www.eclipse.org/legal/epl-v20.html
 */

package com.microsoft.java.test.runner.junit5;

import com.microsoft.java.test.runner.common.ITestLauncher;

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
             return 1;
         }
    }
}
