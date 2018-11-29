/*******************************************************************************
* Copyright (c) 2018 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.runner.junit5;

import org.junit.platform.commons.JUnitException;
import org.junit.platform.commons.util.ClassLoaderUtils;
import org.junit.platform.console.options.CommandLineOptions;
import org.junit.platform.launcher.Launcher;
import org.junit.platform.launcher.LauncherDiscoveryRequest;
import org.junit.platform.launcher.core.LauncherFactory;

import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

public class CustomizedConsoleTestExecutor {

    private final CommandLineOptions options;
    private final Launcher launcher;

    public CustomizedConsoleTestExecutor(CommandLineOptions options) {
        this.options = options;
        this.launcher = LauncherFactory.create();
    }

    public int executeTests() throws Exception {
        return new CustomContextClassLoaderExecutor(createCustomClassLoader()).invoke(() -> {
            final TestResultListener listener = new TestResultListener();
            launcher.registerTestExecutionListeners(listener);
            final LauncherDiscoveryRequest discoveryRequest = new DiscoveryRequestCreator().toDiscoveryRequest(options);
            launcher.execute(discoveryRequest);
            return 0;
        });

    }

    private Optional<ClassLoader> createCustomClassLoader() {
        final List<Path> additionalClasspathEntries = options.getAdditionalClasspathEntries();
        if (!additionalClasspathEntries.isEmpty()) {
            final URL[] urls = additionalClasspathEntries.stream().map(this::toURL).toArray(URL[]::new);
            final ClassLoader parentClassLoader = ClassLoaderUtils.getDefaultClassLoader();
            final ClassLoader customClassLoader = URLClassLoader.newInstance(urls, parentClassLoader);
            return Optional.of(customClassLoader);
        }
        return Optional.empty();
    }

    private URL toURL(Path path) {
        try {
            return path.toUri().toURL();
        } catch (final Exception ex) {
            throw new JUnitException("Invalid classpath entry: " + path, ex);
        }
    }
}
