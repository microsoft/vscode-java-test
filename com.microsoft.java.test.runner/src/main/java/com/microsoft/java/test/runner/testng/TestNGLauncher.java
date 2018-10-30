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

package com.microsoft.java.test.runner.testng;

import com.microsoft.java.test.runner.common.ITestLauncher;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TestNGLauncher implements ITestLauncher {

    @Override
    public int execute(String[] args) throws ClassNotFoundException  {
        if (args == null || args.length == 0) {
            throw new RuntimeException("No test found to run.");
        }
        final TestNGRunner runner = new TestNGRunner();
        runner.run(parse(args));
        return 0;
    }

    private Map<String, List<String>> parse(String[] args) throws ClassNotFoundException {
        final Map<String, List<String>> classToMethodsMap = new HashMap<>();
        for (final String arg : args) {
            if (arg.indexOf("#") >= 0) {
                // The test target is a method
                classToMethodsMap.computeIfAbsent(getClassNameFromMethod(arg), e -> new ArrayList<>())
                        .add(getMethodName(arg));
            } else {
                classToMethodsMap.put(getClassName(arg), new ArrayList<>());
            }
        }
        return classToMethodsMap;
    }

    private static String getClassName(String clazz) throws ClassNotFoundException {
        return Class.forName(clazz).getCanonicalName();
    }

    private static String getClassNameFromMethod(String clazz) throws ClassNotFoundException {
        return Class.forName(clazz.substring(0, clazz.lastIndexOf("#"))).getCanonicalName();
    }

    private static String getMethodName(String clazz) {
        return clazz.substring(clazz.lastIndexOf("#") + 1);
    }
}
