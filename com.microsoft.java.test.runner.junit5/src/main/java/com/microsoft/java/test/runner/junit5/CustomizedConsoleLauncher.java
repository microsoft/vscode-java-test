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

import java.io.BufferedWriter;
import java.io.OutputStreamWriter;
import java.io.PrintStream;
import java.io.PrintWriter;
import java.nio.charset.Charset;

import org.junit.platform.console.options.CommandLineOptions;
import org.junit.platform.console.options.CommandLineOptionsParser;
import org.junit.platform.console.options.JOptSimpleCommandLineOptionsParser;

public class CustomizedConsoleLauncher {

    public static void main(String... args) {
        int exitCode = execute(System.out, System.err, args);
        System.exit(exitCode);
    }
    
    public static int execute(PrintStream out, PrintStream err, String... args) {
        CommandLineOptionsParser parser = new JOptSimpleCommandLineOptionsParser();
        CustomizedConsoleLauncher launcher = new CustomizedConsoleLauncher(parser, out, err);
        return launcher.execute(args);
    }

    private final CommandLineOptionsParser commandLineOptionsParser;
    private final PrintStream outStream;
    private final PrintStream errStream;
    private final Charset charset;

    CustomizedConsoleLauncher(CommandLineOptionsParser commandLineOptionsParser, PrintStream out, PrintStream err) {
        this(commandLineOptionsParser, out, err, Charset.defaultCharset());
    }

    CustomizedConsoleLauncher(CommandLineOptionsParser commandLineOptionsParser, PrintStream out, PrintStream err,
            Charset charset) {
        this.commandLineOptionsParser = commandLineOptionsParser;
        this.outStream = out;
        this.errStream = err;
        this.charset = charset;
    }
    
    int execute(String... args) {
        CommandLineOptions options = commandLineOptionsParser.parse(args);
        try (PrintWriter out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(outStream, charset)))) {
            if (options.isDisplayHelp()) {
                return 0;
            }
            return executeTests(options, out);
        }
        finally {
            outStream.flush();
            errStream.flush();
        }
    }
    
    private int executeTests(CommandLineOptions options, PrintWriter out) {
        try {
            return new CustomizedConsoleTestExecutor(options).execute(out);
        }
        catch (Exception exception) {
            exception.printStackTrace(errStream);
            errStream.println();
        }
        return 1;
    }
}
