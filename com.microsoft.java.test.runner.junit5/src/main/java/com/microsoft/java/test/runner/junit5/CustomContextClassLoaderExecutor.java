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

import java.util.Optional;
import java.util.concurrent.Callable;

public class CustomContextClassLoaderExecutor {
    private final Optional<ClassLoader> customClassLoader;

    CustomContextClassLoaderExecutor(Optional<ClassLoader> customClassLoader) {
        this.customClassLoader = customClassLoader;
    }

    <T> T invoke(Callable<T> callable) throws Exception {
        if (customClassLoader.isPresent()) {
            // Only get/set context class loader when necessary to prevent problems with
            // security managers
            return replaceThreadContextClassLoaderAndInvoke(customClassLoader.get(), callable);
        }
        return callable.call();
    }

    private <T> T replaceThreadContextClassLoaderAndInvoke(ClassLoader customClassLoader, Callable<T> callable)
            throws Exception {
        final ClassLoader originalClassLoader = Thread.currentThread().getContextClassLoader();
        try {
            Thread.currentThread().setContextClassLoader(customClassLoader);
            return callable.call();
        } finally {
            Thread.currentThread().setContextClassLoader(originalClassLoader);
        }
    }
}
