# Java Test Runner

[![Travis CI](https://travis-ci.org/Microsoft/vscode-java-test.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-java-test)

## Overview

A lightweight extension to run and debug Java test cases in Visual Studio Code. It works with [Language Support for Java by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java) and [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) to provide the following features:

- Support JUnit (v4.8.0+) test cases
- Run test cases
- Debug test cases
- View test logs
- View test report
- Test Explorer
- Test Configuration
- Cancel a test run

## Use

![Run/debug JUnit test](https://raw.githubusercontent.com/Microsoft/vscode-java-test/master/extension/demo/junit-demo-2-11.gif)

## Available commands

- `Java:Show test output`: open the test output window.
- `Java:Open Log`: open extension log file.
- `Java:Edit Test Configuration`: edit test configuration.

## Supported VSCode settings

- `java.test.report.position`: Specify where to show the test report. Supported values are `sideView`, `currentView`. The default value is `sideView`.
- `java.test.settings.enableTestCodeLens`: enable the code lens provider for the test and debug buttons over test entry points, defaults to `true`.

## Requirements

- JDK (version 1.8.0 or later)
- VS Code (version 1.23.0 or later)
- [Language Support for Java by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java) (version 0.14.0 or later)
- [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug)
- JUnit4: 4.8.0 or later

## Feedback and Questions

You can find the full list of issues at [Issue Tracker](https://github.com/Microsoft/vscode-java-test/issues). You can submit a [bug or feature suggestion](https://github.com/Microsoft/vscode-java-test/issues/new).

## License

This extension is licensed under [MIT License](LICENSE.txt).

## Data/Telemetry

This extension collects telemetry data to help improve our products. Please read [Microsoft privacy statement](https://privacy.microsoft.com/en-us/privacystatement) to learn more. If you opt out to send telemetry data to Microsoft, please set below configuration in settings.json: `telemetry.enableTelemetry = false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).
