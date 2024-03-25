// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { BranchCoverage, DeclarationCoverage, FileCoverage, FileCoverageDetail, Position, StatementCoverage, TestRun, Uri } from 'vscode';
import { getJacocoReportBasePath } from '../utils/coverageUtils';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';
import { JavaTestRunnerDelegateCommands } from '../constants';

export class JavaTestCoverageProvider {

    private coverageDetails: Map<Uri, FileCoverageDetail[]> = new Map<Uri, FileCoverageDetail[]>();

    public async provideFileCoverage(run: TestRun, projectName: string): Promise<void> {
        const sourceFileCoverages: ISourceFileCoverage[] = await executeJavaLanguageServerCommand<void>(JavaTestRunnerDelegateCommands.GET_COVERAGE_DETAIL,
            projectName, getJacocoReportBasePath(projectName)) || [];
        for (const sourceFileCoverage of sourceFileCoverages) {
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
