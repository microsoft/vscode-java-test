# Test Runner/Debugger for Java

[![Travis CI](https://travis-ci.org/Microsoft/vscode-java-test.svg?branch=newdesign)](https://travis-ci.org/Microsoft/vscode-java-test)

## Overview

A lightweight test runner/debugger which depends on [Language Support for Java by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java) and [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug). Here is a list of features:

- Recognize Junit4 tests
- Run test
- Debug test
- View test status/run summary

## Requirements

- JDK (version 1.8.0 or later)
- VS Code (version 1.17.0 or later)
- [Language Support for Java by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java) (version 0.14.0 or later)
- [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug)
- JUnit4: 4.8.0 or later

## Use

![Run/debug Junit test](demo/junit-demo.gif)

## User Settings

- `java.test.port`： Test server port, defaults to 5555

## Feedback and Questions

You can find the full list of issues at [Issue Tracker](https://github.com/Microsoft/vscode-java-test/issues). You can submit a [bug or feature suggestion](https://github.com/Microsoft/vscode-java-test/issues/new).

## License

This extension is licensed under [MIT License](LICENSE.txt).
