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
import com.microsoft.java.test.plugin.WorkspaceHelper;

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
        assertEquals(7, packages.get(0).getChildren().size());
        assertTrue(packages.get(0).getChildren().stream().anyMatch(item -> "MiniTest".equals(item.getLabel())));
        assertTrue(packages.get(0).getChildren().stream().anyMatch(item -> "SiblingTest".equals(item.getLabel())));
        assertTrue(packages.get(0).getChildren().stream().anyMatch(item -> "NestedOnlyTest".equals(item.getLabel())));
        assertTrue(packages.get(0).getChildren().stream()
                .anyMatch(item -> "InheritanceChildTest".equals(item.getLabel())));

        final List<JavaTestItem> methods = TestSearchUtils.findDirectTestChildrenForClass(
                Arrays.asList(type.getHandleIdentifier()), new NullProgressMonitor());
        assertEquals(2, methods.size());
        final IType siblingType = unit.getType("SiblingTest");
        final List<JavaTestItem> siblingMethods = TestSearchUtils.findDirectTestChildrenForClass(
                Arrays.asList(siblingType.getHandleIdentifier()), new NullProgressMonitor());
        assertEquals(1, siblingMethods.size());
        final List<JavaTestItem> nestedChildren = TestSearchUtils.findDirectTestChildrenForClass(
                Arrays.asList(nestedType.getHandleIdentifier()), new NullProgressMonitor());
        assertEquals("Child", nestedChildren.get(0).getLabel());
        assertEquals(JavaCore.ENABLED, javaProject.getOption(JavaCore.COMPILER_PB_ENABLE_PREVIEW_FEATURES, true));
    }

    @Test
    public void testDiscoverInheritedTestMethods() throws Exception {
        final IProject project = importProjects("preview-junit").get(0);
        final IJavaProject javaProject = JavaCore.create(project);
        final IType childType = javaProject.findType("example.InheritanceChildTest");
        assertNotNull(childType);

        final List<JavaTestItem> childMethods = TestSearchUtils.findDirectTestChildrenForClass(
                Arrays.asList(childType.getHandleIdentifier()), new NullProgressMonitor());
        assertEquals(2, childMethods.size());
        assertTrue(childMethods.stream().anyMatch(
                item -> "example.InheritanceChildTest#child()".equals(item.getFullName())));
        assertTrue(childMethods.stream().anyMatch(
                item -> "example.InheritanceChildTest#base()".equals(item.getFullName())));
        for (final JavaTestItem item : childMethods) {
            assertTrue(item.getId().startsWith(item.getProjectName() + "@example.InheritanceChildTest#"));
        }

        final IType baseType = javaProject.findType("example.InheritanceBaseTest");
        final List<JavaTestItem> baseMethods = TestSearchUtils.findDirectTestChildrenForClass(
                Arrays.asList(baseType.getHandleIdentifier()), new NullProgressMonitor());
        assertEquals(1, baseMethods.size());
        assertEquals("example.InheritanceBaseTest#base()", baseMethods.get(0).getFullName());

        final IType overrideType = javaProject.findType("example.InheritanceOverrideTest");
        final List<JavaTestItem> overrideMethods = TestSearchUtils.findDirectTestChildrenForClass(
                Arrays.asList(overrideType.getHandleIdentifier()), new NullProgressMonitor());
        assertEquals(2, overrideMethods.size());
        assertTrue(overrideMethods.stream().anyMatch(
                item -> "example.InheritanceOverrideTest#base()".equals(item.getFullName())));
        assertTrue(overrideMethods.stream().anyMatch(
                item -> "example.InheritanceOverrideTest#extra()".equals(item.getFullName())));
    }

    @Test
    public void testInheritedMethodUsesChildProjectAndExecutionClass() throws Exception {
        importProjects(Arrays.asList("inheritance-parent", "inheritance-child"));
        final IProject childProject = WorkspaceHelper.getProject("inheritance-child");
        final IJavaProject javaProject = JavaCore.create(childProject);
        final IType childType = javaProject.findType("example.InheritanceChildTest");
        final IType parentType = JavaCore.create(WorkspaceHelper.getProject("inheritance-parent"))
                .findType("example.InheritanceBaseTest");
        assertNotNull(childType);
        assertNotNull(parentType);

        final List<JavaTestItem> methods = TestSearchUtils.findDirectTestChildrenForClass(
                Arrays.asList(childType.getHandleIdentifier()), new NullProgressMonitor());
        final JavaTestItem inherited = methods.stream()
                .filter(item -> item.getFullName().endsWith("#base()"))
                .findFirst().orElse(null);
        assertNotNull(inherited);
        assertEquals(childProject.getName(), inherited.getProjectName());
        assertEquals(childProject.getName() + "@example.InheritanceChildTest#base()", inherited.getId());
        assertEquals("example.InheritanceChildTest", inherited.getExecutionClassName());
        assertEquals(parentType.getMethod("base", new String[0]).getHandleIdentifier(), inherited.getJdtHandler());
    }

    @Test
    public void testJUnit4TestSurvivesUnannotatedOverride() throws Exception {
        importProjects("inheritance-junit4");
        final IJavaProject javaProject = JavaCore.create(WorkspaceHelper.getProject("inheritance-junit4"));
        final IType childType = javaProject.findType("example.JUnit4ChildTest");
        assertNotNull(childType);

        final List<JavaTestItem> methods = TestSearchUtils.findDirectTestChildrenForClass(
                Arrays.asList(childType.getHandleIdentifier()), new NullProgressMonitor());
        assertEquals(1, methods.size());
        assertEquals("example.JUnit4ChildTest#inherited", methods.get(0).getFullName());
        assertEquals("example.JUnit4ChildTest", methods.get(0).getExecutionClassName());
    }

    @Test
    public void testJUnit5UnannotatedOverrideSuppressesInheritedTest() throws Exception {
        final IProject project = importProjects("preview-junit").get(0);
        final IType childType = JavaCore.create(project).findType("example.InheritanceUnannotatedOverrideTest");
        assertNotNull(childType);

        final List<JavaTestItem> methods = TestSearchUtils.findDirectTestChildrenForClass(
                Arrays.asList(childType.getHandleIdentifier()), new NullProgressMonitor());
        assertTrue(methods.isEmpty());
    }
}
