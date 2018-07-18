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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TestNGLauncher {
    public static void main(String[] args) {
        System.exit(execute(args));
    }

    private static int execute(String[] args) {
        try {
            if (args.length == 0) {
                System.err.print("No test found to run");
            } else {
                TestNGCoreRunner testNgCore = new TestNGCoreRunner();
                testNgCore.run(parse(args));
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

    private static Map<String, List<String>> parse(String[] args)  throws Exception
    {
        Map<String, List<String>> map = new HashMap<>();
        for(String arg: args)
        {
            if(arg.startsWith("CLASS"))
            {
                map.put(getClassName(arg), new ArrayList<>());
            }
            else if(arg.startsWith("METHOD"))
            {
                map.computeIfAbsent(getClassNameFromMethod(arg), e -> new ArrayList<>())
                    .add(getMethodName(arg));
            }
        }
        return map;
    }

    private static String getClassName(String clazz) throws Exception
    {
        return Class.forName(clazz.substring(5)).getCanonicalName();
    }

    private static String getClassNameFromMethod(String clazz) throws Exception
    {
        return Class.forName(clazz.substring(clazz.lastIndexOf(":"))).getCanonicalName();
    }

    private static String getMethodName(String clazz) throws Exception
    {
        return clazz.substring(6, clazz.lastIndexOf(":"));
    }
}
