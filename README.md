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

- `java.test.report.position`: Specify where to show the test report. Supported values are `sideView`, `currentView`. The default value is `sideView`.

## Requirements

- JDK (version 1.8.0 or later)
- VS Code (version 1.23.0 or later)
- [Language Support for Java by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java)
- [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug)

## Feedback and Questions

You can find the full list of issues at [Issue Tracker](https://github.com/Microsoft/vscode-java-test/issues). You can submit a [bug or feature suggestion](https://github.com/Microsoft/vscode-java-test/issues/new).

## License

This extension is licensed under [MIT License](LICENSE.txt).

## Data/Telemetry

This extension collects telemetry data to help improve our products. Please read [Microsoft privacy statement](https://privacy.microsoft.com/en-us/privacystatement) to learn more. If you opt out to send telemetry data to Microsoft, please set below configuration in settings.json: `telemetry.enableTelemetry = false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).
