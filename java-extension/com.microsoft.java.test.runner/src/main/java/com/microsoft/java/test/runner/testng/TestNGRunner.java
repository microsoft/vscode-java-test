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

import org.testng.ITestListener;
import org.testng.ITestNGListener;
import org.testng.TestNG;
import org.testng.xml.XmlClass;
import org.testng.xml.XmlInclude;
import org.testng.xml.XmlSuite;
import org.testng.xml.XmlTest;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.UUID;

public class TestNGRunner {
    public void run(Map<String, List<String>> map) {
        final XmlSuite suite = new XmlSuite();
        createTests(map, suite);

        final TestNG testNG = new TestNG();
        testNG.setUseDefaultListeners(false);
        final ITestNGListener listener = new TestNGListener();
        try {
            testNG.addListener(listener);
        } catch (NoSuchMethodError e) {
            // backward compatibility
            testNG.addListener((ITestListener) listener);
        }
        
        testNG.setXmlSuites(Collections.singletonList(suite));
        testNG.run();
    }

    private void createTests(Map<String, List<String>> map, XmlSuite suite) {
        final XmlTest test = new XmlTest(suite);
        test.setName("TestNGTest-" + UUID.randomUUID().toString());
        final List<XmlClass> classes = new ArrayList<>();
        for (final Entry<String, List<String>> entry: map.entrySet()) {
            classes.add(createClass(entry.getKey(), entry.getValue()));
        }
        test.setXmlClasses(classes);
    }

    private XmlClass createClass(String clazz, List<String> methods) {
        final XmlClass xmlClass = new XmlClass(clazz);
        if (methods.size() != 0) {
            final List<XmlInclude> includes = new ArrayList<>();
            for (final String method: methods) {
                includes.add(new XmlInclude(method));
            }
            xmlClass.setIncludedMethods(includes);
        }
        return xmlClass;
    }
}
