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

public class JUnitLauncher
{
    public static void main(String[] args) {
        try {
            if (args.length == 0) {
                TestingMessageHelper.reporterAttached(System.out);
                System.err.print("No test found to run");
            } else {
                CustomizedJUnitCoreRunner jUnitCore = new CustomizedJUnitCoreRunner();
                jUnitCore.run(args);
            }
        } catch (Throwable e) {
            e.printStackTrace(); // don't allow System.exit(0) to swallow exceptions
        } finally {
            System.exit(0);
        }
    }
}
