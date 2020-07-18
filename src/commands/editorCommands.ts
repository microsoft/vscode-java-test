import { readFileSync } from 'fs';
import { window } from 'vscode';
import { logger } from '../logger/logger';
import { TestKind, TestLevel } from '../protocols';
import { IRunnerContext } from '../runners/models';
import { runnerScheduler } from '../runners/runnerScheduler';
import { searchTestItems } from './explorerCommands';

export async function runTestsInActiveEditor(): Promise<void> {
    return executeTestsInActiveEditor(false);
}

async function executeTestsInActiveEditor(isDebug: boolean): Promise<void> {
    let path: string = '';
    if (window.activeTextEditor) {
        path = window.activeTextEditor.document.uri.fsPath;
    } else {
        return;
    }
    const parts: string[] = path.split('/');
    const fileName: string = parts[parts.length - 1];
    const className: string = fileName.split('.')[0];
    const classFileContent: string = readFileSync(path, 'utf8');
    const packageLine: RegExpMatchArray | null  = classFileContent.match(/^package .*;$/gm);
    let packageLineParts: string[];
    let packageName: string;
    if (packageLine) {
        packageLineParts = packageLine[0].split(' ');
        packageName = packageLineParts[1];
        packageName = packageName.substr(0, packageName.length - 1);
    } else {
        return;
    }
    const runnerContext: IRunnerContext = {
        scope: TestLevel.Class,
        testUri: `file://${path}`,
        fullName: `${packageName}.${className}`,
        paramTypes: [],
        projectName: '',
        kind: TestKind.None,
        isDebug,
        tests: [],
    };
    await searchTestItems(runnerContext);
    if (!runnerContext.tests) {
        logger.info('Test job is canceled.');
        return;
    } else if (runnerContext.tests.length <= 0) {
        logger.info('No test items found.');
        return;
    }
    return runnerScheduler.run(runnerContext);
}
