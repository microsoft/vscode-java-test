/*******************************************************************************
* Copyright (c) 2023 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.coverage;

import com.microsoft.java.test.plugin.coverage.model.BranchCoverage;
import com.microsoft.java.test.plugin.coverage.model.LineCoverage;
import com.microsoft.java.test.plugin.coverage.model.MethodCoverage;
import com.microsoft.java.test.plugin.coverage.model.SourceFileCoverage;
import com.microsoft.java.test.plugin.util.JUnitPlugin;
import com.microsoft.java.test.plugin.util.ProjectTestUtils;

import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.internal.core.ClasspathEntry;
import org.eclipse.jdt.ls.core.internal.managers.ProjectsManager;
import org.jacoco.core.analysis.Analyzer;
import org.jacoco.core.analysis.CoverageBuilder;
import org.jacoco.core.analysis.IClassCoverage;
import org.jacoco.core.analysis.ICounter;
import org.jacoco.core.analysis.ILine;
import org.jacoco.core.analysis.IMethodCoverage;
import org.jacoco.core.analysis.ISourceFileCoverage;
import org.jacoco.core.analysis.ISourceNode;
import org.jacoco.core.tools.ExecFileLoader;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

public class CoverageHandler {

    private IJavaProject javaProject;
    private Path reportBasePath;

    /**
     * The Jacoco data file name
     */
    private static final String JACOCO_EXEC = "jacoco.exec";

    public CoverageHandler(IJavaProject javaProject, String basePath) {
        this.javaProject = javaProject;
        reportBasePath = Paths.get(basePath);
    }

    public List<SourceFileCoverage> getCoverageDetail(IProgressMonitor monitor) throws JavaModelException, IOException {
        if (ProjectsManager.DEFAULT_PROJECT_NAME.equals(javaProject.getProject().getName())) {
            Collections.emptyList();
        }
        final List<SourceFileCoverage> coverage = new LinkedList<>();
        final Map<IPath, List<IPath>> outputToSourcePaths = getOutputToSourcePathsMapping();

        final File executionDataFile = reportBasePath.resolve(JACOCO_EXEC).toFile();
        final ExecFileLoader execFileLoader = new ExecFileLoader();
        execFileLoader.load(executionDataFile);
        for (final Map.Entry<IPath, List<IPath>> entry : outputToSourcePaths.entrySet()) {
            final CoverageBuilder coverageBuilder = new CoverageBuilder();
            final Analyzer analyzer = new Analyzer(
                    execFileLoader.getExecutionDataStore(), coverageBuilder);
            final File outputDirectory = getFileForFs(javaProject, entry.getKey());
            analyzer.analyzeAll(outputDirectory);
            for (final ISourceFileCoverage sourceFileCoverage : coverageBuilder.getSourceFiles()) {
                if (monitor.isCanceled()) {
                    return Collections.emptyList();
                }

                if (sourceFileCoverage.getFirstLine() == ISourceNode.UNKNOWN_LINE) {
                    JUnitPlugin.logError("Missing debug information for file: " + sourceFileCoverage.getName());
                    continue; // no debug information
                }
                final File sourceFile = getSourceFile(entry.getValue(), sourceFileCoverage);
                if (sourceFile == null) {
                    JUnitPlugin.logError("Cannot find file: " + sourceFileCoverage.getName());
                    continue;
                }

                final URI uri = sourceFile.toURI();
                final List<LineCoverage> lineCoverages = getLineCoverages(sourceFileCoverage);
                final List<MethodCoverage> methodCoverages = getMethodCoverages(coverageBuilder,
                        sourceFileCoverage);
                coverage.add(new SourceFileCoverage(uri.toString(), lineCoverages, methodCoverages));
            }
        }
        return coverage;
    }

    private Map<IPath, List<IPath>> getOutputToSourcePathsMapping() throws JavaModelException {
        final Map<IPath, List<IPath>> outputToSourcePaths = new HashMap<>();
        for (final IClasspathEntry entry : javaProject.getRawClasspath()) {
            if (entry.getEntryKind() != ClasspathEntry.CPE_SOURCE ||
                    ProjectTestUtils.isTestEntry(entry)) {
                continue;
            }

            final IPath sourceRelativePath = entry.getPath().makeRelativeTo(javaProject.getProject().getFullPath());
            IPath outputLocation = entry.getOutputLocation();
            if (outputLocation == null) {
                outputLocation = javaProject.getOutputLocation();
            }
            final IPath outputRelativePath = outputLocation.makeRelativeTo(javaProject.getProject().getFullPath());
            outputToSourcePaths.computeIfAbsent(outputRelativePath, k -> new LinkedList<>()).add(sourceRelativePath);
        }
        return outputToSourcePaths;
    }

    /**
     * Infer the source file for the given {@link ISourceFileCoverage}. If no file found, return <code>null</code>.
     */
    private File getSourceFile(List<IPath> sourceRoots, ISourceFileCoverage sourceFileCoverage) {
        final String packagePath = sourceFileCoverage.getPackageName().replace(".", "/");
        final IPath sourceRelativePath = new org.eclipse.core.runtime.Path(packagePath)
                .append(sourceFileCoverage.getName());
        for (final IPath sourceRoot : sourceRoots) {
            final IPath relativePath = sourceRoot.append(sourceRelativePath);
            final File sourceFile = getFileForFs(javaProject, relativePath);
            if (sourceFile.exists()) {
                return sourceFile;
            }
        }
        return null;
    }

    private static File getFileForFs(IJavaProject javaProject, IPath path) {
        return javaProject.getProject().getLocation().append(path).toFile();
    }

    private List<LineCoverage> getLineCoverages(final ISourceFileCoverage sourceFileCoverage) {
        final List<LineCoverage> lineCoverages = new LinkedList<>();
        final int last = sourceFileCoverage.getLastLine();
        for (int nr = sourceFileCoverage.getFirstLine(); nr <= last; nr++) {
            final ILine line = sourceFileCoverage.getLine(nr);
            if (line.getStatus() != ICounter.EMPTY) {
                final List<BranchCoverage> branchCoverages = new LinkedList<>();
                for (int i = 0; i < line.getBranchCounter().getTotalCount(); i++) {
                    branchCoverages.add(new BranchCoverage(
                        i < line.getBranchCounter().getCoveredCount() ? 1 : 0));
                }
                lineCoverages.add(new LineCoverage(
                    nr,
                    line.getInstructionCounter().getCoveredCount(),
                    branchCoverages
                ));
            }
        }
        return lineCoverages;
    }

    private List<MethodCoverage> getMethodCoverages(final CoverageBuilder coverageBuilder,
            final ISourceFileCoverage sourceFileCoverage) {
        final List<MethodCoverage> methodCoverages = new LinkedList<>();
        for (final IClassCoverage classCoverage : coverageBuilder.getClasses()) {
            if (classCoverage.getSourceFileName().equals(sourceFileCoverage.getName())) {
                for (final IMethodCoverage methodCoverage : classCoverage.getMethods()) {
                    methodCoverages.add(new MethodCoverage(
                        methodCoverage.getFirstLine(),
                        methodCoverage.getMethodCounter().getCoveredCount() > 0 ? 1 : 0,
                        methodCoverage.getName()
                    ));
                }
            }
        }
        return methodCoverages;
    }
}
