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
package com.java.junit.plugin.internal;

import java.net.URI;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import org.eclipse.core.resources.IContainer;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaCore;

public class ProjectUtils {
	
	public static Set<IJavaProject> parseProjects(URI rootFolderURI) {
		IWorkspaceRoot workspaceRoot = ResourcesPlugin.getWorkspace().getRoot();
		IContainer[] containers = workspaceRoot.findContainersForLocationURI(rootFolderURI);
		return Arrays.stream(containers).map(container -> {
			if (container instanceof IProject) {
				return getJavaProject((IProject)container);
			} else {
				return getJavaProject(container.getProject());
			}
		}).filter(p -> p != null).collect(Collectors.toSet());
	}
	
	public static boolean isJavaProject(IProject project) {
        if (project == null || !project.exists()) {
            return false;
        }
        try {
            if (!project.isNatureEnabled(JavaCore.NATURE_ID)) {
                return false;
            }
        } catch (CoreException e) {
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

}