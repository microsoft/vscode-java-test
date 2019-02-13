# Java Test Runner

[![Travis CI](https://travis-ci.org/Microsoft/vscode-java-test.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-java-test)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/Microsoft/vscode-java-test.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/Microsoft/vscode-java-test/alerts/)
[![Gitter](https://badges.gitter.im/Microsoft/vscode-java-test.svg)](https://gitter.im/Microsoft/vscode-java-test)

## Overview

A lightweight extension to run and debug Java test cases in Visual Studio Code. The extension support following test frameworks:

- JUnit 4 (v4.8.0+)
- JUnit 5 (v5.1.0+)
- TestNG (v6.8.0+)

The [Java Test Runner](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-test) works with [Language Support for Java by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java) and [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) to provide the following features:

- Run test cases
- Debug test cases
- View test report
- View tests in Test Explorer

## Usage

![Run/debug JUnit test](demo/demo.gif)

## Available commands

You can find the following commands in the Command Palette (<kbd>**F1**</kbd> / <kbd>**Ctrl + Shift + P**</kbd>):
- `Java: Show Test Output`: Open the test output window.
- `Java: Open Test Runner Log`: Open the log file.
- `Java: Cancel Test Job`: Cancel the currently being executed test task.

## Supported VSCode settings

| Setting Name | Description | Default Value |
|---|---|---|
| `java.test.report.position` | Specify where to show the test report. Supported values are: `sideView`, `currentView`. | `sideView` |
| `java.test.log.level` | Specify the level of the test logs. Supported values are: `error`, `info`, `verbose`. | `info` |
| `java.test.config` | Specify the configuration for the test cases to run with. [More details](https://aka.ms/java-test-config). | `{}` |
| `java.test.defaultConfig` | Specify the name of the default test configuration. | `""` |

## Requirements

- JDK (version 1.8.0 or later)
- VS Code (version 1.23.0 or later)
- [Language Support for Java by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java)
- [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug)

## Contribuing and Feedback
If you are interested in providing feedback or contributing directly to the code base, please check the document [Contributing to Java Test Runner](https://github.com/Microsoft/vscode-java-test/blob/master/CONTRIBUTING.md), which covers the following parts:
- [Questions and Feedback](https://github.com/Microsoft/vscode-java-test/blob/master/CONTRIBUTING.md#questions-and-feedback)
- [Reporting Issues](https://github.com/Microsoft/vscode-java-test/blob/master/CONTRIBUTING.md#reporting-issues)
- [Contributing Fixes](https://github.com/Microsoft/vscode-java-test/blob/master/CONTRIBUTING.md#contributing-fixes)

## License

This extension is licensed under [MIT License](LICENSE.txt).

## Data/Telemetry

This extension collects telemetry data to help improve our products. Please read [Microsoft privacy statement](https://privacy.microsoft.com/en-us/privacystatement) to learn more. If you opt out to send telemetry data to Microsoft, please set below configuration in settings.json: `telemetry.enableTelemetry = false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).
