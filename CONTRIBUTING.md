## First Time Setup
1. Fork and clone the repository: `git clone git@github.com:Microsoft/vscode-java-test.git`
2. `cd vscode-java-test/extension`
3. Install the dependencies: `npm install`
4. Build the Java Language Server plugin for VS Code Java Test Runner: `gulp build_server`
5. Open the folder in VS Code
> Note: The below steps are only required if you want to debug the Java codes of the extension, if you are only interested in the TypeScript part, you are done now
6. Download the [newest bits of the Java Language Server](http://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz)
7. Decompress the downloaded bits, you will get a folder named `jdt-language-server-latest`
8. Copy the folder `jdt-language-server-latest` into the project base path
9. Import project in Eclipse
    - In Eclipse, Select `File` > `Open Projects from File System...`
    - In the popup window, click `Directory...` and choose the base path of the project
    - Click `Finish`
10. Set the target platform in Eclipse
    - In Eclipse, Click `Window` > `Plug-in Development` > `Target Platform`, select the `Running Platform` and click `Edit`
    - In the `Locations` panel, click `Add...`, choose `Directory` and click `Next >`
    - Select the folder `jdt-language-server-latest` we just copied before, click `Finish` to close the popup windows
    - Click `Apply and Close`

## Debug the TypeScript codes
Simply hit `F5` will launch the extension in debug mode

## Debug the Java codes
1. In Eclipse, create a new `Debug Configurations`, select the type as `Remote Java Application`
2. In the `Connect` panel, find the `Port` setting in `Connection Properties` and set it to `1044`
3. In the `Source` panel, click `Add` > `Java Project`, select all the projects listed and click `OK`
3. Click `Apply` to save the configurations
4. Click `Debug` to start the debug session