# Change Log
All notable changes to the "vscode-java-test" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 0.43.1
## What's Changed
* chore(deps): bump serialize-javascript and mocha by @dependabot in https://github.com/microsoft/vscode-java-test/pull/1754
* Update to Jacoco 0.8.13 by @rgrunber in https://github.com/microsoft/vscode-java-test/pull/1764

## New Contributors
* @rgrunber made their first contribution in https://github.com/microsoft/vscode-java-test/pull/1764

## 0.43.0
## What's Changed
* feat - Set which encoding your test JVM will start with by @awilkins in https://github.com/microsoft/vscode-java-test/pull/1735
* fix - method parsing error by @jdneo in https://github.com/microsoft/vscode-java-test/pull/1722
* fix - Use project's jacoco agent when it's available by @jdneo in https://github.com/microsoft/vscode-java-test/pull/1723
* docs - Fix TestNG Docs link by @antublue in https://github.com/microsoft/vscode-java-test/pull/1736
* build - Update jacoco to 0.8.12 by @jdneo in https://github.com/microsoft/vscode-java-test/pull/1720

## New Contributors
* @antublue made their first contribution in https://github.com/microsoft/vscode-java-test/pull/1736
* @awilkins made their first contribution in https://github.com/microsoft/vscode-java-test/pull/1735

## 0.42.0
## What's Changed
* feat - allow other extensions to register test runner by @jdneo in https://github.com/microsoft/vscode-java-test/pull/1705

## 0.41.1
### Fixed
- Line breaks not working in test result panels. [#1678](https://github.com/microsoft/vscode-java-test/issues/1678)
- Update org.jacoco.core to 8.12. [#1681](https://github.com/microsoft/vscode-java-test/issues/1681)

## 0.41.0
### Added
- Support test coverage. [#387](https://github.com/microsoft/vscode-java-test/issues/387)
- Support when clause for test configurations. [#1627](https://github.com/microsoft/vscode-java-test/issues/1627), contributed by [@ReubenFrankel](https://github.com/ReubenFrankel)

### Fixed
- Upgrade tycho to v4.0.5. [#1656](https://github.com/microsoft/vscode-java-test/issues/1656), contributed by [@baronswindle](https://github.com/baronswindle)
- Correct JDK requirement in readme page. [PR#1667](https://github.com/microsoft/vscode-java-test/pull/1667), contributed by [@hacke2](https://github.com/hacke2)


## 0.40.1
### Fixed
- The working directory is not set to folder opened in VS Code when it's unmanaged folder. [#1606](https://github.com/microsoft/vscode-java-test/issues/1606)
- JUnit5 DynamicContainer are not working. [#1617](https://github.com/microsoft/vscode-java-test/issues/1617)
- NPE when get test source paths. [#1621](https://github.com/microsoft/vscode-java-test/issues/1621)

## 0.40.0
### Added
- support to specify java executable. [PR#1602](https://github.com/microsoft/vscode-java-test/pull/1602), contributed by [@gayanper](https://github.com/gayanper)

### Fixed
- Editor gutter shortcuts disappear. [#1604](https://github.com/microsoft/vscode-java-test/issues/1604)

## 0.39.1
### Removed
- Remove marketplace preview flag. [PR#1592](https://github.com/microsoft/vscode-java-test/pull/1592)

## 0.39.0
### Added
- Support 'postDebugTask' in test configuration. [#1557](https://github.com/microsoft/vscode-java-test/issues/1557)

### Fixed
- Resource nodes in Java Projects view should not have run test actions. [#1559](https://github.com/microsoft/vscode-java-test/issues/1559)
- Cannot run @TestFactory tests. [#1565](https://github.com/microsoft/vscode-java-test/issues/1565)

## 0.38.2
### Fixed
- Cannot run test with older versions of TestNG. [#1540](https://github.com/microsoft/vscode-java-test/issues/1540), contributed by [@Kropie](https://github.com/Kropie)
- "Resolving launch configuration" never finishes when exception happens. [#1543](https://github.com/microsoft/vscode-java-test/issues/1536)
- Update target platform. [PR#1549](https://github.com/microsoft/vscode-java-test/pull/1549), contributed by [@Frederick888](https://github.com/Frederick888)

## 0.38.1
### Added
- Support JUnit 5 parallel execution. [#1472](https://github.com/microsoft/vscode-java-test/issues/1472), contributed by [@fladdimir](https://github.com/fladdimir)

### Fixed
- Sorting of parameterized tests should be natural. [#1465](https://github.com/microsoft/vscode-java-test/issues/1465), contributed by [@Kropie](https://github.com/Kropie)
- Diff test messages may be duplicated. [#1522](https://github.com/microsoft/vscode-java-test/issues/1522), contributed by [@fladdimir](https://github.com/fladdimir)
- Overload test methods are not handled properly. [#1517](https://github.com/microsoft/vscode-java-test/issues/1517), contributed by [@Kropie](https://github.com/Kropie)

## 0.37.1
### Fixed
- Tests cannot be launched. [#1481](https://github.com/microsoft/vscode-java-test/issues/1481)

## 0.37.0
### Added
- Support filtering tests by JUnit 5 tags via setting `java.test.config`. [#1092](https://github.com/microsoft/vscode-java-test/issues/1092)

### Changed
- Scan two levels of directories for activation indicators. [#1460](https://github.com/microsoft/vscode-java-test/issues/1460)

### Fixed
- Add proper error reporting for old TestNG. [PR#1459](https://github.com/microsoft/vscode-java-test/pull/1459), contributed by [@gayanper](https://github.com/gayanper)
- Update the reference view extension id. [#1475](https://github.com/microsoft/vscode-java-test/issues/1475)

## 0.36.0
### Added
- Add codicons for test items in Testing explorer. [PR#1408](https://github.com/microsoft/vscode-java-test/pull/1449)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.36.0)

## 0.35.2
### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.35.2)

## 0.35.1
### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.35.1)

## 0.35.0
### Added
- Support to re-run single JUnit 5 parameterized test invocation. [#1408](https://github.com/microsoft/vscode-java-test/issues/1408), contributed by [@fladdimir](https://github.com/fladdimir)

### Changed
- Simplify the stacktrace in test messages. [#1281](https://github.com/microsoft/vscode-java-test/issues/1281)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.35.0)

## 0.34.2
### Changed
- Adopt VS Code's refresh tests API. [#1348](https://github.com/microsoft/vscode-java-test/issues/1348)

### Fixed
- Extension might not be activated since 0.34.1. [#1381](https://github.com/microsoft/vscode-java-test/issues/1381)

## 0.34.1
### Changed
- Postpone the extension activation until the Java language server is ready. [PR#1369](https://github.com/microsoft/vscode-java-test/pull/1369)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.34.1)

## 0.34.0
### Added
- Support enabling tests for unmanaged folder project when there is no test framework found on the project's classpath. You can find the feature in the `Testing` explorer. [#1344](https://github.com/microsoft/vscode-java-test/issues/1344)

### Changed
- The `@Test` method will be selected by default when using `Generating Tests...` source action. [#1350](https://github.com/microsoft/vscode-java-test/issues/1350)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.34.0)

## 0.33.1
### Fixed
- Reduce the line spacing in test messages [PR#1345](https://github.com/microsoft/vscode-java-test/pull/1345)

## 0.33.0

### Added
- Add more options in the setting `java.test.config`:
  - classPaths [#1140](https://github.com/microsoft/vscode-java-test/issues/1140)
  - envFile [#1214](https://github.com/microsoft/vscode-java-test/issues/1214)
  - modulePaths [#1101](https://github.com/microsoft/vscode-java-test/issues/1101)
  - preLaunchTask [#1201](https://github.com/microsoft/vscode-java-test/issues/1201)

  More details, please see our [document](https://github.com/microsoft/vscode-java-test/wiki/Run-with-Configuration#property-details).
- Support jumping between tests and corresponding test subjects [#660](https://github.com/microsoft/vscode-java-test/issues/660)

### Changed
- Show the test messages at where they happen [#1266](https://github.com/microsoft/vscode-java-test/issues/1266)

## 0.32.0
### Changed
- Improve the experience of displaying the JUnit 4's parameterized tests [#1296](https://github.com/microsoft/vscode-java-test/issues/1296)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.32.0)

## 0.31.3
### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.31.3)

## 0.31.2
### Changed
- Changed the extension name to `Test Runner for Java`. [PR#1272](https://github.com/microsoft/vscode-java-test/pull/1272)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.31.2)

## 0.31.1
### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.31.1)

## 0.31.0
### Changed
- Adopted new [VS Code testing API](https://github.com/microsoft/vscode/issues/107467). For more details, please refer to the [README page](https://github.com/microsoft/vscode-java-test/blob/main/README.md).

## 0.30.1
### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.30.1)

## 0.30.0
### Added
- Support new Source Action: `Generate Tests...` in source files to help scaffold the tests. [#1172](https://github.com/microsoft/vscode-java-test/issues/1172)

## 0.29.0
### Added
- Support new Source Action: `Generate Tests...` in the test source files. [#1172](https://github.com/microsoft/vscode-java-test/issues/1172)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.29.0)

## 0.28.1
### Added
- Add welcome view in Test explorer when there is no folders opened. [PR#1141](https://github.com/microsoft/vscode-java-test/pull/1141)

### Changed
- Apply the new extension icon. [PR#1144](https://github.com/microsoft/vscode-java-test/pull/1144)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.28.1)

## 0.28.0
### Added
- Support running tests from the Java Project explorer for Maven and Gradle projects. [PR#1125](https://github.com/microsoft/vscode-java-test/pull/1125)

### Changed
- Improve the accessibility of the test status bar item. [#1126](https://github.com/microsoft/vscode-java-test/issues/1126)
- improve the accessibility of the test report page. [#1128](https://github.com/microsoft/vscode-java-test/issues/1128)
- Opening files from the `Test` explorer now has the same experience as the `File` explorer. [PR#1129](https://github.com/microsoft/vscode-java-test/pull/1129)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.28.0)

## 0.27.0
### Changed
- Change the scope of the setting `java.test.report.showAfterExecution` to `window`. [#1104](https://github.com/microsoft/vscode-java-test/issues/1104)
- Adopt the progress reporter API proposed in `Debugger for Java@0.30.0`. [PR#1119](https://github.com/microsoft/vscode-java-test/pull/1119)
  > To prevent the notification dialog showing up, you can set the setting `java.silentNotification` to `true`.

## 0.26.1
### Changed
- Automatically switch to `DEBUG CONSOLE` when a new test session starts. [#1106](https://github.com/microsoft/vscode-java-test/issues/1106)
- Do not show the `Test Explorer` for a non-Java workspace. [#793](https://github.com/microsoft/vscode-java-test/issues/793)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.26.1)

## 0.26.0
### Added
- Navigate from stacktrace line to proper file in test reports. [#384](https://github.com/microsoft/vscode-java-test/issues/384)

### Changed
- Only show the `Migrate Deprecated 'launch.test.json'` command when workspace has the deprecated files. [PR#1084](https://github.com/microsoft/vscode-java-test/pull/1084)
- Update the run buttons in the Test Explorer. [PR#1086](https://github.com/microsoft/vscode-java-test/pull/1086)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.26.0)

## 0.25.0
### Added
- Add new commands `java.test.editor.run` and `java.test.editor.debug` to run and debug tests in current file. [PR#1066](https://github.com/microsoft/vscode-java-test/pull/1066)

### Changed
- The field `vmargs` in `java.test.config` is deprecated, `vmArgs` is used to align with the debug launch configuration. [#852](https://github.com/microsoft/vscode-java-test/issues/852)

### Removed
- The adaptive debounce mechanism when resolving Code Lenses is removed since it is embedded in Visual Studio Code 1.50.0. [PR#1074](https://github.com/microsoft/vscode-java-test/pull/1074)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.25.0)

## 0.24.2
### Changed
- Adopt the adaptive debounce mechanism when resolving Code Lenses. [PR#1051](https://github.com/microsoft/vscode-java-test/pull/1051)
- Use ASTProvider when parse the AST nodes. [PR#1052](https://github.com/microsoft/vscode-java-test/pull/1052)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.24.2)

## 0.24.1
### Changed
- Improve the performance for resolving test Code Lenses. [#1039](https://github.com/microsoft/vscode-java-test/issues/1039)
- Adopt welcome view for Test explorer in LightWeight Mode. [PR#1046](https://github.com/microsoft/vscode-java-test/pull/1046)

## 0.24.0
### Added
- Add relaunch tests command. [#1030](https://github.com/microsoft/vscode-java-test/issues/1030)
- Add the panel icon for the test report. [#PR1032](https://github.com/microsoft/vscode-java-test/pull/1032)
- Show test report via keyboard shortcut and command palette. [#1002](https://github.com/microsoft/vscode-java-test/issues/1002)
- Adopt the new APIs for the LightWeight mode. [PR#1019](https://github.com/microsoft/vscode-java-test/pull/1019)

### Changed
- Run directly if the test is triggered from a method node in explorer. [PR#1033](https://github.com/microsoft/vscode-java-test/pull/1033)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.24.0)

## 0.23.0
### Added
- Support JUnit 5's @Testable in Code Lenses. [PR#980](https://github.com/microsoft/vscode-java-test/pull/980)

### Changed
- Resolve the Code Lenses only when the current source file is on test source paths. [PR#997](https://github.com/microsoft/vscode-java-test/pull/997)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.23.0)

## 0.22.4
### Added
- Add `sourcePaths` key in `java.test.config` to specify source paths. [#982](https://github.com/microsoft/vscode-java-test/issues/982)

## 0.22.3
### Added
- Skipped tests can be toggled out in the test report. [#754](https://github.com/microsoft/vscode-java-test/issues/754)

### Changed
- Migrate the icons in test explorer to [VS Code Icons](https://github.com/microsoft/vscode-codicons). [PR#961](https://github.com/microsoft/vscode-java-test/pull/961)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.22.3)

## 0.22.2
### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.22.2)

## 0.22.1
### Added
- Show running status in the Test Explorer during the execution. [#790](https://github.com/microsoft/vscode-java-test/issues/790)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.22.1)

## 0.22.0
### Added
- Show test status on test method nodes in Test Explorer. [#890](https://github.com/microsoft/vscode-java-test/pull/890)

### Changed
- Use Octicon to replace the Emoji for Code Lens. [#845](https://github.com/microsoft/vscode-java-test/issues/845)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.22.0)

## 0.21.0
### Added
- Support `Collapse All` button in Test Explorer. [PR#848](https://github.com/microsoft/vscode-java-test/pull/848)
- Support modular test projects. [#807](https://github.com/microsoft/vscode-java-test/issues/807)

### Removed
- The setting `java.test.forceBuildBeforeLaunchTest` is removed, please use `java.debug.settings.forceBuildBeforeLaunch` instead. [PR#850](https://github.com/microsoft/vscode-java-test/pull/850)
- The setting `java.test.saveAllBeforeLaunchTest` is removed, now the unsaved files will always be saved before launching the tests.[PR#861](https://github.com/microsoft/vscode-java-test/pull/861)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.21.0)

## 0.20.0 
### Added
- Add `java.test.saveAllBeforeLaunchTest` setting to specify whether to automatically save the files before launching the tests. [#468](https://github.com/microsoft/vscode-java-test/issues/468)
- Add `java.test.forceBuildBeforeLaunchTest` setting to specify whether to automatically build the workspace before launching the tests. [#781](https://github.com/microsoft/vscode-java-test/issues/781)

### Changed
- The runner for JUnit 4 is changed to Eclipse JUnit 4 Runner. [PR#795](https://github.com/microsoft/vscode-java-test/pull/795)
- The title of the Test Explorer is changed to `Java`. [PR#796](https://github.com/microsoft/vscode-java-test/pull/796)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.20.0)

## 0.19.0 - 2019-08-12
### Added
- Support JUnit 5 meta-annotations. [#737](https://github.com/microsoft/vscode-java-test/issues/737)
- Support JUnit 5 `@TestTemplate`. [PR#763](https://github.com/microsoft/vscode-java-test/pull/763)

### Changed
- Add `redhat.java` into the extension dependency list. [PR#760](https://github.com/microsoft/vscode-java-test/pull/760)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.19.0)

## 0.18.2 - 2019-07-23
### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.18.2)

## 0.18.1 - 2019-06-28
### Added
- Support customizing the visibility of `Run Test` and `Debug Test` CodeLens through setting: `java.test.editor.enableShortcuts`. [#374](https://github.com/microsoft/vscode-java-test/issues/374)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+milestone%3A0.18.1+is%3Aclosed+label%3Abug)

## 0.18.0 - 2019-06-11
### Added
- Support automatically show the test report after execution. [#673](https://github.com/microsoft/vscode-java-test/issues/673)
- Support JUnit 5 `@Nested` annotation. [#685](https://github.com/microsoft/vscode-java-test/issues/685)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+label%3Abug+milestone%3A0.18.0+is%3Aclosed)

## 0.17.0 - 2019-05-22
### Added
- Support Junit 5 TestFactory annotation. [#644](https://github.com/microsoft/vscode-java-test/issues/644)

### Changed
- Automatically add "--enable-preview" to vmargs when necessary. [#669](https://github.com/microsoft/vscode-java-test/issues/669)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.17.0)

## 0.16.0 - 2019-04-10

### Added
- Add a new command `Java: Migrate Deprecated 'launch.test.json'` to help migrate the `launch.test.json` files. [PR#664](https://github.com/Microsoft/vscode-java-test/pull/664)

### Removed
- Stop supporting `launch.test.json`. [#650](https://github.com/Microsoft/vscode-java-test/issues/650)

### Fixed
- Encoding issue for the Test Runner. [PR#662](https://github.com/Microsoft/vscode-java-test/pull/662)
- Can resolve the classpath of the invisible project. [#348](https://github.com/Microsoft/vscode-java-test/issues/348)

## 0.15.1 - 2019-03-19

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-java-test/issues?q=is%3Aissue+milestone%3A0.15.1+is%3Aclosed+label%3Abug)

## 0.15.0 - 2019-03-11

### Added
- Support JUnit 4 `@RunWith` annotation. [#272](https://github.com/Microsoft/vscode-java-test/issues/272)
- Support JUnit 4 `@Theory` annotation. [#628](https://github.com/Microsoft/vscode-java-test/issues/628)
- Support JUnit 5 `@RepeatedTest` annotation. [#594](https://github.com/Microsoft/vscode-java-test/issues/594)

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-java-test/issues?q=is%3Aissue+is%3Aclosed+milestone%3A0.15.0+label%3Abug)

## 0.14.1 - 2019-02-19

### Added
- Support ${workspaceFolder} in 'vmargs', 'args' and the value of each entry in 'env' in the test configurations. [#602](https://github.com/Microsoft/vscode-java-test/issues/602)

### Fixed
- SecurityException when running JUnit 5 tests. [#477](https://github.com/Microsoft/vscode-java-test/issues/477)
- Wrong order of arguments passing to Test Runner. [#592](https://github.com/Microsoft/vscode-java-test/issues/592)
- Fail to resolve configurations which contain ${workspaceFolder}. [#599](https://github.com/Microsoft/vscode-java-test/issues/599)
- Report page always goes back to the top after the navigation button is clicked. [#606](https://github.com/Microsoft/vscode-java-test/issues/606)

## 0.14.0 - 2019-01-21

### Added
- Add the log level setting. [#555](https://github.com/Microsoft/vscode-java-test/issues/555)
- Navigate to the source code from the test explorer. [#558](https://github.com/Microsoft/vscode-java-test/issues/558)

### Changed
- Redesign the user experience of running tests with configurations. [More details](https://aka.ms/java-test-config) [#524](https://github.com/Microsoft/vscode-java-test/issues/524)

### Fixed
- Fix the bug that test scope is wrong when triggering tests from inner class level. [#411](https://github.com/Microsoft/vscode-java-test/issues/411)
- Fix the bug that tests which contain inner class will be skipped if triggered from the test explorer. [#460](https://github.com/Microsoft/vscode-java-test/issues/460)
- Improve the test output format. [#505](https://github.com/Microsoft/vscode-java-test/issues/505)
- Pack the test report resources into the extension vsix. [550](https://github.com/Microsoft/vscode-java-test/issues/550)

## 0.13.0 - 2018-12-27

### Added
- Add Chinese language support. [#437](https://github.com/Microsoft/vscode-java-test/issues/437)

### Changed
- Use webpack to improve the extension startup time. [#495](https://github.com/Microsoft/vscode-java-test/issues/495)
- Change the activation events of the extension. [#516](https://github.com/Microsoft/vscode-java-test/issues/516)
- Change the style of the test report. [#517](https://github.com/Microsoft/vscode-java-test/issues/517)

### Fixed
- Fix the bug that test explorer will keep refreshing when opening a large project. [#461](https://github.com/Microsoft/vscode-java-test/issues/461)
- Fix several bugs that cause the extension fails to run test cases. ([#134](https://github.com/Microsoft/vscode-java-test/issues/134), [#488](https://github.com/Microsoft/vscode-java-test/issues/488), [#504](https://github.com/Microsoft/vscode-java-test/issues/504), [#515](https://github.com/Microsoft/vscode-java-test/issues/515))

## 0.12.0 - 2018-12-10

### Added
- Add a way to persist test logs into log files. [#452](https://github.com/Microsoft/vscode-java-test/issues/452)
- Add @DisplayName support in the test report for JUnit 5. [#446](https://github.com/Microsoft/vscode-java-test/issues/446)
- Add @ParameterizedTest support for JUnit 5. [#107](https://github.com/Microsoft/vscode-java-test/issues/107)

### Changed
- Improve the test report page. ([#397](https://github.com/Microsoft/vscode-java-test/issues/397), [#486](https://github.com/Microsoft/vscode-java-test/issues/486), [#489](https://github.com/Microsoft/vscode-java-test/issues/489))
- Change the foreground color of the status bar items. [#467](https://github.com/Microsoft/vscode-java-test/issues/467)

### Fixed
- Fix the bug that test runners will run forever. [#482](https://github.com/Microsoft/vscode-java-test/issues/482)

## 0.11.1 - 2018-11-26

### Added
- Add JUnit 5's @DisplayName support in test explorer. (Thanks for [@BaerMitUmlaut](https://github.com/BaerMitUmlaut))

### Fixed
- "Cannot read property 'indexOf' of undefined" bug when running JUnit 5 tests. [#455](https://github.com/Microsoft/vscode-java-test/issues/455)
- Will run all tests in class if triggering test from method level in test explorer. [#441](https://github.com/Microsoft/vscode-java-test/issues/441)
- Cannot run tests when the project is a multi-module Maven project. [#443](https://github.com/Microsoft/vscode-java-test/issues/443)

## 0.11.0 - 2018-11-09

### Added
- Add TestNG support.

### Changed
- Test explorer change to lazy-load mechanism.
- Always resolve the classpath before running test jobs - no need to trigger `Refresh Classpath` anymore.

## 0.10.0 - 2018-10-10

### Changed
- Sort packages alphabetically in Test Explorer. [#310](https://github.com/Microsoft/vscode-java-test/issues/310)
- Get JAVA_HOME location through calling the API exposed by the Java Language Server. [#319](https://github.com/Microsoft/vscode-java-test/issues/319)

### Fixed
- Fix a bug that code lenses are not in the correct place. [#36](https://github.com/Microsoft/vscode-java-test/issues/36)

## 0.9.0 - 2018-09-20

### Changed
- Test explorer will always show in the Activity Bar after the extension is activated. [#271](https://github.com/Microsoft/vscode-java-test/issues/271)

### Fixed
- Fix a bug that Test Runner for Java will interfere with Java language server. [#260](https://github.com/Microsoft/vscode-java-test/issues/260)
- Fix 'command not found error' when triggering commands. [#289](https://github.com/Microsoft/vscode-java-test/issues/289)

## 0.8.0 - 2018-08-08

### Changed
- Refine the logic to consume test output for JUnit test runner.

### Fixed
- Add project info into `TestSuite`, and run the tests per project to avoid the conflict of classpaths between projects.
- Fix the issue that test output would be truncated when it exceeds buffer size.

## 0.7.1 - 2018-07-11

### Fixed
- Fix the issue that the test runner hangs for some tests.
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
