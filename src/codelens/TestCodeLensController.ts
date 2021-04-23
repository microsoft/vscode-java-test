// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ConfigurationChangeEvent, Disposable, DocumentSelector, languages, RelativePattern, workspace } from 'vscode';
import { ENABLE_EDITOR_SHORTCUTS_KEY } from '../constants/configs';
import { testSourceProvider } from '../provider/testSourceProvider';
import { parseDocumentSelector } from '../utils/uiUtils';
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

    public async registerCodeLensProvider(): Promise<void> {
        if (this.registeredProvider) {
            this.registeredProvider.dispose();
        }

        const patterns: RelativePattern[] = await testSourceProvider.getTestSourcePattern();

        const documentSelector: DocumentSelector = parseDocumentSelector(patterns);

        this.registeredProvider = languages.registerCodeLensProvider(documentSelector, this.internalProvider);
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
        this.internalProvider.setIsActivated(this.isCodeLensEnabled());
    }

    private isCodeLensEnabled(): boolean {
        return workspace.getConfiguration().get<boolean>(ENABLE_EDITOR_SHORTCUTS_KEY, true);
    }
}

export const testCodeLensController: TestCodeLensController = new TestCodeLensController();
