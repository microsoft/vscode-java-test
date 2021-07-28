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

package com.microsoft.java.test.plugin.util;

import com.microsoft.java.test.plugin.model.JavaTestItem;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;

import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.AST;
import org.eclipse.jdt.core.dom.ASTNode;
import org.eclipse.jdt.core.dom.ASTParser;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.manipulation.CoreASTProvider;
import org.eclipse.jdt.ls.core.internal.JavaLanguageServerPlugin;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.jdt.ls.core.internal.ResourceUtils;

import java.util.Collections;
import java.util.LinkedList;
import java.util.List;

@SuppressWarnings("restriction")
public class TestSearchUtils {

    public static List<JavaTestItem> findJavaProjects(List<Object> arguments, IProgressMonitor monitor) {
        if (arguments == null || arguments.size() == 0) {
            return Collections.emptyList();
        }
        final String workspaceFolderUri = (String) arguments.get(0);
        final IPath workspaceFolderPath = ResourceUtils.filePathFromURI(workspaceFolderUri);
        if (workspaceFolderPath == null) {
            JUnitPlugin.logError("Failed to parse workspace folder path from uri: " + workspaceFolderUri);
            // todo: handle non-file scheme
            return Collections.emptyList();
        }
        final List<IJavaProject> javaProjects = new LinkedList<>();
        for (final IJavaProject project : ProjectUtils.getJavaProjects()) {
            if (monitor != null && monitor.isCanceled()) {
                return Collections.emptyList();
            }
            if (project.getProject().equals(JavaLanguageServerPlugin.getProjectsManager().getDefaultProject())) {
                continue;
            }
            javaProjects.add(project);
        }

        final List<JavaTestItem> resultList = new LinkedList<>();
        for (final IJavaProject project : javaProjects) {
            try {
                resultList.add(TestItemUtils.constructJavaTestItem(project, TestLevel.PROJECT, TestKind.None));
            } catch (JavaModelException e) {
                JUnitPlugin.logError("Failed to parse project item: " + project.getElementName());
            }
        }
        
        return resultList;
    }

    public static ASTNode parseToAst(final ICompilationUnit unit, final boolean fromCache,
            final IProgressMonitor monitor) {
        if (fromCache) {
            final CompilationUnit astRoot = CoreASTProvider.getInstance().getAST(unit, CoreASTProvider.WAIT_YES,
                    monitor);
            if (astRoot != null) {
                return astRoot;
            }
        }

        if (monitor.isCanceled()) {
            return null;
        }

        final ASTParser parser = ASTParser.newParser(AST.JLS14);
        parser.setSource(unit);
        parser.setFocalPosition(0);
        parser.setResolveBindings(true);
        parser.setIgnoreMethodBodies(true);
        return parser.createAST(monitor);
    }
}
