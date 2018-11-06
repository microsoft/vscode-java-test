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

import com.microsoft.java.test.plugin.model.ProjectInfo;

import org.eclipse.jdt.core.IJavaProject;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Set;

public final class ProjectInfoFetcher {
    public static ProjectInfo[] getProjectInfo(List<Object> arguments) {
        if (arguments == null || arguments.size() == 0) {
            return new ProjectInfo[0];
        }
        final String folder = (String) arguments.get(0);
        try {
            final URI uri = new URI(folder);
            final Set<IJavaProject> projects = ProjectUtils.parseProjects(uri);
            return projects.stream()
                    .map(p -> new ProjectInfo(p.getProject().getLocationURI(), p.getProject().getName()))
                    .toArray(ProjectInfo[]::new);
        } catch (final URISyntaxException e) {
            // skip
        }
        return new ProjectInfo[0];
    }
}
