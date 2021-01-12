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

import com.microsoft.java.test.plugin.util.TestSearchUtils;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.Launch;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMember;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.internal.junit.JUnitMessages;
import org.eclipse.jdt.internal.junit.Messages;
import org.eclipse.jdt.internal.junit.launcher.ITestKind;
import org.eclipse.jdt.internal.junit.launcher.JUnitLaunchConfigurationConstants;
import org.eclipse.jdt.internal.junit.launcher.TestKindRegistry;
import org.eclipse.jdt.launching.IJavaLaunchConfigurationConstants;
import org.eclipse.jdt.launching.VMRunnerConfiguration;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;

public class JUnitLaunchConfigurationDelegate extends org.eclipse.jdt.junit.launcher.JUnitLaunchConfigurationDelegate {

    private boolean fIsHierarchicalPackage;

    public JUnitLaunchArguments getJUnitLaunchArguments(ILaunchConfiguration configuration, String mode,
            boolean isHierarchicalPackage, IProgressMonitor monitor) throws CoreException {
        fIsHierarchicalPackage = isHierarchicalPackage;
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
            launchArguments.workingDirectory = config.getWorkingDirectory();
            launchArguments.mainClass = config.getClassToLaunch();
            launchArguments.projectName = javaProject.getProject().getName();
            launchArguments.classpath = config.getClassPath();
            launchArguments.modulepath = config.getModulepath();
            launchArguments.vmArguments = getVmArguments(config);
            launchArguments.programArguments = config.getProgramArguments();

            // The JUnit 5 launcher only supports run a single package, here we add all the sub-package names
            // to the package name file as a workaround
            if (isHierarchicalPackage &&
                    TestKindRegistry.JUNIT5_TEST_KIND_ID.equals(getTestRunnerKind(configuration).getId())) {
                appendPackageNames(launchArguments.programArguments, configuration);
            }
            return launchArguments;
        } catch (NoSuchMethodException | SecurityException | IllegalAccessException | IllegalArgumentException |
                InvocationTargetException e) {
            return null;
        } finally {
            fIsHierarchicalPackage = false;
        }
    }

    /*
     * Override the super implementation when it is launched in hierarchical mode and starts from
     * the package level
     *
     * @see org.eclipse.jdt.junit.launcher.JUnitLaunchConfigurationDelegate#evaluateTests(
     *      org.eclipse.debug.core.ILaunchConfiguration, org.eclipse.core.runtime.IProgressMonitor)
     */
    @Override
    protected IMember[] evaluateTests(ILaunchConfiguration configuration, IProgressMonitor monitor)
            throws CoreException {
        if (!fIsHierarchicalPackage) {
            return super.evaluateTests(configuration, monitor);
        }

        final IPackageFragment testPackage = getTestPackage(configuration);
        if (testPackage == null) {
            return super.evaluateTests(configuration, monitor);
        }

        final IPackageFragment[] packages = TestSearchUtils.getAllSubPackages(testPackage);
        
        final HashSet<IType> result = new HashSet<>();
        final ITestKind testKind = getTestRunnerKind(configuration);
        for (final IPackageFragment packageFragment : packages) {
            testKind.getFinder().findTestsInContainer(packageFragment, result, monitor);
        }
        
        if (result.isEmpty()) {
            final String msg = Messages.format(JUnitMessages.JUnitLaunchConfigurationDelegate_error_notests_kind,
                testKind.getDisplayName());
            abort(msg, null, IJavaLaunchConfigurationConstants.ERR_UNSPECIFIED_MAIN_TYPE);
        }
        return result.toArray(new IMember[result.size()]);
    }
    
    private IPackageFragment getTestPackage(ILaunchConfiguration configuration) throws CoreException {
        final String containerHandle = configuration.getAttribute(
                JUnitLaunchConfigurationConstants.ATTR_TEST_CONTAINER, "");
        if (containerHandle.length() != 0) {
            final IJavaElement element = JavaCore.create(containerHandle);
            if (element == null || !element.exists()) {
                abort(JUnitMessages.JUnitLaunchConfigurationDelegate_error_input_element_deosn_not_exist, null,
                        IJavaLaunchConfigurationConstants.ERR_UNSPECIFIED_MAIN_TYPE);
            }
            if (element instanceof IPackageFragment) {
                return (IPackageFragment) element;
            }
        }
        return null;
    }
    
    /*
     * (non-Javadoc)
     *
     * @see org.eclipse.jdt.junit.launcher.JUnitLaunchConfigurationDelegate#getTestRunnerKind(
     *      org.eclipse.debug.core.ILaunchConfiguration)
     */
    private ITestKind getTestRunnerKind(ILaunchConfiguration configuration) {
        ITestKind testKind = JUnitLaunchConfigurationConstants.getTestRunnerKind(configuration);
        if (testKind.isNull()) {
            testKind = TestKindRegistry.getDefault().getKind(TestKindRegistry.JUNIT4_TEST_KIND_ID);
        }
        return testKind;
    }

    private String[] getVmArguments(VMRunnerConfiguration config) {
        final List<String> vmArgs = new ArrayList<>();
        vmArgs.addAll(Arrays.asList(config.getVMArguments()));
        
        if (config.isPreviewEnabled()) {
            vmArgs.add("--enable-preview");
        }

        final String dependencies = config.getOverrideDependencies();
        JUnitLaunchUtils.addOverrideDependencies(vmArgs, dependencies);

        return vmArgs.toArray(new String[vmArgs.size()]);
    }

    private void appendPackageNames(String[] programArguments, ILaunchConfiguration configuration) {
        for (int i = 0; i < programArguments.length; i++) {
            if ("-packageNameFile".equals(programArguments[i]) && i + 1 < programArguments.length) {
                final String packageNameFilePath = programArguments[i + 1];
                final File file = new File(packageNameFilePath);
                try (BufferedWriter bw = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(file),
                        StandardCharsets.UTF_8))) {
                    final IPackageFragment testPackage = getTestPackage(configuration);
                    if (testPackage == null) {
                        return;
                    }
                    final IPackageFragment[] packages = TestSearchUtils.getAllSubPackages(testPackage);
                    for (final IPackageFragment pkg : packages) {
                        bw.write(pkg.getElementName());
                        bw.newLine();
                    }
                } catch (IOException | CoreException e) {
                    // do nothing
                }
                return;
            }
        }
    }

    public static class JUnitLaunchArguments {
        String workingDirectory;
        String mainClass;
        String projectName;
        String[] classpath;
        String[] modulepath;
        String[] vmArguments;
        String[] programArguments;
    }
}
