# Change Log
All notable changes to the "vscode-java-test" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

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
