You can run tests with custom configuration. The configuration can be specified in `settings.json` using the key `java.test.config`.

> It's recommended to save the test configuration as workspace settings. To open workspace settings, run command `Preference: Open Workspace Settings`. And click on the icon `{}` on the top right to show the source code of your settings.

## TL;DR
Here is an example of the configuration schema:
```js
"java.test.config": [
    {
        "name": "myConfiguration"
        "workingDirectory": "${workspaceFolder}"
        "args": [ "-c", "com.test" ],
        "vmargs": [ "-Xmx512M" ],
        "env": { "key": "value" },
    },
    {
        // Another configuration item...
    },
  ...
]
```

> Note: The commands `Run With Configuration` and `Debug With Configuration` are **removed** from version `0.14.0`. The extension will let you select the configuration if it detects there are customized configuration available.

## Property Details

The value of `java.test.config` is an **object** or an **object array**, each object is a configuration item, which may have following properties:

| Property Name | Description | Default Value |
|---|---|---|
| `name` | Specify the name of the configuration item | "" |
| `workingDirectory` | Specify the working directory when running the tests | "${workspaceFolder}" |
| `vmargs` | Specify the extra options and system properties for the JVM | [] |
| `args` | Specify the command line arguments which will be passed to the test runner | [] |
| `env` | Specify the extra environment variables when running the tests | {} |

## Set the default configuration

Each time when you run the test cases, the extension will ask you to select a configuration if it detects there are customized configuration available. If you do not want to pick the configuration each time. There are two ways to achieve this:

### Set the default configuration by yourself
you can set the setting: `java.test.defaultConfig` to the name of the configuration. For example, if your configuration is the same as the [above schema](#TL;DR) shows, simply set `java.test.defaultConfig` to `myConfiguration`.

### Let the extension to set the default configuration
Each time you select one configuration, the extension will ask you whether to set the selected configuration as default. Simply click `Yes` will let the extension to set the default configuration for you.

## Q & A
**Q: How can I migrate to the new `java.test.config` setting?**

A: You can create your own customized configuration and test it according to the above document. If everything is fine, then the `launch.test.json` can be removed.

**Q: Can I keep using the original `launch.test.json` to run with customized configuration?**

A: For now, yes. But it's highly recommended that you work with the new schema. `launch.test.json` is deprecated and will be completely removed in the future.

**Q: What will happen if I both have `java.test.config` setting and `launch.test.json` in my workspace?**

A: `java.test.config` wins.