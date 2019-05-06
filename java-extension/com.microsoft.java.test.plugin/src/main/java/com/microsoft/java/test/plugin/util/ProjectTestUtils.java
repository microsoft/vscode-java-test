/*******************************************************************************
* Copyright (c) 2017 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.util;

import org.eclipse.core.resources.IContainer;
import org.eclipse.core.resources.IFolder;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.Path;
import org.eclipse.jdt.core.IClasspathAttribute;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.internal.core.ClasspathEntry;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@SuppressWarnings("restriction")
public final class ProjectTestUtils {

    private static final String TEST_SCOPE = "test";
    private static final String MAVEN_SCOPE_ATTRIBUTE = "maven.scope";
    private static final String GRADLE_SCOPE_ATTRIBUTE = "gradle_scope";

    @SuppressWarnings("unchecked")
    public static List<TestSourcePath> listTestSourcePaths(List<Object> arguments, IProgressMonitor monitor)
            throws JavaModelException, URISyntaxException {
        final List<TestSourcePath> testSourcePathList = new ArrayList<>();
        if (arguments == null || arguments.size() == 0) {
            return testSourcePathList;
        }

        final ArrayList<String> uriArray = ((ArrayList<String>) arguments.get(0));
        for (final String uri : uriArray) {
            final Set<IJavaProject> projectSet = parseProjects(new URI(uri));
            for (final IJavaProject javaProject : projectSet) {
                final IProject project = javaProject.getProject();
                final String projectName = project.getName();
                String projectType = "General";
                if (ProjectUtils.isMavenProject(project)) {
                    projectType = "Maven";
                }

                if (ProjectUtils.isGradleProject(project)) {
                    projectType = "Gradle";
                }

                IContainer projectRoot = project;
                if (!ProjectUtils.isVisibleProject(project)) {
                    projectType = "Workspace";
                    final IFolder workspaceLinkFolder = project.getFolder(ProjectUtils.WORKSPACE_LINK);
                    if (!workspaceLinkFolder.isLinked()) {
                        continue;
                    }

                    projectRoot = workspaceLinkFolder;
                }
                for (final IPath path : getTestPath(javaProject)) {
                    final IPath relativePath = path.makeRelativeTo(javaProject.getPath());
                    final IPath location = projectRoot.getRawLocation().append(relativePath);
                    testSourcePathList.add(new TestSourcePath(location.toOSString(), projectName, projectType));
                }
            }
        }
        return testSourcePathList;
    }

    /**
     * Method to get the valid paths which contains test code
     *
     * @param arguments Array of the workspace folder path
     * @param monitor
     * @throws URISyntaxException
     * @throws JavaModelException
     */
    @SuppressWarnings("unchecked")
    public static String[] getTestSourcePaths(List<Object> arguments, IProgressMonitor monitor)
            throws URISyntaxException, JavaModelException {

        final List<String> resultList = new ArrayList<>();
        if (arguments == null || arguments.size() == 0) {
            return new String[0];
        }

        final ArrayList<String> uriArray = ((ArrayList<String>) arguments.get(0));
        for (final String uri : uriArray) {
            final Set<IJavaProject> projectSet = parseProjects(new URI(uri));
            for (final IJavaProject project : projectSet) {
                for (final IPath path : getTestPath(project)) {
                    final IPath projectBasePath = project.getProject().getLocation();
                    final IPath relativePath = path.makeRelativeTo(project.getPath());
                    resultList.add(projectBasePath.append(relativePath).toOSString());
                }
            }
        }
        return resultList.toArray(new String[resultList.size()]);
    }

    public static Set<IJavaProject> parseProjects(URI rootFolderURI) {
        final IPath parentPath = filePathFromURI(rootFolderURI);
        if (parentPath == null) {
            return Collections.emptySet();
        }
        return Arrays.stream(ProjectUtils.getJavaProjects())
                .filter(p -> parentPath.isPrefixOf(p.getProject().getLocation()))
                .collect(Collectors.toSet());
    }

    public static IPath filePathFromURI(URI uri) {
        if ("file".equals(uri.getScheme())) {
            return Path.fromOSString(Paths.get(uri).toString());
        }
        return null;
    }

    public static List<IPath> getTestPath(IJavaProject project) throws JavaModelException {
        final IClasspathEntry[] entries = project.getRawClasspath();
        return Arrays.stream(entries)
                .filter(entry -> isTest(entry))
                .map(entry -> entry.getPath())
                .collect(Collectors.toList());
    }

    public static Set<IPath> getTestOutputPath(IJavaProject project) throws JavaModelException {
        final IClasspathEntry[] entries = project.getRawClasspath();
        final IPath projectLocation = project.getProject().getLocation();
        return Arrays.stream(entries)
                .filter(entry -> isTest(entry))
                .map(entry -> {
                    final IPath relativePath = entry.getOutputLocation().makeRelativeTo(project.getPath());
                    return projectLocation.append(relativePath);
                })
                .collect(Collectors.toSet());
    }

    private static boolean isTest(IClasspathEntry entry) {
        if (entry.getEntryKind() != ClasspathEntry.CPE_SOURCE) {
            return false;
        }

        for (final IClasspathAttribute attribute : entry.getExtraAttributes()) {
            if (MAVEN_SCOPE_ATTRIBUTE.equals(attribute.getName()) ||
                    GRADLE_SCOPE_ATTRIBUTE.equals(attribute.getName())) {
                return TEST_SCOPE.equals(attribute.getValue());
            }
        }

        return entry.isTest();
    }

    public static class TestSourcePath {
        public String path;
        public String projectName;
        public String projectType;

        TestSourcePath(String path, String projectName, String projectType) {
            this.path = path;
            this.projectName = projectName;
            this.projectType = projectType;
        }
    }

}
