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

import org.eclipse.core.resources.IProject;
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
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.eclipse.jdt.ls.core.internal.ProjectUtils.WORKSPACE_LINK;

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
    public static String[] listTestSourcePaths(List<Object> arguments, IProgressMonitor monitor)
            throws JavaModelException {
        final List<String> resultList = new ArrayList<>();
        if (arguments == null || arguments.size() == 0) {
            return new String[0];
        }

        final ArrayList<String> uriArray = ((ArrayList<String>) arguments.get(0));
        for (final String uri : uriArray) {
            final Set<IJavaProject> projectSet = parseProjects(uri);
            for (final IJavaProject project : projectSet) {
                for (final IPath path : getTestPath(project)) {
                    final IPath relativePath = path.makeRelativeTo(project.getPath());
                    resultList.add(project.getProject().getFolder(relativePath).getLocation().toOSString());
                }
            }
        }
        return resultList.toArray(new String[resultList.size()]);
    }

    public static Set<IJavaProject> parseProjects(String uriStr) {
        final IPath parentPath = ResourceUtils.filePathFromURI(uriStr);
        if (parentPath == null) {
            return Collections.emptySet();
        }
        return Arrays.stream(ProjectUtils.getJavaProjects())
                .filter(p -> isProjectBelongToPath(p.getProject(), parentPath))
                .collect(Collectors.toSet());
    }

    public static List<IPath> getTestPath(IJavaProject project) throws JavaModelException {
        final IClasspathEntry[] entries = project.getRawClasspath();
        return Arrays.stream(entries)
                .filter(entry -> isTest(project, entry))
                .map(entry -> entry.getPath())
                .collect(Collectors.toList());
    }

    public static boolean isTest(IJavaProject project, IPath path) {
        try {
            final IClasspathEntry entry = project.getClasspathEntryFor(path);
            if (entry == null) {
                return false;
            }
            return isTest(project, entry);
        } catch (final JavaModelException e) {
            return false;
        }
    }

    public static boolean isTest(IJavaProject project, IClasspathEntry entry) {
        // Ignore default project
        if (ProjectsManager.DEFAULT_PROJECT_NAME.equals(project.getProject().getName())) {
            return false;
        }
        
        if (entry.getEntryKind() != ClasspathEntry.CPE_SOURCE) {
            return false;
        }

        // Always return true Eclipse & invisible project
        if (ProjectUtils.isGeneralJavaProject(project.getProject())) {
            return true;
        }

        return isTestEntry(entry);
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

    public static boolean isProjectBelongToPath(IProject project, IPath path) {
        // Check for visible project
        if (project.getLocation() != null && path.isPrefixOf(project.getLocation())) {
            return true;
        }


        // Check for invisible project
        final IPath linkedLocation = project.getFolder(WORKSPACE_LINK).getLocation();
        if (linkedLocation != null && path.isPrefixOf(linkedLocation)) {
            return true;
        }

        return false;
    }
}
