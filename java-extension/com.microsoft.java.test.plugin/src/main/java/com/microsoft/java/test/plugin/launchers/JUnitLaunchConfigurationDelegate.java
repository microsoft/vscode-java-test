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

import com.microsoft.java.test.plugin.launchers.JUnitLaunchUtils.Argument;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.util.JUnitPlugin;
import com.microsoft.java.test.plugin.util.TestSearchUtils;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.core.runtime.Status;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.Launch;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.dom.ASTNode;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.dom.ITypeBinding;
import org.eclipse.jdt.core.dom.MethodDeclaration;
import org.eclipse.jdt.core.dom.NodeFinder;
import org.eclipse.jdt.core.dom.SingleVariableDeclaration;
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
import java.util.LinkedList;
import java.util.List;
import java.util.Set;

public class JUnitLaunchConfigurationDelegate extends org.eclipse.jdt.junit.launcher.JUnitLaunchConfigurationDelegate {

    private Argument args;

    private static final Set<String> testNameArgs = Set.of("-test", "-classNames", "-packageNameFile", "-testNameFile");

    public JUnitLaunchConfigurationDelegate(Argument args) {
        super();
        this.args = args;
    }

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
            launchArguments.workingDirectory = config.getWorkingDirectory();
            launchArguments.mainClass = config.getClassToLaunch();
            launchArguments.projectName = javaProject.getProject().getName();
            launchArguments.classpath = config.getClassPath();
            launchArguments.modulepath = config.getModulepath();
            launchArguments.vmArguments = getVmArguments(config);
            launchArguments.programArguments = parseParameters(config.getProgramArguments());


            return launchArguments;
        } catch (NoSuchMethodException | SecurityException | IllegalAccessException | IllegalArgumentException |
                InvocationTargetException e) {
            JUnitPlugin.logException("failed to resolve the classpath.", e);
            return null;
        }
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

    /**
     * To re-calculate the parameters to the test runner, this is because the argument resolved by Eclipse only supports
     * run single package/class, but its test runner supports to run multiple test items in a test session,
     * so we update the parameters here to leverage this capability.
     * @param programArguments
     * @return
     * @throws CoreException
     */
    private String[] parseParameters(String[] programArguments) throws CoreException {
        final List<String> arguments = new LinkedList<>();
        for (int i = 0; i < programArguments.length; i++) {
            if (testNameArgs.contains(programArguments[i])) {
                while (i + 1 < programArguments.length && !programArguments[i + 1].startsWith("-")) {
                    i++;
                }
            } else {
                arguments.add(programArguments[i]);
                while (i + 1 < programArguments.length && !programArguments[i + 1].startsWith("-")) {
                    arguments.add(programArguments[++i]);
                }
            }
        }

        addTestItemArgs(arguments);

        return arguments.toArray(new String[arguments.size()]);
    }

    private void addTestItemArgs(List<String> arguments) throws CoreException {
        if (this.args.testLevel == TestLevel.CLASS) {
            final String fileName = createTestNamesFile(this.args.testNames);
            arguments.add("-testNameFile");
            arguments.add(fileName);
        } else if (this.args.testLevel == TestLevel.METHOD) {
            arguments.add("-test");
            final IMethod method = (IMethod) JavaCore.create(this.args.testNames[0]);
            String testName = method.getElementName();
            if (this.args.testKind == TestKind.JUnit5 && method.getParameters().length > 0) {
                final ICompilationUnit unit = method.getCompilationUnit();
                if (unit == null) {
                    throw new CoreException(new Status(IStatus.ERROR, JUnitPlugin.PLUGIN_ID, IStatus.ERROR,
                            "Cannot get compilation unit of method" + method.getElementName(), null)); //$NON-NLS-1$
                }
                final CompilationUnit root = (CompilationUnit) TestSearchUtils.parseToAst(unit,
                        false /*fromCache*/, new NullProgressMonitor());
                final String key = method.getKey();
                ASTNode methodDeclaration = root.findDeclaringNode(key);
                if (methodDeclaration == null) {
                    // fallback to find it according to source range
                    methodDeclaration = NodeFinder.perform(root, method.getSourceRange().getOffset(),
                            method.getSourceRange().getLength(), unit);
                }
                if (!(methodDeclaration instanceof MethodDeclaration)) {
                    throw new CoreException(new Status(IStatus.ERROR, JUnitPlugin.PLUGIN_ID, IStatus.ERROR,
                            "Cannot get method declaration of method" + method.getElementName(), null)); //$NON-NLS-1$
                }

                final List<String> parameters = new LinkedList<>();
                for (final Object obj : ((MethodDeclaration) methodDeclaration).parameters()) {
                    if (obj instanceof SingleVariableDeclaration) {
                        final ITypeBinding paramTypeBinding = ((SingleVariableDeclaration) obj)
                                .getType().resolveBinding();
                        if (paramTypeBinding.isParameterizedType()) {
                            parameters.add(paramTypeBinding.getBinaryName());
                        } else {
                            parameters.add(paramTypeBinding.getQualifiedName());
                        }
                    }
                }
                if (parameters.size() > 0) {
                    testName += "(" + String.join(",", parameters) + ")";
                }
            }
            arguments.add(method.getDeclaringType().getFullyQualifiedName() + ':' + testName);
        }
    }

    private String createTestNamesFile(String[] testNames) throws CoreException {
        try {
            final File file = File.createTempFile("testNames", ".txt"); //$NON-NLS-1$ //$NON-NLS-2$
            file.deleteOnExit();
            try (BufferedWriter bw = new BufferedWriter(new OutputStreamWriter(
                        new FileOutputStream(file), StandardCharsets.UTF_8));) {
                for (final String testName : testNames) {
                    bw.write(testName.substring(testName.indexOf("@") + 1));
                    bw.newLine();
                }
            }
            return file.getAbsolutePath();
        } catch (IOException e) {
            throw new CoreException(new Status(
                    IStatus.ERROR, JUnitPlugin.PLUGIN_ID, IStatus.ERROR, "", e)); //$NON-NLS-1$
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
