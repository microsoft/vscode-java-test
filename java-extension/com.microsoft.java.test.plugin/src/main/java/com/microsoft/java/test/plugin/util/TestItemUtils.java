/*******************************************************************************
* Copyright (c) 2018-2021 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.util;

import com.microsoft.java.test.plugin.model.JavaTestItem;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.IPath;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.ISourceReference;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.SourceRange;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.jdt.ls.core.internal.hover.JavaElementLabels;
import org.eclipse.lsp4j.Range;

@SuppressWarnings("restriction")
public class TestItemUtils {

    public static final String DEFAULT_PACKAGE_NAME = "<Default Package>";

    public static JavaTestItem constructJavaTestItem(IJavaElement element, TestLevel level, TestKind kind)
            throws JavaModelException {
        final String displayName;
        String uri = null;
        if (element instanceof IJavaProject) {
            final IJavaProject javaProject = (IJavaProject) element;
            final IProject project = javaProject.getProject();
            if (ProjectUtils.isVisibleProject(project)) {
                displayName = project.getName();
            } else {
                final IPath realPath = ProjectUtils.getProjectRealFolder(project);
                displayName = realPath.lastSegment();
                uri = realPath.toFile().toURI().toString();
            }
        } else if (element instanceof IPackageFragment && ((IPackageFragment) element).isDefaultPackage()) {
            displayName = DEFAULT_PACKAGE_NAME;
        } else {
            displayName = JavaElementLabels.getElementLabel(element, JavaElementLabels.ALL_DEFAULT);
        }
        final String fullName = parseFullName(element, level);
        if (uri == null) {
            uri = JDTUtils.getFileURI(element.getResource());
        }
        Range range = null;
        if (level == TestLevel.CLASS || level == TestLevel.METHOD) {
            range = parseTestItemRange(element);
        }
        
        final String projectName = element.getJavaProject().getProject().getName();

        final JavaTestItem result = new JavaTestItem(displayName, fullName, projectName, uri, range, level, kind);
        result.setJdtHandler(element.getHandleIdentifier());
        return result;
    }

    public static Range parseTestItemRange(IJavaElement element) throws JavaModelException {
        if (element instanceof ISourceReference) {
            final ISourceRange sourceRange = ((ISourceReference) element).getSourceRange();
            final ISourceRange nameRange = ((ISourceReference) element).getNameRange();
            // get the code range excluding the comment part
            if (SourceRange.isAvailable(sourceRange) && SourceRange.isAvailable(nameRange)) {
                return JDTUtils.toRange(element.getOpenable(), nameRange.getOffset(),
                        sourceRange.getLength() - nameRange.getOffset() + sourceRange.getOffset());
            }
        }
        return null;
    }

    public static String parseFullName(IJavaElement element, TestLevel level) {
        switch (level) {
            case CLASS:
                final IType type = (IType) element;
                return type.getFullyQualifiedName();
            case METHOD:
                final IMethod method = (IMethod) element;
                return method.getDeclaringType().getFullyQualifiedName() + "#" + method.getElementName();
            default:
                return element.getElementName();
        }
    }
}
