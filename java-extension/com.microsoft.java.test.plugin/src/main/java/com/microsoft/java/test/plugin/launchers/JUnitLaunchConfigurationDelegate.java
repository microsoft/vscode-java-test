/*******************************************************************************
 * Copyright (c) 2019 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.launchers;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.Launch;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.launching.VMRunnerConfiguration;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

public class JUnitLaunchConfigurationDelegate extends org.eclipse.jdt.junit.launcher.JUnitLaunchConfigurationDelegate {
    public JUnitLaunchArguments getJUnitLaunchArguments(ILaunchConfiguration configuration, String mode,
            IProgressMonitor monitor) throws CoreException {
        final ILaunch launch = new Launch(configuration, mode, null);

        // TODO: Make the getVMRunnerConfiguration() in super class protected.
        try {
            final Method getVMRunnerConfiguration = getClass().getSuperclass().getDeclaredMethod(
                    "getVMRunnerConfiguration", ILaunchConfiguration.class, ILaunch.class, String.class,
                    IProgressMonitor.class);
            getVMRunnerConfiguration.setAccessible(true);
            final VMRunnerConfiguration config = (VMRunnerConfiguration) getVMRunnerConfiguration.invoke(this,
                    configuration, launch, mode, new NullProgressMonitor());
            final IJavaProject javaProject = getJavaProject(configuration);
            final JUnitLaunchArguments launchArguments = new JUnitLaunchArguments();
            launchArguments.mainClass = config.getClassToLaunch();
            launchArguments.projectName = javaProject.getProject().getName();
            launchArguments.classpath = config.getClassPath();
            launchArguments.modulepath = config.getModulepath();
            launchArguments.vmArguments = config.getVMArguments();
            launchArguments.programArguments = config.getProgramArguments();

            return launchArguments;
        } catch (NoSuchMethodException | SecurityException | IllegalAccessException | IllegalArgumentException |
                InvocationTargetException e) {
            return null;
        }
    }

    public static class JUnitLaunchArguments {
        String mainClass;
        String projectName;
        String[] classpath;
        String[] modulepath;
        String[] vmArguments;
        String[] programArguments;
    }
}
