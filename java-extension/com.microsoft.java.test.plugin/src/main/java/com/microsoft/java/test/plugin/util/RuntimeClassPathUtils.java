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

package com.microsoft.java.test.plugin.util;

import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.Path;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.launching.JavaRuntime;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public class RuntimeClassPathUtils {

    @SuppressWarnings("unchecked")
    public static String[] resolveRuntimeClassPath(List<Object> arguments) throws CoreException {
        if (arguments == null || arguments.size() == 0) {
            return new String[0];
        }

        final IPath[] testPaths = ((ArrayList<String>) arguments.get(0)).stream()
                .map(fsPath -> new Path(fsPath))
                .toArray(IPath[]::new);

        final List<IJavaProject> javaProjectList = Arrays.stream(ResourcesPlugin.getWorkspace().getRoot().getProjects())
                .map(project -> ProjectUtils.getJavaProject(project))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        final Set<IJavaProject> projectsToTest = Arrays.stream(testPaths)
                .map(testPath -> {
                    for (final IJavaProject project : javaProjectList) {
                        if (project.getProject().getLocation().isPrefixOf(testPath)) {
                            return project;
                        }
                    }
                    return null;
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        final List<String> classPathList = new ArrayList<>();
        for (final IJavaProject project : projectsToTest) {
            classPathList.addAll(Arrays.asList(JavaRuntime.computeDefaultRuntimeClassPath(project)));
        }
        return classPathList.toArray(new String[classPathList.size()]);
    }
}
