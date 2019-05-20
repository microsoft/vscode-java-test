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
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.launching.JavaRuntime;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Iterator;
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
            final String[] classPathArray = JavaRuntime.computeDefaultRuntimeClassPath(project);
            final Set<IPath> testEntriePaths = ProjectTestUtils.getTestOutputPath(project);
            Arrays.sort(classPathArray, Comparator.comparing((String pathStr) -> {
                final Path path = new Path(pathStr);
                if (path.toFile().isFile()) {
                    return 1;
                }
                for (final IPath testPath: testEntriePaths) {
                    if (testPath.isPrefixOf(path)) {
                        return -1;
                    }
                }
                return 1;
            }));
            classPathList.addAll(Arrays.asList(classPathArray));
        }
        return classPathList.toArray(new String[classPathList.size()]);
    }
}
