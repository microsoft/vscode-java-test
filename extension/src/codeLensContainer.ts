// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ConfigurationChangeEvent, Disposable, languages, workspace, WorkspaceConfiguration } from 'vscode';
import { testCodeLensProvider } from './codeLensProvider';

const JAVA_TEST_SETTINGS_CONFIGURATION: string = 'java.test.settings';
const ENABLE_CODE_LENS_VARIABLE: string = 'enableTestCodeLens';
const LANGUAGE: string = 'java';

class TestCodeLensContainer implements Disposable {
  private lensProvider: Disposable | undefined;
  private configurationEvent: Disposable;

  constructor() {
    const configuration: WorkspaceConfiguration = workspace.getConfiguration(JAVA_TEST_SETTINGS_CONFIGURATION);
    const isCodeLenseEnabled: boolean | undefined = configuration.get<boolean>(ENABLE_CODE_LENS_VARIABLE);
    if (isCodeLenseEnabled) {
        this.lensProvider = languages.registerCodeLensProvider(LANGUAGE, testCodeLensProvider);
    }

    this.configurationEvent = workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
      if (event.affectsConfiguration(JAVA_TEST_SETTINGS_CONFIGURATION)) {
        const newConfiguration: WorkspaceConfiguration = workspace.getConfiguration(JAVA_TEST_SETTINGS_CONFIGURATION);
        const newEnabled: boolean | undefined = newConfiguration.get<boolean>(ENABLE_CODE_LENS_VARIABLE);
        if (newEnabled && this.lensProvider === undefined) {
            this.lensProvider = languages.registerCodeLensProvider(LANGUAGE, testCodeLensProvider);
        } else if (!newEnabled && this.lensProvider !== undefined) {
            this.lensProvider.dispose();
            this.lensProvider = undefined;
        }
    }
    }, this);
  }

  public dispose(): void {
    if (this.lensProvider !== undefined) {
        this.lensProvider.dispose();
    }
    this.configurationEvent.dispose();
  }
}

export const testCodeLensContainer: TestCodeLensContainer = new TestCodeLensContainer();
