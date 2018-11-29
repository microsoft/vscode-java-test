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
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.Path;
import org.eclipse.jdt.core.IClasspathAttribute;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.internal.core.ClasspathEntry;

import java.net.URI;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@SuppressWarnings("restriction")
public final class ProjectUtils {

    private static final String TEST_SCOPE = "test";
    private static final String MAVEN_SCOPE_ATTRIBUTE = "maven.scope";
    private static final String GRADLE_SCOPE_ATTRIBUTE = "gradle_scope";

    public static Set<IJavaProject> parseProjects(URI rootFolderURI) {
        final IWorkspaceRoot workspaceRoot = ResourcesPlugin.getWorkspace().getRoot();
        final IProject[] projects = workspaceRoot.getProjects();
        final IPath parent = filePathFromURI(rootFolderURI);
        return Arrays.stream(projects)
                .filter(p -> parent.isPrefixOf(p.getLocation()))
                .map(p -> getJavaProject(p))
                .filter(p -> p != null)
                .collect(Collectors.toSet());
    }

    public static boolean isJavaProject(IProject project) {
        if (project == null || !project.exists()) {
            return false;
        }
        try {
            if (!project.isNatureEnabled(JavaCore.NATURE_ID)) {
                return false;
            }
        } catch (final CoreException e) {
            return false;
        }
        return true;
    }

    public static IJavaProject getJavaProject(IProject project) {
        if (isJavaProject(project)) {
            return JavaCore.create(project);
        }
        return null;
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

}
