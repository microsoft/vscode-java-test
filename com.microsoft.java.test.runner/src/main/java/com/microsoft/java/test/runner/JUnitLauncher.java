/*
 * Copyright (c) 2012-2017 Red Hat, Inc.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */
package com.microsoft.java.test.runner;

public class JUnitLauncher {
    public static void main(String[] args) {
        System.exit(execute(args));
    }

    private static int execute(String[] args) {
        try {
            if (args.length == 0) {
                TestingMessageHelper.reporterAttached(System.out);
                System.err.print("No test found to run");
            } else {
                CustomizedJUnitCoreRunner jUnitCore = new CustomizedJUnitCoreRunner();
                jUnitCore.run(args);
            }
            return 0;
        } catch (Throwable e) {
            e.printStackTrace();
            return 1;
        } finally {
            System.err.flush();
            System.out.flush();
        }
    }
}
