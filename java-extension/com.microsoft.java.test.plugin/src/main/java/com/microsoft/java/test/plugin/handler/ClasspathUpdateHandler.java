/*******************************************************************************
* Copyright (c) 2021 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.handler;

import com.microsoft.java.test.plugin.provider.TestKindProvider;

import org.eclipse.jdt.core.ElementChangedEvent;
import org.eclipse.jdt.core.IElementChangedListener;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaElementDelta;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaCore;

import java.util.HashSet;
import java.util.Set;

public class ClasspathUpdateHandler implements IElementChangedListener {

    @Override
    public void elementChanged(ElementChangedEvent event) {
        // Collect project names which have classpath changed.
        final Set<IJavaProject> projects = processDelta(event.getDelta(), null);
        if (projects != null && projects != null) {
            for (final IJavaProject project : projects) {
                TestKindProvider.updateTestKinds(project);
            }
        }
    }

    public void addElementChangeListener() {
        JavaCore.addElementChangedListener(this);
    }

    public void removeElementChangeListener() {
        JavaCore.removeElementChangedListener(this);
    }

    private Set<IJavaProject> processDeltaChildren(IJavaElementDelta delta, Set<IJavaProject> projects) {
        for (final IJavaElementDelta c : delta.getAffectedChildren()) {
            projects = processDelta(c, projects);
        }
        return projects;
    }

    private Set<IJavaProject> processDelta(IJavaElementDelta delta, Set<IJavaProject> projects) {
        final IJavaElement element = delta.getElement();
        switch (element.getElementType()) {
            case IJavaElement.JAVA_MODEL:
                projects = processDeltaChildren(delta, projects);
                break;
            case IJavaElement.JAVA_PROJECT:
                if (isClasspathChanged(delta.getFlags())) {
                    if (projects == null) {
                        projects = new HashSet<IJavaProject>();
                    }
                    projects.add((IJavaProject) element);
                }
                break;
            default:
                break;
        }
        return projects;
    }

    private boolean isClasspathChanged(int flags) {
        return 0 != (flags & (IJavaElementDelta.F_CLASSPATH_CHANGED | IJavaElementDelta.F_RESOLVED_CLASSPATH_CHANGED |
                IJavaElementDelta.F_CLOSED | IJavaElementDelta.F_OPENED));
    }
}
