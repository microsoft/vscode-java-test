# Contributing to Java Test Runner

Thank you for your interest in contributing to Java Test Runner!

There are many ways in which you can contribute, beyond writing code. Please read the following document to check how you can get involved.

## Questions and Feedback
Have questions or feedback? Feel free to let us know! You can share your thoughts in our Gitter channel: [![Gitter](https://badges.gitter.im/Microsoft/vscode-java-test.svg)](https://gitter.im/Microsoft/vscode-java-test)

## Reporting Issues
You can report issues whenever:
- Identify a reproducible problem within the extension
- Have a feature request

### Looking for an Existing Issue
Before creating a new issue, please do a search to see if the issue or feature request has already been filed.

If you find your issue already exists, make relevant comments and add your reaction:
- 👍 - upvote
- 👎 - downvote
 
### Writing Good Bug Reports and Feature Requests
In order to let us know better about the issue, please make sure the following items are included with each issue:
- The version of VS Code
- Your operating system
- Reproducible steps
- What you expected to see, versus what you actually saw
- Images, animations, or a link to a video showing the issue occurring
- A code snippet that demonstrates the issue or a link to a code repository the developers can easily pull down to recreate the issue locally
- Errors from the Dev Tools Console (open from the menu: Help > Toggle Developer Tools)
 
## Contributing Fixes
If you are interested in writing code to fix issues, please check the following content to see how to set up the developing environment.

### Overview
The extension has three major modules, which are listed as follow:
- The extension client written in TypeScript - UI logic mostly
- [The Java Test Plugin](https://github.com/Microsoft/vscode-java-test/tree/master/java-extension/com.microsoft.java.test.plugin) written in Java - Inspect the Java project 
- [The Java Test Runner](https://github.com/Microsoft/vscode-java-test/tree/master/java-extension/com.microsoft.java.test.runner) written in Java - An executable jar to running the test cases

### Setup
1. Fork and clone the repository: `git clone git@github.com:Microsoft/vscode-java-test.git`
2. `cd vscode-java-test`
3. Install the node dependencies: `npm install`
4. Build the Java modules: `npm run build-plugin`
5. Build the test report resources: `npm run build-resources`
6. Open the directory `vscode-java-test` in VS Code
7. Install the [Eclipse PDE Support extension](https://marketplace.visualstudio.com/items?itemName=yaozheng.vscode-pde) in your VS Code
8. Open a Java file and wait until 👍 shows in the right-bottom of the status bar
    > Note: Sometimes, if you find the code navigation is not working in the Java code, please reload your VS Code.

### Debugging
1. Hit `F5` (or run Launch Extension in the debug viewlet) to launch the extension in debug mode
    > This will open a new VS Code window as a debug session. Open a Java project folder and let the extension be activated, then you can debug it.
2. If you want to debug the Java Test Plugin, run [Debug Test Runner Java Plugin (Attach)](https://github.com/microsoft/vscode-java-test/blob/master/.vscode/launch.json) in the debug viewlet.

> Note: If the Java code is changed by you, please run `npm run build-plugin` before you start debugging.

### Debugging the Java Test Runner
- The Java Test Runner is a normal Maven project, you can open it with whatever the development tools you prefer, for example, VS Code
- The Java Test Runner is an executable jar, the main class is `com.microsoft.java.test.runner.Launcher`