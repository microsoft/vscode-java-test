# Java Test Runner

> Run and debug Java test cases in Visual Studio Code

<p align="center">
  <img src="https://raw.githubusercontent.com/Microsoft/vscode-java-test/master/resources/logo.png" width="128" height="128" alt="">
</p>
<p align="center">
  <a href="https://github.com/microsoft/vscode-java-test/actions?query=workflow%3ACI+branch%3Amaster">
    <img src="https://img.shields.io/github/workflow/status/microsoft/vscode-java-test/CI/master?style=flat-square" alt="">
  </a>
  <a href="https://lgtm.com/projects/g/microsoft/vscode-java-test/alerts/?mode=list">
    <img src="https://img.shields.io/lgtm/alerts/g/microsoft/vscode-java-test.svg?style=flat-square" alt="">
  </a>
  <a href="https://gitter.im/microsoft/vscode-java-test">
    <img src="https://img.shields.io/gitter/room/microsoft/vscode-java-test.svg?style=flat-square" alt="">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-test">
    <img src="https://img.shields.io/visual-studio-marketplace/d/vscjava.vscode-java-test.svg?style=flat-square" alt="">
  </a>
</p>

## Overview

A lightweight extension to run and debug Java test cases in Visual Studio Code. The extension support following test frameworks:

- JUnit 4 (v4.8.0+)
- JUnit 5 (v5.1.0+)
- TestNG (v6.8.0+)

> Note: JUnit 3 styled tests are not supported in this extension (i.e. extends `junit.framework.TestCase`).

The [Java Test Runner](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-test) works with [Language Support for Java by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java) and [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) to provide the following features:

- Run/Debug test cases
- Customize test configurations
- View test report
- View tests in Test Explorer
- Show test logs


## Requirements

- JDK (version 11 or later)
- VS Code (version 1.44.0 or later)
- [Language Support for Java by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java)
- [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug)

## Quickstart

![Run/debug JUnit test](demo/demo.gif)

### Getting Started for JUnit 5

Please refer to [Getting Started](https://junit.org/junit5/docs/current/user-guide/#overview-getting-started) from the JUnit 5's official document for getting started guide.

> Note: You can use [junit-platform-console-standalone.jar](https://search.maven.org/search?q=g:org.junit.platform%20AND%20a:junit-platform-console-standalone) in projects that manually manage their dependencies similar to the [plain-old JAR known from JUnit 4](https://github.com/junit-team/junit4/wiki/Download-and-Install#plain-old-jar).

### Getting Started for JUnit 4
Please refer to [Download and Install](https://github.com/junit-team/junit4/wiki/Download-and-Install) from the JUnit 4's official document for the getting started guide.

### Getting Started for TestNG

Please refer to [TestNG Docs](https://testng.org/doc/) from the TestNG's official document for getting started guide.

## Features

### Run/Debug Test Cases
<p align="center">
  <img src="https://raw.githubusercontent.com/Microsoft/vscode-java-test/master/demo/run_codelens.png" style="border-radius: 15px" alt="Run Code Lens"/>
</p>

- The extension will generate `Run Test` and `Debug Test` shortcuts (also known as Code Lens) above the class and method definition. Simply click on them will start running or debugging the target test cases.

> Note: If you cannot see the Code Lens in your editor, please refer to this [issue comment](https://github.com/Microsoft/vscode-java-test/issues/470#issuecomment-444681714) as a workaround.

---

### Test Explorer

<p align="center">
  <img src="https://raw.githubusercontent.com/Microsoft/vscode-java-test/master/demo/run_explorer.png" style="border-radius: 15px" alt="Run Explorer"/>
</p>

- The Test Explorer is the place to show all the test cases in your project. You can also run/debug your test cases from here.
- Click the node in the Test Explorer will navigate to the location of the source code.

> Note: If the Test Explorer is empty, please refer to this [issue comment](https://github.com/Microsoft/vscode-java-test/issues/470#issuecomment-444681714) as a workaround.

---

### Customize Test Configurations
<p align="center">
  <img src="https://raw.githubusercontent.com/Microsoft/vscode-java-test/master/demo/configuration.png" style="border-radius: 15px" alt="Customize Test Configurations"/>
</p>

- Sometimes you may want to customize the configuration for running the test cases. To achieve this, you can add it into your workspace settings under the section: `java.test.config`.

> Note: More details can be found [here](https://github.com/Microsoft/vscode-java-test/wiki/Run-with-Configuration).

---

### View Test Report

<p align="center">
  <img src="https://raw.githubusercontent.com/Microsoft/vscode-java-test/master/demo/status_bar.png" style="border-radius: 15px" alt="Status Bar"/>
</p>

- After running/debugging the test cases, the status bar will show the final results. Simply click on it to show the Test Report.
- You can also click the ✔️ or ❌ mark in Code Lens to open the Test Report.

<p align="center">
  <img src="https://raw.githubusercontent.com/Microsoft/vscode-java-test/master/demo/report_navigate.png" style="border-radius: 15px" alt="Status Bar"/>
</p>

- You can navigate to the source location of the target test case by clicking the navigate button.

> Note: You can use `java.test.report.showAfterExecution` to configure whether to automatically show the test report after execution. By default, it will be shown when there are failed tests. 


## Settings

| Setting Name | Description | Default Value |
|---|---|---|
| `java.test.report.position` | Specify where to show the test report. Supported values are: `sideView`, `currentView`. | `sideView` |
| `java.test.report.showAfterExecution` | Specify if the test report will automatically be shown after execution. Supported values are: `always`, `onFailure`, `never`. | `onFailure` |
| `java.test.editor.enableShortcuts` | Specify whether to show the Code Lenses in editor or not. | `true` |
| `java.test.log.level` | Specify the level of the test logs. Supported values are: `error`, `info`, `verbose`. | `info` |
| `java.test.config` | Specify the configuration for the test cases to run with. [More details](https://aka.ms/java-test-config). | `{}` |
| `java.test.defaultConfig` | Specify the name of the default test configuration. | `""` |

## FAQ
If you meet any problem when using the extension, please refer to the [FAQ](https://github.com/microsoft/vscode-java-test/wiki/FAQ) to check if there is an answer to your problem.

## Contributing and Feedback

If you are interested in providing feedback or contributing directly to the code base, please check the document [Contributing to Java Test Runner](https://github.com/Microsoft/vscode-java-test/blob/master/CONTRIBUTING.md), which covers the following parts:
- [Questions and Feedback](https://github.com/Microsoft/vscode-java-test/blob/master/CONTRIBUTING.md#questions-and-feedback)
- [Reporting Issues](https://github.com/Microsoft/vscode-java-test/blob/master/CONTRIBUTING.md#reporting-issues)
- [Contributing Fixes](https://github.com/Microsoft/vscode-java-test/blob/master/CONTRIBUTING.md#contributing-fixes)

## License

This extension is licensed under [MIT License](LICENSE.txt).

## Telemetry

This extension collects telemetry data to help improve our products. Please read [Microsoft privacy statement](https://privacy.microsoft.com/en-us/privacystatement) to learn more. If you opt out to send telemetry data to Microsoft, please set below configuration in settings.json: `telemetry.enableTelemetry = false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).
