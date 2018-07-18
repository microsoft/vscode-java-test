package com.microsoft.java.test.runner;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Map.Entry;

import com.microsoft.java.test.runner.listeners.TestNGListener;

import org.testng.ITestNGListener;
import org.testng.TestNG;
import org.testng.xml.XmlClass;
import org.testng.xml.XmlInclude;
import org.testng.xml.XmlSuite;
import org.testng.xml.XmlTest;

/**
 * @author Aigensberger Christoph
 */
public class TestNGCoreRunner
{
    /**
     * @param map keys are the Class names and the List contains what Methods to execute
     */
    public void run(Map<String, List<String>> map)
    {
        XmlSuite suite = new XmlSuite();
        suite.setName("TestNGSuite");
        suite.addTest(createTests(map));
        
        TestNG tng = new TestNG();
        ITestNGListener listener = new TestNGListener();
        tng.addListener(listener);
        tng.setXmlSuites(Collections.singletonList(suite));
        tng.run(); 
    }

    /**
     * @param map keys are the Class names and the List contains what Methods to execute
     * @return an XMLTest that contains all the classes with the methods we wish to execute
     */
    private XmlTest createTests(Map<String, List<String>> map)
    {
        XmlTest test = new XmlTest();
        test.setName("TestNGTest-" + UUID.randomUUID().toString());
        List<XmlClass> classes = new ArrayList<XmlClass>();
        for(Entry<String, List<String>> entry: map.entrySet())
        {
            classes.add(createClass(entry.getKey(), entry.getValue()));
        }
        test.setXmlClasses(classes);
        return test;
    }

    /**
     * @param map keys are the Class names and the List contains what Methods to execute
     * @return an XMLClass that contains all the tests we specified
     */
    private XmlClass createClass(String clazz, List<String> methods)
    {
        XmlClass xmlClass = new XmlClass(clazz);
        if(methods.size() != 0)
        {
            List<XmlInclude> includes = new ArrayList<>();
            for(String method: methods)
            {
                includes.add(new XmlInclude(method));
            }
            xmlClass.setIncludedMethods(includes);
        }
        return xmlClass;
    }
}