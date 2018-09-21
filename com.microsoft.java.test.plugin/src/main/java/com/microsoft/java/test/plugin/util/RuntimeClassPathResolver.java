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

import org.eclipse.core.runtime.CoreException;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.launching.JavaRuntime;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class RuntimeClassPathResolver {
    public String[] resolveRunTimeClassPath(List<Object> arguments) throws CoreException {
        if (arguments == null || arguments.size() == 0) {
            return new String[0];
        }
        final HashSet<String> paths = new HashSet<>();
        final String folder = (String) arguments.get(0);
        try {
            final URI uri = new URI(folder);
            final Set<IJavaProject> projects = ProjectUtils.parseProjects(uri);
            for (final IJavaProject project : projects) {
                paths.addAll(Arrays.asList(JavaRuntime.computeDefaultRuntimeClassPath(project)));
            }
        } catch (final URISyntaxException e) {
            // skip
        }
        return paths.toArray(new String[paths.size()]);
    }
}
