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

package com.microsoft.java.test.runner;

import com.microsoft.java.test.runner.common.ITestLauncher;
import com.microsoft.java.test.runner.common.TestMessageItem;
import com.microsoft.java.test.runner.common.TestOutputStream;
import com.microsoft.java.test.runner.exceptions.ParameterException;
import com.microsoft.java.test.runner.testng.TestNGLauncher;

import java.io.IOException;
import java.net.Socket;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class Launcher {
    private static final String TESTNG = "testng";
    private static final String LOCAL_HOST = "127.0.0.1";

    private static final Map<String, ITestLauncher> launcherMap;

    static {
        launcherMap = new HashMap<>();
        launcherMap.put(TESTNG, new TestNGLauncher());
    }

    private static final int EXIT_WITH_INVALID_INPUT_CODE = -1;
    private static final int EXIT_WITH_UNKNOWN_EXCEPTION = -2;

    public static void main(String[] args) {
        int exitStatus = 0;
        Socket clientSocket = null;
        try {
            if (args == null || args.length == 0) {
                throw new ParameterException("No arguments provided.");
            }

            final int portNumber = Integer.parseInt(args[0]);
            clientSocket = new Socket(LOCAL_HOST, portNumber);
            TestOutputStream.instance().initialize(clientSocket.getOutputStream());
            final ITestLauncher launcher = launcherMap.get(args[1]);
            if (launcher == null) {
                throw new ParameterException("Unsupported runner type: " + args[1] + ".");
            }

            final String[] params = Arrays.copyOfRange(args, 2, args.length);
            launcher.execute(params);
        } catch (final ParameterException e) {
            exitStatus = EXIT_WITH_INVALID_INPUT_CODE;
            logError("Invalid Parameter.", e);
        } catch (final Throwable e) {
            exitStatus = EXIT_WITH_UNKNOWN_EXCEPTION;
            logError("Exception occured while running tests.", e);
        } finally {
            TestOutputStream.instance().close();
            try {
                if (clientSocket != null) {
                    clientSocket.close();
                }
            } catch (IOException e) {
                // Do nothing
            }
            System.exit(exitStatus);
        }
    }

    private static void logError(String message, Throwable ex) {
        System.err.println(message);
        ex.printStackTrace();
        TestOutputStream.instance().println(new TestMessageItem(message, ex));
    }
}
