// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
import * as minimatch from 'minimatch';
import { BranchCoverage, DeclarationCoverage, FileCoverage, FileCoverageDetail, Position, StatementCoverage, Uri } from 'vscode';
import { getJacocoReportBasePath } from '../utils/coverageUtils';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';
import { JavaTestRunnerDelegateCommands } from '../constants';
import { IRunTestContext } from '../java-test-runner.api';

export class JavaTestCoverageProvider {

    private coverageDetails: Map<Uri, FileCoverageDetail[]> = new Map<Uri, FileCoverageDetail[]>();

    public async provideFileCoverage({testRun: run, projectName, testConfig}: IRunTestContext): Promise<void> {
        const sourceFileCoverages: ISourceFileCoverage[] = await executeJavaLanguageServerCommand<void>(JavaTestRunnerDelegateCommands.GET_COVERAGE_DETAIL,
            projectName, getJacocoReportBasePath(projectName)) || [];
        const sourceFileCoverageExclusions: minimatch.Minimatch[] = (testConfig?.coverage?.excludes ?? []).map((exclusion: string) =>
            new minimatch.Minimatch(exclusion, {flipNegate: true}));
        const sourceFileCoveragesToReport: ISourceFileCoverage[] = sourceFileCoverageExclusions.length > 0 ?
            sourceFileCoverageExclusions
                .reduce((results: ISourceFileCoverage[], exclusion: minimatch.Minimatch) =>
                    results.filter((sourceFile: ISourceFileCoverage) =>
                        exclusion.match(Uri.parse(sourceFile.uriString).fsPath)), sourceFileCoverages) :
            sourceFileCoverages;
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
