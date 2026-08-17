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

package com.microsoft.java.test.plugin.searcher;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.util.List;
import java.util.Set;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaCore;
import org.junit.Test;

import com.microsoft.java.test.plugin.AbstractProjectsManagerBasedTest;
import com.microsoft.java.test.plugin.model.TestKind;

public class JUnit6TestSearcherTest extends AbstractProjectsManagerBasedTest {

    @Test
    public void testFindNonStaticNestedTestClass() throws Exception {
        final List<IProject> projects = importProjects("junit6-nested");
        final IJavaProject javaProject = JavaCore.create(projects.get(0));
        final IType outerType = javaProject.findType("example.NestedTests");
        assertNotNull(outerType);

        final IType nestedType = outerType.getType("MemberTests");
        assertTrue(nestedType.exists());

        final JUnit6TestSearcher searcher = new JUnit6TestSearcher();
        assertTrue(searcher.isTestClass(nestedType));

        final Set<IType> discoveredTypes = searcher.findTestItemsInContainer(
                nestedType, new NullProgressMonitor());
        assertTrue(discoveredTypes.contains(nestedType));
        assertEquals(TestKind.JUnit6, searcher.getTestKind());
        assertEquals("org.eclipse.jdt.junit.loader.junit6", searcher.getJdtTestKind());
    }
}
