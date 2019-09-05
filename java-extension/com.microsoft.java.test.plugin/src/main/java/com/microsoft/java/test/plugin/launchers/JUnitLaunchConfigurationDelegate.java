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
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.Launch;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.launching.JavaRuntime;

import java.util.ArrayList;
import java.util.Arrays;

public class JUnitLaunchConfigurationDelegate extends org.eclipse.jdt.junit.launcher.JUnitLaunchConfigurationDelegate {
    public JUnitLaunchArguments getJUnitLaunchArguments(ILaunchConfiguration configuration, String mode,
            IProgressMonitor monitor) throws CoreException {
        final ILaunch launch = new Launch(configuration, mode, null);
        showCommandLine(configuration, mode, launch, monitor);
        final String mainTypeName = verifyMainTypeName(configuration);

        final ArrayList<String> vmArguments = new ArrayList<>();
        final ArrayList<String> programArguments = new ArrayList<>();
        collectExecutionArguments(configuration, vmArguments, programArguments);
        vmArguments.addAll(Arrays.asList(DebugPlugin.parseArguments(getVMArguments(configuration, mode))));
        final IJavaProject javaProject = getJavaProject(configuration);
        if (JavaRuntime.isModularProject(javaProject)) {
            vmArguments.add("--add-modules=ALL-MODULE-PATH"); //$NON-NLS-1$
        }

        final String[][] classpathAndModulepath = getClasspathAndModulepath(configuration);
        final String[] classpath = classpathAndModulepath[0];
        final String[] modulepath = classpathAndModulepath[1];
        
        final JUnitLaunchArguments launchArguments = new JUnitLaunchArguments();
        launchArguments.mainClass = mainTypeName;
        launchArguments.projectName = javaProject.getProject().getName();
        launchArguments.classpath = classpath;
        launchArguments.modulepath = modulepath;
        launchArguments.vmArguments = vmArguments.toArray(new String[vmArguments.size()]);
        launchArguments.programArguments = programArguments.toArray(new String[programArguments.size()]);

        return launchArguments;
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
