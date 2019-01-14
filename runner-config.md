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

The value of `java.test.config` is an **object** or an **object array**, each object is a configuration item, which may have the following properties:

| Property Name | Description | Default Value |
|---|---|---|
| `name` | Specify the name of the configuration item | "" |
| `workingDirectory` | Specify the working directory when running the tests | "${workspaceFolder}" |
| `vmargs` | Specify the extra options and system properties for the JVM | [] |
| `args` | Specify the command line arguments which will be passed to the test runner | [] |
| `env` | Specify the extra environment variables when running the tests | {} |

## Custom Configurations

When you have custom configurations, you'll be asked to pick one everytime when running/debugging your test cases. To avoid that, you can use `java.test.defaultConfig` and set its value to the name of a configuration.

If you want to bypass any existing configurations, you can use the built-in configuration named "default" which has the following definition:
```json
{
    "name": "default",
    "workingDirectory": "$(workspaceFolder)"
}
```

## Q & A
**Q: How can I migrate to the new `java.test.config` setting?**

A: You can create your own customized configuration and test it according to the above document. If everything is fine, then the `launch.test.json` can be removed.

**Q: Can I keep using the original `launch.test.json` to run with customized configuration?**

A: For now, yes. But it's highly recommended that you work with the new schema. `launch.test.json` is deprecated and will be completely removed in the future.

**Q: What will happen if I both have `java.test.config` setting and `launch.test.json` in my workspace?**

A: `java.test.config` wins.