// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export const MAX_CLASS_PATH_LENGTH: number = 4096;

export const LOG_FILE_NAME: string = 'java_test_runner.log';
export const LOG_FILE_MAX_SIZE: number = 5 * 1024 * 1024;
export const LOG_FILE_MAX_NUMBER: number = 2;
export const LOG_LEVEL_SETTING_KEY: string = 'java.test.log.level';
export const DEFAULT_LOG_LEVEL: string = 'info';

export const DEFAULT_CONFIG_NAME_SETTING_KEY: string = 'java.test.defaultConfig';
export const CONFIG_SETTING_KEY: string = 'java.test.config';
export const BUILTIN_CONFIG_NAME: string = 'default';

export const REPORT_POSITION_SETTING_KEY: string = 'java.test.report.position';
export const DEFAULT_REPORT_POSITION: string = 'sideView';

export const REPORT_SHOW_SETTING_KEY: string = 'java.test.report.showAfterExecution';
export const DEFAULT_REPORT_SHOW: string = 'onFailure';

export const HINT_FOR_DEPRECATED_CONFIG_SETTING_KEY: string = 'java.test.message.hintForDeprecatedConfig';
export const CONFIG_DOCUMENT_URL: string = 'https://aka.ms/java-test-config';
export const HINT_FOR_DEFAULT_CONFIG_SETTING_KEY: string = 'java.test.message.hintForSetingDefaultConfig';

export enum ReportShowSetting {
    Always = 'always',
    OnFail = 'onFailure',
    Never = 'never',
}
