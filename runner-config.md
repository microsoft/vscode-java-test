To run the tests with a customized configuration, you can add a new setting with key named: `java.test.config`.

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

## Property Details

The value of `java.test.config.json` is an object array, each object is a configuration item, which may have following properties:
| Property Name | Description | Default Value |
|---|---|---|
| `name` | Specify the name of the configuration item | "" |
| `workingDirectory` | Specify the working directory when running the tests | "${workspaceFolder}" |
| `vmargs` | Specify the extra options and system properties for the JVM | [] |
| `args` | Specify the command line arguments which will be passed to the test runner | [] |
| `env` | Specify the extra environment variables when running the tests | {} |

## Q & A
**Q: How can I migrate to the new `java.test.config` setting?**
A: You can create your own customized configuration according to the above document. Then remove or rename the `launch.test.json` in your workspace.

**Q: Can I keep using the original `launch.test.json` to run with customized configuration?**
A: For now, yes. But the `launch.test.json` is deprecated and we will stop honor `launch.test.json` in the near future.

**Q: What will happen if I both have `java.test.config` setting and `launch.test.json` in my workspace?**
A: The extension will only take the configurations from `java.test.config` setting if it exists.