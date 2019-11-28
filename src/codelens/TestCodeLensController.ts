// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ConfigurationChangeEvent, Disposable, languages, workspace } from 'vscode';
import { ENABLE_EDITOR_SHORTCUTS_KEY } from '../constants/configs';
import { TestCodeLensProvider } from './TestCodeLensProvider';

class TestCodeLensController implements Disposable {
    private internalProvider: TestCodeLensProvider;
    private registeredProvider: Disposable | undefined;
    private configurationChangeListener: Disposable;

    constructor() {
        this.internalProvider = new TestCodeLensProvider();

        this.configurationChangeListener = workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
            if (event.affectsConfiguration(ENABLE_EDITOR_SHORTCUTS_KEY)) {
                this.setCodeLensVisibility();
            }
        }, this);

        this.setCodeLensVisibility();
    }

    public refresh(): void {
        this.internalProvider.refresh();
    }

    public dispose(): void {
        this.internalProvider.dispose();
        if (this.registeredProvider) {
            this.registeredProvider.dispose();
        }
        this.configurationChangeListener.dispose();
    }

    private setCodeLensVisibility(): void {
        if (this.isCodeLensEnabled() && !this.registeredProvider) {
            this.registeredProvider = languages.registerCodeLensProvider({ scheme: 'file', language: 'java' }, this.internalProvider);
        } else if (!this.isCodeLensEnabled() && this.registeredProvider) {
            this.registeredProvider.dispose();
            this.registeredProvider = undefined;
        }
    }

    private isCodeLensEnabled(): boolean {
        return workspace.getConfiguration().get<boolean>(ENABLE_EDITOR_SHORTCUTS_KEY, true);
    }
}

export const testCodeLensController: TestCodeLensController = new TestCodeLensController();
