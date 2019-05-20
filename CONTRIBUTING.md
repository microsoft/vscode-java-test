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
- [The Java Language Server plugin](https://github.com/Microsoft/vscode-java-test/tree/master/java-extension/com.microsoft.java.test.plugin) written in Java - Inspect the Java project 
- [The Java Test Runner](https://github.com/Microsoft/vscode-java-test/tree/master/java-extension/com.microsoft.java.test.runner) written in Java - An executable jar to running the test cases

### Setup
1. Fork and clone the repository: `git clone git@github.com:Microsoft/vscode-java-test.git`
2. `cd vscode-java-test`
3. Install the node dependencies: `npm install`
4. Build the Java modules: `npm run build-plugin`
5. Build the test report resources: `npm run build-resources`
> Note: The below steps are only required if you want to debug the Java Language Server plugin
5. Import `java-extension/com.microsoft.java.test.plugin` in Eclipse
6. Click `Window` > `Preferences` > `Plug-in Development` > `Target Platform`
7. In the `Target definitions` panel, select `JDTLS.EXT - /com.microsoft.java.test.plugin/target.target`
8. Click `Apply and Close`

### Debugging the Extension Client
1. Open the base directory of Java Test Runner in VS Code
2. Hit `F5` to launch the extension in debug mode
 
### Debugging the Java Language Server plugin
1. In Eclipse, create a new `Debug Configurations`, select the type as `Remote Java Application`
2. In the `Connect` panel, find the `Port` setting in `Connection Properties` and set it to `1044`
3. In the `Source` panel, click `Add` > `Java Project`, select `com.microsoft.java.test.plugin` and click `OK`
4. Click `Apply` to save the configurations
5. Click `Debug` to start the debug session

### Debugging the Java Test Runner
- The Java Test Runner is a normal Maven project, you can open it with whatever the development tools you prefer, for example, VS Code
- The Java Test Runner is an executable jar, the main class is `com.microsoft.java.test.runner.Launcher`