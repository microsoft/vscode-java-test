/*******************************************************************************
* Copyright (c) 2017-2021 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.util;

import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.IClasspathAttribute;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.internal.core.ClasspathEntry;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.jdt.ls.core.internal.ResourceUtils;
import org.eclipse.jdt.ls.core.internal.managers.ProjectsManager;

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@SuppressWarnings("restriction")
public final class ProjectTestUtils {

    private static final String TEST_SCOPE = "test";
    private static final String MAVEN_SCOPE_ATTRIBUTE = "maven.scope";
    private static final String GRADLE_SCOPE_ATTRIBUTE = "gradle_scope";

    /**
     * Method to get the valid paths which contains test code
     *
     * @param arguments Array of the workspace folder path
     * @param monitor
     * @throws URISyntaxException
     * @throws JavaModelException
     */
    @SuppressWarnings("unchecked")
    public static List<TestSourcePath> listTestSourcePaths(List<Object> arguments, IProgressMonitor monitor)
            throws JavaModelException {
        final List<TestSourcePath> resultList = new ArrayList<>();
        if (arguments == null || arguments.size() == 0) {
            return Collections.emptyList();
        }

        final ArrayList<String> uriArray = ((ArrayList<String>) arguments.get(0));
        for (final String uri : uriArray) {
            final Set<IJavaProject> projectSet = parseProjects(uri);
            for (final IJavaProject project : projectSet) {
                resultList.addAll(getTestSourcePaths(project));
            }
        }
        return resultList;
    }

    public static List<IClasspathEntry> getTestEntries(IJavaProject project) throws JavaModelException {
        return getClasspathEntries(project, true);
    }

    public static List<IClasspathEntry> getSourceEntries(IJavaProject project) throws JavaModelException {
        return getClasspathEntries(project, false);
    }

    private static List<IClasspathEntry> getClasspathEntries(IJavaProject project, boolean isTest)
            throws JavaModelException {
        // Ignore default project
        if (ProjectsManager.DEFAULT_PROJECT_NAME.equals(project.getProject().getName())) {
            return Collections.emptyList();
        }

        final List<IClasspathEntry> entries = new LinkedList<>();
        for (final IClasspathEntry entry : project.getRawClasspath()) {
            if (entry.getEntryKind() != ClasspathEntry.CPE_SOURCE) {
                continue;
            }
    
            if (isTest == isTestEntry(entry)) {
                entries.add(entry);
                continue;
            }
    
            // Always return true Eclipse & invisible project
            if (ProjectUtils.isGeneralJavaProject(project.getProject())) {
                entries.add(entry);
            }
        }
        return entries;
    }

    public static List<TestSourcePath> getTestSourcePaths(IJavaProject project) throws JavaModelException {
        // Ignore default project
        if (ProjectsManager.DEFAULT_PROJECT_NAME.equals(project.getProject().getName())) {
            return Collections.emptyList();
        }

        final List<TestSourcePath> paths = new LinkedList<>();
        for (final IClasspathEntry entry : project.getRawClasspath()) {
            if (entry.getEntryKind() != ClasspathEntry.CPE_SOURCE) {
                continue;
            }
    
            if (isTestEntry(entry)) {
                paths.add(new TestSourcePath(parseTestSourcePathString(entry, project), true));
                continue;
            }
    
            // Always return true Eclipse & invisible project
            if (ProjectUtils.isGeneralJavaProject(project.getProject())) {
                paths.add(new TestSourcePath(parseTestSourcePathString(entry, project), false));
            }
        }
        return paths;
    }

    public static Set<IJavaProject> parseProjects(String uriStr) {
        final IPath parentPath = ResourceUtils.filePathFromURI(uriStr);
        if (parentPath == null) {
            return Collections.emptySet();
        }
        return Arrays.stream(ProjectUtils.getJavaProjects())
                .filter(p -> ResourceUtils.isContainedIn(ProjectUtils.getProjectRealFolder(p.getProject()),
                        Arrays.asList(parentPath)))
                .collect(Collectors.toSet());
    }

    private static String parseTestSourcePathString(IClasspathEntry entry, IJavaProject project) {
        final IPath relativePath = entry.getPath().makeRelativeTo(project.getPath());
        return project.getProject().getFolder(relativePath).getLocation().toOSString();
    }

    public static boolean isTest(IJavaProject project, IPath path, boolean containsGeneral) {
        try {
            final IClasspathEntry entry = project.getClasspathEntryFor(path);
            if (entry == null) {
                return false;
            }
            return isTest(project, entry, containsGeneral);
        } catch (final JavaModelException e) {
            return false;
        }
    }

    public static boolean isTest(IJavaProject project, IClasspathEntry entry, boolean containsGeneral) {
        // Ignore default project
        if (ProjectsManager.DEFAULT_PROJECT_NAME.equals(project.getProject().getName())) {
            return false;
        }
        
        if (entry.getEntryKind() != ClasspathEntry.CPE_SOURCE) {
            return false;
        }

        if (isTestEntry(entry)) {
            return true;
        }

        // Always return true Eclipse & invisible project
        return containsGeneral && ProjectUtils.isGeneralJavaProject(project.getProject());
    }

    public static boolean isTestEntry(IClasspathEntry entry) {
        if (entry.isTest()) {
            return true;
        }

        for (final IClasspathAttribute attribute : entry.getExtraAttributes()) {
            if (MAVEN_SCOPE_ATTRIBUTE.equals(attribute.getName()) ||
                    GRADLE_SCOPE_ATTRIBUTE.equals(attribute.getName())) {
                // the attribute value might be "test" or "integrationTest"
                return attribute.getValue() != null && attribute.getValue().toLowerCase().contains(TEST_SCOPE);
            }
        }

        return false;
    }

    static class TestSourcePath {
        public String testSourcePath;
        /**
         * All the source paths from eclipse and invisible project will be treated as test source
         * even they are not marked as test in the classpath entry, in that case, this field will be false.
         */
        public boolean isStrict;

        public TestSourcePath(String testSourcePath, boolean isStrict) {
            this.testSourcePath = testSourcePath;
            this.isStrict = isStrict;
        }
    }
}
