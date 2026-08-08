// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
import * as minimatch from 'minimatch';
import { BranchCoverage, DeclarationCoverage, FileCoverage, FileCoverageDetail, Position, StatementCoverage, Uri, window } from 'vscode';
import { getDelegatedExecutionDataRoot, getJacocoReportBasePath } from '../utils/coverageUtils';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';
import { JavaTestRunnerDelegateCommands } from '../constants';
import { IRunTestContext } from '../java-test-runner.api';

export class JavaTestCoverageProvider {

    private coverageDetails: Map<Uri, FileCoverageDetail[]> = new Map<Uri, FileCoverageDetail[]>();

    public async provideFileCoverage(context: IRunTestContext): Promise<void> {
        const {testRun: run, projectName, testConfig} = context;
        let sourceFileCoverages: ISourceFileCoverage[];
        try {
            sourceFileCoverages = await executeJavaLanguageServerCommand<void>(JavaTestRunnerDelegateCommands.GET_COVERAGE_DETAIL,
                projectName, getAnalysisPath(context)) || [];
        } catch (error) {
            // Reporting nothing is better than reporting a report-shaped 0%, and the run
            // itself already succeeded, so surface the failure without failing the tests.
            window.showErrorMessage(`Failed to analyze test coverage for '${projectName}': ${error instanceof Error ? error.message : error}`);
            return;
        }
        const sourceFileCoverageExclusions: minimatch.Minimatch[] = (testConfig?.coverage?.excludes ?? []).map((exclusion: string) =>
            new minimatch.Minimatch(exclusion, {flipNegate: true, nonegate: true}));
        const sourceFileCoveragesToReport: ISourceFileCoverage[] = [];
        if (sourceFileCoverageExclusions.length <= 0) {
            sourceFileCoveragesToReport.push(...sourceFileCoverages);
        } else {
            sourceFileCoverages.forEach((sourceFileCoverage: ISourceFileCoverage) => {
                const uri: Uri = Uri.parse(sourceFileCoverage.uriString);
                if (!sourceFileCoverageExclusions.some((exclusion: minimatch.Minimatch) =>
                    exclusion.match(uri.fsPath))) {
                    sourceFileCoveragesToReport.push(sourceFileCoverage);
                }
            });
        }
        for (const sourceFileCoverage of sourceFileCoveragesToReport) {
            const uri: Uri = Uri.parse(sourceFileCoverage.uriString);
            const detailedCoverage: FileCoverageDetail[] = [];
            for (const lineCoverage of sourceFileCoverage.lineCoverages) {
                const branchCoverages: BranchCoverage[] = [];
                for (const branchCoverage of lineCoverage.branchCoverages) {
                    branchCoverages.push(new BranchCoverage(branchCoverage.hit, new Position(lineCoverage.lineNumber - 1, 0)));
                }
                const statementCoverage: StatementCoverage = new StatementCoverage(lineCoverage.hit,
                    new Position(lineCoverage.lineNumber - 1, 0), branchCoverages);
                detailedCoverage.push(statementCoverage);
            }
            for (const methodCoverage of sourceFileCoverage.methodCoverages) {
                const functionCoverage: DeclarationCoverage = new DeclarationCoverage(methodCoverage.name, methodCoverage.hit,
                    new Position(methodCoverage.lineNumber - 1, 0));
                detailedCoverage.push(functionCoverage);
            }
            run.addCoverage(FileCoverage.fromDetails(uri, detailedCoverage));
            this.coverageDetails.set(uri, detailedCoverage);
        }
    }

    public getCoverageDetails(uri: Uri): FileCoverageDetail[] {
        return this.coverageDetails.get(uri) || [];
    }
}

/**
 * The directory tree to merge execution data from.
 *
 * The built-in runner keeps appending to one file per project, so JaCoCo's own
 * `append` already implements `appendResult` for it. A delegated runner instead
 * writes into a directory of its own for every run, so `appendResult` becomes a
 * question of how wide to analyze: this run's directory only, or the root that
 * still holds the directories of the runs before it. Expressing it as scope
 * rather than as deleting data keeps concurrent runs from erasing each other.
 */
function getAnalysisPath({projectName, testConfig, coverage}: IRunTestContext): string {
    if (!coverage) {
        return getJacocoReportBasePath(projectName);
    }
    return testConfig?.coverage?.appendResult === false ?
        coverage.executionDataDirectory.fsPath :
        getDelegatedExecutionDataRoot();
}

interface ISourceFileCoverage {
    uriString: string;
    lineCoverages: ILineCoverage[];
    methodCoverages: IMethodCoverages[];
}

interface ILineCoverage {
    lineNumber: number;
    hit: number;
    branchCoverages: IBranchCoverage[];
}

interface IBranchCoverage {
    hit: number;
}

interface IMethodCoverages {
    lineNumber: number;
    hit: number;
    name: string;
}
