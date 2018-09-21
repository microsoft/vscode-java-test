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
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaCore;

import java.net.URI;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

public class ProjectUtils {

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

}
