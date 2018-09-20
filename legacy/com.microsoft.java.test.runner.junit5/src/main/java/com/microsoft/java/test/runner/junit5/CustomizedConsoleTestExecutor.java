/*
 * Copyright 2015-2018 the original author or authors.
 *
 * All rights reserved. This program and the accompanying materials are
 * made available under the terms of the Eclipse Public License v2.0 which
 * accompanies this distribution and is available at
 *
 * http://www.eclipse.org/legal/epl-v20.html
 */
package com.microsoft.java.test.runner.junit5;

import java.io.PrintWriter;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import org.junit.platform.commons.JUnitException;
import org.junit.platform.commons.util.ClassLoaderUtils;
import org.junit.platform.console.options.CommandLineOptions;
import org.junit.platform.launcher.Launcher;
import org.junit.platform.launcher.LauncherDiscoveryRequest;
import org.junit.platform.launcher.core.LauncherFactory;

public class CustomizedConsoleTestExecutor {

    private final CommandLineOptions options;
    private final Launcher launcher;

    public CustomizedConsoleTestExecutor(CommandLineOptions options) {
        this.options = options;
        this.launcher = LauncherFactory.create();
    }
    
    public int execute(PrintWriter out) throws Exception {
        return new CustomContextClassLoaderExecutor(createCustomClassLoader()).invoke(() -> executeTests(out));
    }

    private int executeTests(PrintWriter out) {
        registerListeners(out);
        LauncherDiscoveryRequest discoveryRequest = new DiscoveryRequestCreator().toDiscoveryRequest(options);
        launcher.execute(discoveryRequest);
        return 0;
    }
    
    private void registerListeners(PrintWriter out) {
        TestResultListener listener = new TestResultListener(out);
        launcher.registerTestExecutionListeners(listener);
    }

    private Optional<ClassLoader> createCustomClassLoader() {
        List<Path> additionalClasspathEntries = options.getAdditionalClasspathEntries();
        if (!additionalClasspathEntries.isEmpty()) {
            URL[] urls = additionalClasspathEntries.stream().map(this::toURL).toArray(URL[]::new);
            ClassLoader parentClassLoader = ClassLoaderUtils.getDefaultClassLoader();
            ClassLoader customClassLoader = URLClassLoader.newInstance(urls, parentClassLoader);
            return Optional.of(customClassLoader);
        }
        return Optional.empty();
    }
    
    private URL toURL(Path path) {
        try {
            return path.toUri().toURL();
        }
        catch (Exception ex) {
            throw new JUnitException("Invalid classpath entry: " + path, ex);
        }
    }
}
