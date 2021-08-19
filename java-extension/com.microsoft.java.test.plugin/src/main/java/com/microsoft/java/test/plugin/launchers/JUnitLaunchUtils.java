/*******************************************************************************
 * Copyright (c) 2019-2021 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.launchers;

import com.google.gson.Gson;
import com.microsoft.java.test.plugin.launchers.JUnitLaunchConfigurationDelegate.JUnitLaunchArguments;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.util.JUnitPlugin;

import org.apache.commons.lang3.ArrayUtils;
import org.eclipse.core.resources.IFolder;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.IPackageFragmentRoot;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.launching.IRuntimeClasspathEntry;
import org.eclipse.jdt.launching.JavaRuntime;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public class JUnitLaunchUtils {

    private static final String TESTNG_LOADER = "com.microsoft.java.test.loader.testng";
    private static final String JUNIT5_LOADER = "org.eclipse.jdt.junit.loader.junit5";
    private static final String JUNIT4_LOADER = "org.eclipse.jdt.junit.loader.junit4";

    private JUnitLaunchUtils() {}

    /**
     * Resolve the arguments to launch the Eclipse test runner
     * @param arguments
     * @param monitor
     * @return
     * @throws URISyntaxException
     * @throws CoreException
     */
    public static JUnitLaunchArguments resolveLaunchArgument(List<Object> arguments, IProgressMonitor monitor)
            throws URISyntaxException, CoreException {
        final Gson gson = new Gson();
        final Argument args = gson.fromJson((String) arguments.get(0), Argument.class);

        final TestInfo info = new TestInfo();

        info.testKind = getEclipseTestKind(args.testKind);

        final IJavaProject javaProject = ProjectUtils.getJavaProject(args.projectName);
        if (javaProject == null || !javaProject.exists()) {
            JUnitPlugin.logError("Failed to get the project: " + args.projectName);
            throw new RuntimeException("Failed to get the project: " + args.projectName);
        }
        info.project = javaProject.getProject();
        // TestNG's argument will be resolved at client side
        if (!Objects.equals(info.testKind, TESTNG_LOADER)) {
            if (ArrayUtils.isNotEmpty(args.testNames)) {
                if (args.testLevel == TestLevel.CLASS) {
                    info.mainType = args.testNames[0].substring(args.testNames[0].indexOf("@") + 1);
                } else if (args.testLevel == TestLevel.METHOD) {
                    final IMethod method = (IMethod) JavaCore.create(args.testNames[0]);
                    info.mainType = method.getDeclaringType().getFullyQualifiedName();
                }
            }
        }

        final ILaunchConfiguration configuration = new JUnitLaunchConfiguration("JUnit Launch Configuration", info);
        final JUnitLaunchConfigurationDelegate delegate = new JUnitLaunchConfigurationDelegate(args);

        if (monitor.isCanceled()) {
            return null;
        }

        if (TESTNG_LOADER.equals(info.testKind)) {
            // TestNG is not suported yet, we only use the junit launch configuration to resolve the classpath
            return resolveTestNGLaunchArguments(configuration, javaProject, delegate);
        }

        return delegate.getJUnitLaunchArguments(configuration, "run", monitor);
    }

    public static void addOverrideDependencies(List<String> vmArgs, String dependencies) {
        if (dependencies != null && dependencies.length() > 0) {
            final String[] parseArguments = DebugPlugin.parseArguments(dependencies);
            vmArgs.addAll(Arrays.asList(parseArguments));
        }
    }

    private static JUnitLaunchArguments resolveTestNGLaunchArguments(ILaunchConfiguration configuration,
            IJavaProject javaProject, JUnitLaunchConfigurationDelegate delegate) throws CoreException {
        final IRuntimeClasspathEntry[] unresolved = JavaRuntime.computeUnresolvedRuntimeClasspath(configuration);
        final IRuntimeClasspathEntry[] resolved = JavaRuntime.resolveRuntimeClasspath(unresolved, configuration);
        final Set<String> classpaths = new LinkedHashSet<>();
        final Set<String> modulepaths = new LinkedHashSet<>();
        for (final IRuntimeClasspathEntry entry : resolved) {
            final String location = entry.getLocation();
            if (location != null) {
                if (entry.getClasspathProperty() == IRuntimeClasspathEntry.USER_CLASSES ||
                        entry.getClasspathProperty() == IRuntimeClasspathEntry.CLASS_PATH) {
                    classpaths.add(location);
                } else if (entry.getClasspathProperty() == IRuntimeClasspathEntry.MODULE_PATH) {
                    modulepaths.add(location);
                }
            }
        }
        final JUnitLaunchArguments launchArguments = new JUnitLaunchArguments();

        launchArguments.projectName = javaProject.getProject().getName();
        launchArguments.classpath = classpaths.toArray(new String[classpaths.size()]);
        launchArguments.modulepath = modulepaths.toArray(new String[modulepaths.size()]);

        final IPath projectLocation = javaProject.getProject().getLocation();
        if (projectLocation != null) {
            launchArguments.workingDirectory = projectLocation.toFile().getAbsolutePath();
        }

        final List<String> vmArgs = new ArrayList<>();
        vmArgs.add("-ea");

        if (JavaRuntime.isModularProject(javaProject)) {
            for (final String pkg : getSourcePackages(javaProject)) {
                collectAddOpensVmArgs(vmArgs, pkg, javaProject);
            }
            vmArgs.add("--add-modules=ALL-MODULE-PATH");
        }

        final String id = javaProject.getOption(JavaCore.COMPILER_PB_ENABLE_PREVIEW_FEATURES, true);
        if (JavaCore.ENABLED.equals(id)) {
            vmArgs.add("--enable-preview");
        }
        addOverrideDependencies(vmArgs, delegate.getModuleCLIOptions(configuration));
        launchArguments.vmArguments = vmArgs.toArray(new String[vmArgs.size()]);

        return launchArguments;
    }

    /**
     * copied from org.eclipse.jdt.junit.launcher.JUnitLaunchConfigurationDelegate.collectAddOpensVmArgs()
     */
    private static void collectAddOpensVmArgs(List<String> addOpensVmArgs, String pkgName, IJavaProject javaProject)
            throws CoreException {
        final String sourceModuleName = javaProject.getModuleDescription().getElementName();
        addOpensVmArgs.add("--add-opens"); //$NON-NLS-1$
        addOpensVmArgs.add(sourceModuleName + "/" + pkgName + "=ALL-UNNAMED");
    }

    /**
     * copied from org.testng.eclipse.ui.util.ConfigurationHelper.getSourcePackages()
     */
    private static Set<String> getSourcePackages(IJavaProject javaProject) throws JavaModelException {
        final Set<String> pkgs = new HashSet<>();
        for (final IPackageFragmentRoot pkgFragmentRoot : javaProject.getPackageFragmentRoots()) {
            if (!pkgFragmentRoot.isArchive()) {
                for (final IJavaElement pkg : pkgFragmentRoot.getChildren()) {
                    if (!pkg.getElementName().isEmpty() && !(pkg instanceof IFolder)) {
                        if (((IPackageFragment) pkg).containsJavaResources()) {
                            pkgs.add(((IPackageFragment) pkg).getElementName());
                        }
                    }
                }
            }
        }
        return pkgs;
    }

    private static String getEclipseTestKind(TestKind testKind) {
        switch (testKind) {
            case JUnit:
                return JUNIT4_LOADER;
            case JUnit5:
                return JUNIT5_LOADER;
            case TestNG:
                return TESTNG_LOADER;
            default:
                throw new IllegalArgumentException("The test kind: " + testKind.name() + " is not supported yet.");
        }
    }

    class Argument {
        public String projectName;
        public TestLevel testLevel;
        public TestKind testKind;
        public String[] testNames;
    }
}
