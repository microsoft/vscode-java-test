// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Container } from 'inversify';
import 'reflect-metadata';
import { ITestTagStore, TestTagStore } from './controller/testTagStore';

const inversifyContainer: Container = new Container();
inversifyContainer.bind<ITestTagStore>(ITestTagStore).to(TestTagStore).inSingletonScope();

export default inversifyContainer;
