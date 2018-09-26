# Change Log
All notable changes to the "vscode-java-test" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 0.8.0 - 2018-08-08

### Changed
- Refine the logic to consume test output for JUnit test runner.

### Fixed
- Add project info into `TestSuite`, and run the tests per project to avoid the conflict of classpaths between projects.
- Fix the issue that test output would be truncated when it exceeds buffer size.

## 0.7.1 - 2018-07-11

### Fixed
- Fix the issue that the test runer hangs for some tests.
- Fix classpath resolution issue for the scenario that there are multiple projects in a workspace folder. [#176](https://github.com/Microsoft/vscode-java-test/issues/176)
- Fix bug for default working directory. [#229](https://github.com/Microsoft/vscode-java-test/issues/229)
- Fix bug for test output analyzer. [#231](https://github.com/Microsoft/vscode-java-test/issues/231)
- Add environment variable into test configuration schema.(Thanks @thwfreak for contributing the [pull request](https://github.com/Microsoft/vscode-java-test/pull/225))
- Fix bug for environment variables in the test configuration. [#222](https://github.com/Microsoft/vscode-java-test/issues/222)

## 0.7.0 - 2018-06-26

### Added
- Support configuring environment variables in test configuration.

### Changed
- Move test explorer to Test View container(Thanks @sandy081 for contributing to the [pull request](https://github.com/Microsoft/vscode-java-test/commit/79e0c376a0f25aef520ee3cd877d368ee677d34c).)
- Auto refresh test report when files update. And still show previous test report until user reruns the test.

### Fixed
- Fix bug [#205](https://github.com/Microsoft/vscode-java-test/issues/205) and [#198](https://github.com/Microsoft/vscode-java-test/issues/198). Update classpath when user updates build files.
- Fix bug [#216](https://github.com/Microsoft/vscode-java-test/issues/216).

## 0.6.0 - 2018-04-27

### Added
- Support cancelling a test run. Partial test result would be updated.
- Add JSON schema validation for test configuration file.
- Add `default` field in test configuration where user could specify the default config to pick while invoking command `Run Test`.

### Changed
- Behavior change: after a test run, always show the test report and update test status(might be partial) even when test runner failed.
- Removed `Run With Config` and `Debug with Config` codelens for simplicity. Still, you can invoke the command from test explorer.
- Renamed the test configuration file from `test-launch.json` to `launch.test.json`. Original test configuration file won't be removed, but you might need to copy its content to the new one if you have customized config.

## 0.5.0 - 2018-03-29

### Added
- Support test configuration. You can now configure your test setting through command `java.test.configure`. It supports following configuration:
  * projectName
  * workingDirectory
  * args
  * vmargs
  * preLaunchTask

  And you can run/debug with config through codelens or test explorer context menu.

## 0.4.0 - 2018-03-07

### Added
- Support basic feature of JUnit5

### Fixed
- Fix bug [#99](https://github.com/Microsoft/vscode-java-test/issues/99)
- Fix bug [#130](https://github.com/Microsoft/vscode-java-test/issues/130)

## 0.3.0 - 2018-02-11

### Added
- Trigger tests from test explorer. We now support folder/package/class/method levels or you can run all.
- Add command `Java:Open Log` to open log file.
- Add setting `java.test.report.position` to specify the position of test report.

### Fixed
- Fix bug [#83](https://github.com/Microsoft/vscode-java-test/issues/83)
- Fix bug [#86](https://github.com/Microsoft/vscode-java-test/issues/86)
- Fix bug [#90](https://github.com/Microsoft/vscode-java-test/issues/90)
- Fix bug that test explorer would disappear when opening test report.

## 0.2.0 - 2018-01-05

### Added
- Add Test explorer, you can view/locate all tests from the explorer.
- Add status bar item to show test status and statistics.
- Add command to show test output window. By default it wouldn't be open while running tests.

### Changed
- Make test report more user friendly. No need to save test report any more

### Fixed
- Fix bug [#34](https://github.com/Microsoft/vscode-java-test/issues/34)

## 0.1.0 - 2017-12-01
### Added
- Support JUnit (v4.8.0+) test cases
- Run test cases
- Debug test cases
- View test logs
