/*******************************************************************************
 * Copyright (c) 2022 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.model.builder;

import com.microsoft.java.test.plugin.model.JavaTestItem;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.util.TestItemUtils;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.IPath;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.jdt.ls.core.internal.hover.JavaElementLabels;
import org.eclipse.lsp4j.Range;

/**
 * Builder class to build {@link com.microsoft.java.test.plugin.model.JavaTestItem}
 */
public class JavaTestItemBuilder {
    private static final String DEFAULT_PACKAGE_NAME = "<Default Package>";

    private IJavaElement element;
    private TestLevel level;
    private TestKind kind;

    public JavaTestItemBuilder setJavaElement(IJavaElement element) {
        this.element = element;
        return this;
    }

    public JavaTestItemBuilder setLevel(TestLevel level) {
        this.level = level;
        return this;
    }

    public JavaTestItemBuilder setKind(TestKind kind) {
        this.kind = kind;
        return this;
    }

    public JavaTestItem build() throws JavaModelException {
        if (this.element == null || this.level == null || this.kind == null) {
            throw new IllegalArgumentException("Failed to build Java test item due to missing arguments");
        }

        final String displayName;
        String uri = null;
        if (this.element instanceof IJavaProject) {
            final IJavaProject javaProject = (IJavaProject) this.element;
            final IProject project = javaProject.getProject();
            if (ProjectUtils.isVisibleProject(project)) {
                displayName = project.getName();
            } else {
                final IPath realPath = ProjectUtils.getProjectRealFolder(project);
                displayName = realPath.lastSegment();
                uri = realPath.toFile().toURI().toString();
            }
        } else if (this.element instanceof IPackageFragment && ((IPackageFragment) this.element).isDefaultPackage()) {
            displayName = DEFAULT_PACKAGE_NAME;
        } else {
            displayName = JavaElementLabels.getElementLabel(this.element, JavaElementLabels.ALL_DEFAULT);
        }
        final String fullName = TestItemUtils.parseFullName(this.element, this.level);
        if (uri == null) {
            uri = JDTUtils.getFileURI(this.element.getResource());
        }
        Range range = null;
        if (this.level == TestLevel.CLASS || this.level == TestLevel.METHOD) {
            range = TestItemUtils.parseTestItemRange(this.element);
        }

        final String projectName = this.element.getJavaProject().getProject().getName();
        final JavaTestItem result = new JavaTestItem(displayName, fullName, projectName, uri, range, level, this.kind);
        result.setJdtHandler(this.element.getHandleIdentifier());

        return result;
    }
}
