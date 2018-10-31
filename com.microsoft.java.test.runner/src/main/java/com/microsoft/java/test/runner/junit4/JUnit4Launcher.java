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

package com.microsoft.java.test.runner.junit4;

import com.microsoft.java.test.runner.common.ITestLauncher;
import com.microsoft.java.test.runner.common.TestMessageItem;
import com.microsoft.java.test.runner.common.TestOutputStream;
import com.microsoft.java.test.runner.common.TestRunnerMessageHelper;

public class JUnit4Launcher implements ITestLauncher {

    @Override
    public void execute(String[] args) {
        final TestOutputStream stream = TestOutputStream.instance();
        try {
            if (args.length == 0) {
                TestRunnerMessageHelper.reporterAttached();
                stream.println(new TestMessageItem("No test found to run", null));
            } else {
                final CustomizedJUnit4CoreRunner jUnitCore = new CustomizedJUnit4CoreRunner();
                jUnitCore.run(args);
            }
        } catch (final Exception ex) {
            stream.println(new TestMessageItem("Failed to run Junit tests", ex));
        }
    }
}
