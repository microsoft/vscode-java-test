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

import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.junit.Test;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Collections;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class CoverageHandlerTest extends AbstractProjectsManagerBasedTest {

    @Test
    public void testGetCoverageDetail() throws Exception {
        importProjects(Collections.singleton("coverage-test"));
        final IJavaProject javaProject = ProjectUtils.getJavaProject("coverage-test");
        final String basePath = javaProject.getProject().getLocation().toFile().getAbsolutePath();
        final CoverageHandler coverageHandler = new CoverageHandler(javaProject, basePath);
        final List<SourceFileCoverage> coverageDetail = coverageHandler.getCoverageDetail(new NullProgressMonitor());
        for (final SourceFileCoverage fileCoverage : coverageDetail) {
            for (final LineCoverage lineCoverage : fileCoverage.getLineCoverages()) {
                assertTrue(lineCoverage.getLineNumber() > 0);
            }

            for (final MethodCoverage methodCoverage : fileCoverage.getMethodCoverages()) {
                assertTrue(methodCoverage.getLineNumber() > 0);
            }
        }
    }

    @Test
    public void testGetCoverageDetailFindsNestedExecFiles() throws Exception {
        importProjects(Collections.singleton("coverage-test"));
        final IJavaProject javaProject = ProjectUtils.getJavaProject("coverage-test");
        final File projectDir = javaProject.getProject().getLocation().toFile();

        // Baseline: execution data discovered directly under the base path.
        final List<SourceFileCoverage> rootCoverage =
                new CoverageHandler(javaProject, projectDir.getAbsolutePath())
                        .getCoverageDetail(new NullProgressMonitor());

        // The same execution data placed only in a nested sub-directory must be
        // discovered recursively (a delegated run writes `.exec` files per
        // project/task sub-directory) and yield the same coverage.
        final File nestedBase = new File(projectDir, "nested-exec");
        final File nestedDir = new File(nestedBase, "sub");
        nestedDir.mkdirs();
        Files.copy(new File(projectDir, "jacoco.exec").toPath(),
                new File(nestedDir, "jacocoNested.exec").toPath(),
                StandardCopyOption.REPLACE_EXISTING);
        final List<SourceFileCoverage> nestedCoverage =
                new CoverageHandler(javaProject, nestedBase.getAbsolutePath())
                        .getCoverageDetail(new NullProgressMonitor());

        assertEquals(rootCoverage.size(), nestedCoverage.size());
    }

}
