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
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.jdt.ls.core.internal.managers.ProjectsManager;
import org.junit.Test;

import java.io.File;
import java.util.Collections;
import java.util.List;

import static org.junit.Assert.assertTrue;

public class CoverageHandlerTest extends AbstractProjectsManagerBasedTest {

    @Test
    public void testGetCoverageDetail() throws Exception {
        importProjects(Collections.singleton("coverage-test"));
        final IJavaProject javaProject = ProjectUtils.getJavaProject("coverage-test");
        final String basePath = new File("projects/coverage-test").getAbsolutePath();
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

}
