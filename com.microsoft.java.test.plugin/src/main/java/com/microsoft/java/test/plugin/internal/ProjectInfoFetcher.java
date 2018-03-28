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
package com.microsoft.java.test.plugin.internal;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.eclipse.jdt.core.IJavaProject;

public final class ProjectInfoFetcher {
    public static ProjectInfo[] getProjectInfo(List<Object> arguments) {
        if (arguments == null || arguments.size() == 0) {
            return new ProjectInfo[0];
        }
        String folder = (String)arguments.get(0);
        try {
            URI uri = new URI(folder);
            Set<IJavaProject> projects = ProjectUtils.parseProjects(uri);
            return
                    projects.stream()
                    .map(p -> new ProjectInfo(p.getProject().getLocationURI(), p.getProject().getName())).toArray(ProjectInfo[]::new);
            } catch (URISyntaxException e) {
            // skip
        }
        return new ProjectInfo[0];
    }
}
