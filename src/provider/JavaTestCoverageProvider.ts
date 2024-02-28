// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { BranchCoverage, CancellationToken, DeclarationCoverage, DetailedCoverage, FileCoverage, Position, StatementCoverage, TestCoverageProvider, Uri } from 'vscode';
import { getJacocoReportBasePath } from '../utils/coverageUtils';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';
import { JavaTestRunnerDelegateCommands } from '../constants';

export class JavaTestCoverageProvider implements TestCoverageProvider {

    private projectNames: Set<string>;

    constructor() {
        this.projectNames = new Set<string>();
    }

    public addProject(projectName: string): void {
        this.projectNames.add(projectName);
    }

    public async provideFileCoverage(token: CancellationToken): Promise<FileCoverage[]> {
        const fileCoverages: FileCoverage[] = [];
        for (const projectName of this.projectNames) {
            const sourceFileCoverages: ISourceFileCoverage[] = await executeJavaLanguageServerCommand<void>(JavaTestRunnerDelegateCommands.GET_COVERAGE_DETAIL,
                projectName, getJacocoReportBasePath(projectName), token) || [];
            if (token.isCancellationRequested) {
                return [];
            }

            for (const sourceFileCoverage of sourceFileCoverages) {
                const uri: Uri = Uri.parse(sourceFileCoverage.uriString);
                const detailedCoverage: DetailedCoverage[] = [];
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
                fileCoverages.push(FileCoverage.fromDetails(uri, detailedCoverage));
            }
        }
        return fileCoverages;
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
