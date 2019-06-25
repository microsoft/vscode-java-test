/*******************************************************************************
 * Copyright (c) 2018-2019 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.util;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.Path;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.internal.core.LaunchConfiguration;
import org.eclipse.debug.internal.core.LaunchConfigurationInfo;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.launching.IJavaLaunchConfigurationConstants;
import org.eclipse.jdt.launching.IRuntimeClasspathEntry;
import org.eclipse.jdt.launching.JavaRuntime;
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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@SuppressWarnings({ "unchecked", "restriction" })
public class RuntimeClassPathUtils {

    public static String[] resolveRuntimeClassPath(List<Object> arguments) throws CoreException {
        if (arguments == null || arguments.size() == 0) {
            return new String[0];
        }

        final IPath[] testPaths = ((ArrayList<String>) arguments.get(0)).stream()
                .map(fsPath -> new Path(fsPath))
                .toArray(IPath[]::new);

        final Set<IJavaProject> javaProjectSet = Arrays.stream(ProjectUtils.getJavaProjects())
                .collect(Collectors.toSet());

        final Set<IJavaProject> projectsToTest = new HashSet<>();
        for (final IPath testPath : testPaths) {
            final Iterator<IJavaProject> iterator = javaProjectSet.iterator();
            while (iterator.hasNext()) {
                final IJavaProject javaProject = iterator.next();
                final IProject project = javaProject.getProject();
                if (ProjectTestUtils.isPathBelongToProject(testPath, project)) {
                    projectsToTest.add(javaProject);
                    iterator.remove();
                }
            }
        }

        final List<String> classPathList = new ArrayList<>();
        for (final IJavaProject project : projectsToTest) {
            classPathList.addAll(Arrays.asList(resolveClasspath(project)));
        }
        return classPathList.toArray(new String[classPathList.size()]);
    }

    private static String[] resolveClasspath(IJavaProject javaProject) throws CoreException {
        // Use launch configuration to resolve the classpath.
        // See: https://github.com/microsoft/vscode-java-test/issues/623.
        final ILaunchConfiguration launchConfig = new JUnitLaunchConfiguration(javaProject.getProject());
        final IRuntimeClasspathEntry[] unresolved = JavaRuntime.computeUnresolvedRuntimeClasspath(launchConfig);
        final IRuntimeClasspathEntry[] resolved = JavaRuntime.resolveRuntimeClasspath(unresolved, launchConfig);
        final Set<String> classpaths = new LinkedHashSet<>();
        for (final IRuntimeClasspathEntry entry : resolved) {
            final String location = entry.getLocation();
            if (location != null) {
                if (entry.getClasspathProperty() == IRuntimeClasspathEntry.USER_CLASSES ||
                        entry.getClasspathProperty() == IRuntimeClasspathEntry.CLASS_PATH) {
                    classpaths.add(location);
                }
                // TODO: support module path
            }
        }
        return classpaths.toArray(new String[classpaths.size()]);
    }

    private static class JUnitLaunchConfiguration extends LaunchConfiguration {
        public static final String JUNIT_LAUNCH = "<?xml version=\"1.0\" encoding=\"UTF-8\"" +
                " standalone=\"no\"?>\n" +
                "<launchConfiguration type=\"org.eclipse.jdt.junit.launchconfig\">\n" +
                "<listAttribute key=\"org.eclipse.debug.core.MAPPED_RESOURCE_PATHS\">\n" +
                "</listAttribute>\n" +
                "<listAttribute key=\"org.eclipse.debug.core.MAPPED_RESOURCE_TYPES\">\n" +
                "<listEntry value=\"1\"/>\n" +
                "</listAttribute>\n" +
                "<booleanAttribute key=\"org.eclipse.jdt.launching.ATTR_EXCLUDE_TEST_CODE\" value=\"false\"/>\n" +
                "</launchConfiguration>";
        private final IProject project;
        private String classpathProvider;
        private String sourcepathProvider;
        private final LaunchConfigurationInfo launchInfo;

        protected JUnitLaunchConfiguration(IProject project) throws CoreException {
            super(String.valueOf(new Date().getTime()), null, false);
            this.project = project;
            if (ProjectUtils.isMavenProject(project)) {
                classpathProvider = "org.eclipse.m2e.launchconfig.classpathProvider";
                sourcepathProvider = "org.eclipse.m2e.launchconfig.sourcepathProvider";
            } else if (ProjectUtils.isGradleProject(project)) {
                classpathProvider = "org.eclipse.buildship.core.classpathprovider";
            }
            this.launchInfo = new JavaLaunchConfigurationInfo(JUNIT_LAUNCH);
        }

        @Override
        public String getAttribute(String attributeName, String defaultValue) throws CoreException {
            if (IJavaLaunchConfigurationConstants.ATTR_PROJECT_NAME.equalsIgnoreCase(attributeName)) {
                return project.getName();
            } else if (IJavaLaunchConfigurationConstants.ATTR_CLASSPATH_PROVIDER.equalsIgnoreCase(attributeName)) {
                return classpathProvider;
            } else if (IJavaLaunchConfigurationConstants.ATTR_SOURCE_PATH_PROVIDER.equalsIgnoreCase(attributeName)) {
                return sourcepathProvider;
            }

            return super.getAttribute(attributeName, defaultValue);
        }

        @Override
        protected LaunchConfigurationInfo getInfo() throws CoreException {
            return this.launchInfo;
        }
    }

    private static class JavaLaunchConfigurationInfo extends LaunchConfigurationInfo {
        public JavaLaunchConfigurationInfo(String launchXml) {
            super();
            try {
                final DocumentBuilder parser = DocumentBuilderFactory.newInstance().newDocumentBuilder();
                parser.setErrorHandler(new DefaultHandler());
                final StringReader reader = new StringReader(launchXml);
                final InputSource source = new InputSource(reader);
                final Element root = parser.parse(source).getDocumentElement();
                initializeFromXML(root);
            } catch (ParserConfigurationException | SAXException | IOException | CoreException e) {
                // do nothing
            }
        }
    }
}
