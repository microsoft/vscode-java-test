/*******************************************************************************
 * Copyright (c) 2026 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.util;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.List;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.compiler.IProblem;
import org.eclipse.jdt.core.dom.AST;
import org.eclipse.jdt.core.dom.ASTParser;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.dom.TypeDeclaration;
import org.junit.Test;

import com.microsoft.java.test.plugin.AbstractProjectsManagerBasedTest;
import com.microsoft.java.test.plugin.model.JavaTestItem;

public class TestSearchUtilsTest extends AbstractProjectsManagerBasedTest {

    @Test
    public void testDiscoverJUnit5TestsWithOlderPreviewSource() throws Exception {
        final IProject project = importProjects("preview-junit").get(0);
        final IJavaProject javaProject = JavaCore.create(project);
        final IType type = javaProject.findType("example.MiniTest");
        assertNotNull(type);
        final ICompilationUnit unit = type.getCompilationUnit();
        javaProject.setOption(JavaCore.COMPILER_SOURCE, "17");
        javaProject.setOption(JavaCore.COMPILER_COMPLIANCE, "17");
        javaProject.setOption(JavaCore.COMPILER_PB_ENABLE_PREVIEW_FEATURES, JavaCore.ENABLED);

        final ASTParser parser = ASTParser.newParser(AST.getJLSLatest());
        parser.setSource(unit);
        parser.setCompilerOptions(javaProject.getOptions(true));
        parser.setResolveBindings(true);
        final CompilationUnit invalid = (CompilationUnit) parser.createAST(new NullProgressMonitor());
        assertTrue(Arrays.stream(invalid.getProblems())
                .anyMatch(problem -> problem.getID() == IProblem.PreviewFeaturesNotAllowed));
        assertNull(((TypeDeclaration) invalid.types().get(0)).resolveBinding());

        final CompilationUnit recovered = (CompilationUnit) TestSearchUtils.parseToDiscoveryAst(
                unit, false, new NullProgressMonitor());
        assertFalse(Arrays.stream(recovered.getProblems())
                .anyMatch(problem -> problem.getID() == IProblem.PreviewFeaturesNotAllowed));
        assertNotNull(((TypeDeclaration) recovered.types().get(0)).resolveBinding());
        assertEquals(JavaCore.ENABLED, javaProject.getOption(JavaCore.COMPILER_PB_ENABLE_PREVIEW_FEATURES, true));

        final List<JavaTestItem> fileTests = TestSearchUtils.findTestTypesAndMethods(
                Arrays.asList(unit.getResource().getLocationURI().toString()), new NullProgressMonitor());
        assertEquals(2, fileTests.size());
        assertEquals("MiniTest", fileTests.get(0).getLabel());
        assertEquals(2, fileTests.get(0).getChildren().size());
        assertEquals("SiblingTest", fileTests.get(1).getLabel());
        assertEquals(1, fileTests.get(1).getChildren().size());

        final ICompilationUnit helper = javaProject.findType("example.Helper").getCompilationUnit();
        assertTrue(TestSearchUtils.findTestTypesAndMethods(
                Arrays.asList(helper.getResource().getLocationURI().toString()), new NullProgressMonitor()).isEmpty());

        final IType nestedType = javaProject.findType("example.NestedOnlyTest");
        final List<JavaTestItem> nestedTests = TestSearchUtils.findTestTypesAndMethods(
                Arrays.asList(nestedType.getResource().getLocationURI().toString()), new NullProgressMonitor());
        assertEquals("Child", nestedTests.get(0).getChildren().get(0).getLabel());

        final List<JavaTestItem> packages = TestSearchUtils.findTestPackagesAndTypes(
                Arrays.asList(javaProject.getHandleIdentifier()), new NullProgressMonitor());
        assertEquals(1, packages.size());
        assertEquals(3, packages.get(0).getChildren().size());
        assertTrue(packages.get(0).getChildren().stream().anyMatch(item -> "MiniTest".equals(item.getLabel())));
        assertTrue(packages.get(0).getChildren().stream().anyMatch(item -> "SiblingTest".equals(item.getLabel())));
        assertTrue(packages.get(0).getChildren().stream().anyMatch(item -> "NestedOnlyTest".equals(item.getLabel())));

        final List<JavaTestItem> methods = TestSearchUtils.findDirectTestChildrenForClass(
                Arrays.asList(type.getHandleIdentifier()), new NullProgressMonitor());
        assertEquals(2, methods.size());
        final IType siblingType = javaProject.findType("example.SiblingTest");
        final List<JavaTestItem> siblingMethods = TestSearchUtils.findDirectTestChildrenForClass(
                Arrays.asList(siblingType.getHandleIdentifier()), new NullProgressMonitor());
        assertEquals(1, siblingMethods.size());
        final List<JavaTestItem> nestedChildren = TestSearchUtils.findDirectTestChildrenForClass(
                Arrays.asList(nestedType.getHandleIdentifier()), new NullProgressMonitor());
        assertEquals("Child", nestedChildren.get(0).getLabel());
    }
}
