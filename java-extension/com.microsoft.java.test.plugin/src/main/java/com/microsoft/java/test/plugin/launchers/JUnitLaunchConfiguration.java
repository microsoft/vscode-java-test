/*******************************************************************************
 * Copyright (c) 2019-2021 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.launchers;

import com.microsoft.java.test.plugin.util.JUnitPlugin;
import org.apache.commons.lang3.text.StrSubstitutor;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.internal.core.LaunchConfiguration;
import org.eclipse.debug.internal.core.LaunchConfigurationInfo;
import org.eclipse.jdt.launching.IJavaLaunchConfigurationConstants;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.w3c.dom.Element;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import java.io.IOException;
import java.io.StringReader;
import java.util.HashMap;
import java.util.Map;

public class JUnitLaunchConfiguration extends LaunchConfiguration {
    private final LaunchConfigurationInfo launchInfo;

    private String classpathProvider;
    private String sourcepathProvider;
    private TestInfo testInfo;

    public JUnitLaunchConfiguration(String launchName, TestInfo testInfo) throws CoreException {
        super(launchName, null, false);
        this.launchInfo = new JUnitLaunchConfigurationInfo(testInfo);
        if (ProjectUtils.isMavenProject(testInfo.project)) {
            classpathProvider = "org.eclipse.m2e.launchconfig.classpathProvider";
            sourcepathProvider = "org.eclipse.m2e.launchconfig.sourcepathProvider";
        } else if (ProjectUtils.isGradleProject(testInfo.project)) {
            // Use StandardClasspathProvider for Gradle project
        }
        this.testInfo = testInfo;
    }
    
    @Override
    public String getAttribute(String attributeName, String defaultValue) throws CoreException {
        if (IJavaLaunchConfigurationConstants.ATTR_PROJECT_NAME.equalsIgnoreCase(attributeName)) {
            return testInfo.project.getName();
        } else if (IJavaLaunchConfigurationConstants.ATTR_CLASSPATH_PROVIDER.equalsIgnoreCase(attributeName)) {
            return classpathProvider;
        } else if (IJavaLaunchConfigurationConstants.ATTR_SOURCE_PATH_PROVIDER.equalsIgnoreCase(attributeName)) {
            return sourcepathProvider;
        }

        return super.getAttribute(attributeName, defaultValue);
    }

    @Override
    protected LaunchConfigurationInfo getInfo() {
        return this.launchInfo;
    }
}

class JUnitLaunchConfigurationInfo extends LaunchConfigurationInfo {
    public JUnitLaunchConfigurationInfo(TestInfo testInfo) throws CoreException {
        try {
            final StrSubstitutor sub = new StrSubstitutor(testInfo.toValueMap());
            // here we just simply set the mainType (which is a fake configuration), the purpose is to leverage
            // JUnitLaunchConfiguration to get the classpath/modulepath, the real parameter will be resolved in
            // JUnitLaunchConfigurationDelegate.parseParameters() separately.
            final String launchXml = sub.replace(JUnitLaunchConfigurationTemplate.JUNIT_TEMPLATE);
            final DocumentBuilder parser = DocumentBuilderFactory.newInstance().newDocumentBuilder();
            parser.setErrorHandler(new DefaultHandler());
            final StringReader reader = new StringReader(launchXml);
            final InputSource source = new InputSource(reader);
            final Element root = parser.parse(source).getDocumentElement();
            initializeFromXML(root);
        } catch (ParserConfigurationException | SAXException | IOException | CoreException e) {
            JUnitPlugin.logException("Failed to load JUnit launch configuration.", e);
        }
    }
}

class TestInfo {
    public String testKind = "";
    public String mainType = "";
    public IProject project;

    public Map<String, String> toValueMap() {
        final Map<String, String> valueMap = new HashMap<>();
        valueMap.put("testKind", testKind);
        valueMap.put("mainType", mainType);
        return valueMap;
    }
}
