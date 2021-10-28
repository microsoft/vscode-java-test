// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Container } from 'inversify';
import { IProjectsExplorerTestRunner, ProjectsExplorerTestRunner } from './commands/projectExplorerCommands';
import { ITestsExplorerTestRunner, TestsExplorerTestRunner } from './commands/testExplorerCommands';
import { JavaTestController } from './controller/testController';
import { ITestController } from './controller/types';

const inversifyContainer: Container = new Container();
inversifyContainer.bind<ITestController>(ITestController).to(JavaTestController).inSingletonScope();
inversifyContainer.bind<ITestsExplorerTestRunner>(ITestsExplorerTestRunner).to(TestsExplorerTestRunner);
inversifyContainer.bind<IProjectsExplorerTestRunner>(IProjectsExplorerTestRunner).to(ProjectsExplorerTestRunner);

export default inversifyContainer;