/*
 * Copyright (c) 2012-2018 Red Hat, Inc.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Originally copied from org.eclipse.che.jdt.ls.extension.core.internal.JavaModelEventProvider
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

package com.microsoft.java.test.plugin.util;

import org.eclipse.core.resources.IProject;
import org.eclipse.jdt.core.ElementChangedEvent;
import org.eclipse.jdt.core.IElementChangedListener;
import org.eclipse.jdt.core.IJavaElementDelta;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.ls.core.internal.JavaLanguageServerPlugin;
import org.eclipse.jdt.ls.core.internal.ResourceUtils;
import org.eclipse.jdt.ls.core.internal.handlers.JDTLanguageServer;

import java.util.HashSet;
import java.util.Set;

@SuppressWarnings("restriction")
public class JavaModelEventProvider implements IElementChangedListener {
    private static final int CLASSPATH_CHANGED_MASK = IJavaElementDelta.F_ADDED_TO_CLASSPATH |
            IJavaElementDelta.F_CLASSPATH_CHANGED | IJavaElementDelta.F_REORDER |
            IJavaElementDelta.F_REMOVED_FROM_CLASSPATH | IJavaElementDelta.F_RESOLVED_CLASSPATH_CHANGED |
            IJavaElementDelta.F_ARCHIVE_CONTENT_CHANGED;

    private static final String CLIENT_UPDATE_CLASSPATH = "java.classpath.refresh";

    @Override
    public void elementChanged(ElementChangedEvent event) {
        final Set<IProject> projects = getAffectedProjects(event.getDelta(), new HashSet<IProject>());
        if (projects.isEmpty()) {
            return;
        }

        try {
            final Set<String> projectLocations = new HashSet<String>();
            for (final IProject project : projects) {
                projectLocations.add(ResourceUtils.fixURI(project.getLocationURI()));
            }

            final JDTLanguageServer ls = JavaLanguageServerPlugin.getInstance().getProtocol();
            ls.getClientConnection().sendNotification(CLIENT_UPDATE_CLASSPATH,
                    (Object[]) projectLocations.toArray(new String[projectLocations.size()]));
        } catch (final Exception e) {
            // Ignore.
            JavaLanguageServerPlugin.logException("An exception occured while reporting project CLASSPATH change", e);
        }
    }

    private Set<IProject> getAffectedProjects(IJavaElementDelta delta, Set<IProject> affectedProjects) {
        if ((delta.getFlags() & CLASSPATH_CHANGED_MASK) != 0) {
            final IJavaProject javaProject = delta.getElement().getJavaProject();
            if (javaProject != null) {
                affectedProjects.add(javaProject.getProject());
            }
        }

        for (final IJavaElementDelta childDelta : delta.getAffectedChildren()) {
            affectedProjects.addAll(getAffectedProjects(childDelta, affectedProjects));
        }
        return affectedProjects;
    }

}
