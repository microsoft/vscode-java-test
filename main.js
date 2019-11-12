// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

const extension = require("./dist/extension.bundle");

async function activate(ctx) {
    return await extension.activate(ctx);
}

async function deactivate(ctx) {
    return await extension.deactivate(ctx);
}

// Export as entrypoints for vscode
exports.activate = activate;
exports.deactivate = deactivate;
