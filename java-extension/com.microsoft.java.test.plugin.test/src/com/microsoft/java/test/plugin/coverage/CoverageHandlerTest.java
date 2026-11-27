/*******************************************************************************
* Copyright (c) 2024 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.coverage;

import com.microsoft.java.test.plugin.AbstractProjectsManagerBasedTest;
import com.microsoft.java.test.plugin.coverage.model.LineCoverage;
import com.microsoft.java.test.plugin.coverage.model.MethodCoverage;
import com.microsoft.java.test.plugin.coverage.model.SourceFileCoverage;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaCore;
import org.junit.Test;

import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class CoverageHandlerTest extends AbstractProjectsManagerBasedTest {

    @Test
    public void testGetCoverageDetail() throws Exception {
        final List<IProject> projects = importProjects("coverage-test");
        assertEquals("Expected one imported coverage project", 1, projects.size());
        final IJavaProject javaProject = JavaCore.create(projects.get(0));
        assertTrue("The imported coverage project must be a Java project", javaProject.exists());
        final String basePath = javaProject.getProject().getLocation().toFile().getAbsolutePath();
        final CoverageHandler coverageHandler = new CoverageHandler(javaProject, basePath);
        final List<SourceFileCoverage> coverageDetail = coverageHandler.getCoverageDetail(new NullProgressMonitor());
        assertFalse("Expected coverage for the sample source", coverageDetail.isEmpty());
        for (final SourceFileCoverage fileCoverage : coverageDetail) {
            for (final LineCoverage lineCoverage : fileCoverage.getLineCoverages()) {
                assertTrue(lineCoverage.getLineNumber() > 0);
            }

            for (final MethodCoverage methodCoverage : fileCoverage.getMethodCoverages()) {
                assertTrue(methodCoverage.getLineNumber() > 0);
            }
        }
    }

}
