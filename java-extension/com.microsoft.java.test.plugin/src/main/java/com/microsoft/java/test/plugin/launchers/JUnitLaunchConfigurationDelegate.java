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
import com.microsoft.java.test.plugin.model.Response;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.util.JUnitPlugin;
import com.microsoft.java.test.plugin.util.TestSearchUtils;

import org.apache.commons.lang3.StringUtils;
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
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.dom.ITypeBinding;
import org.eclipse.jdt.core.dom.MethodDeclaration;
import org.eclipse.jdt.core.dom.SingleVariableDeclaration;
import org.eclipse.jdt.internal.corext.refactoring.structure.ASTNodeSearchUtil;
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
import java.util.LinkedList;
import java.util.List;
import java.util.Set;

public class JUnitLaunchConfigurationDelegate extends org.eclipse.jdt.junit.launcher.JUnitLaunchConfigurationDelegate {

    private Argument args;

    private static final Set<String> testNameArgs = new HashSet<>(
        Arrays.asList("-test", "-classNames", "-packageNameFile", "-testNameFile"));

    public JUnitLaunchConfigurationDelegate(Argument args) {
        super();
        this.args = args;
    }

    public Response<JUnitLaunchArguments> getJUnitLaunchArguments(ILaunchConfiguration configuration, String mode,
            IProgressMonitor monitor) {
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

            return new Response<>(launchArguments, null);
        } catch (NoSuchMethodException | SecurityException | IllegalAccessException | IllegalArgumentException |
                InvocationTargetException | CoreException e) {
            JUnitPlugin.logException("failed to resolve the classpath.", e);
            final String msg = e.getCause() != null ? e.getCause().getMessage() : e.getMessage();
            return new Response<>(null, msg);
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
            if (this.args.testNames.length > 1) {
                if (!JUnitLaunchUtils.supportsMultiMethodLaunch()) {
                    // The Class:method protocol is parsed by RemoteTestRunner inside
                    // org.eclipse.jdt.junit.runtime, which ships with the Eclipse Java
                    // Language Server (Language Support for Java(TM) by Red Hat). When
                    // that bundle predates eclipse.jdt.ui#2975, batching multiple
                    // methods into a single JVM would surface as a ClassNotFoundException
                    // at test time. Fail fast here with a marker the TypeScript side
                    // recognises so it can transparently fall back to launching each
                    // method in its own JVM (the legacy per-method path). The actionable
                    // text after the marker is preserved as a defensive fallback in case
                    // the fallback path itself also fails for an unrelated reason.
                    throw new CoreException(new Status(IStatus.ERROR, JUnitPlugin.PLUGIN_ID, IStatus.ERROR,
                            JUnitLaunchUtils.MULTI_METHOD_LAUNCH_UNSUPPORTED_PREFIX
                                    + "Running multiple test methods together in a single JVM requires a newer "
                                    + "Eclipse Java Language Server (org.eclipse.jdt.junit.runtime). "
                                    + "Please update the 'Language Support for Java(TM) by Red Hat' "
                                    + "extension and retry, or run the selected methods one at a time.",
                            null));
                }
                // Multi-method launch: hand the full selection to RemoteTestRunner via
                // -testNameFile using the new "Class:method" line format. The runner
                // will then load every selected method inside a single test JVM, so
                // per-class @BeforeAll/@AfterAll and any cached Spring
                // ApplicationContext are reused across the selection.
                final String fileName = createMethodTestNamesFile(this.args.testNames);
                arguments.add("-testNameFile");
                arguments.add(fileName);
            } else {
                arguments.add("-test");
                arguments.add(resolveMethodTestName(this.args.testNames[0]));

                if (StringUtils.isNotBlank(this.args.uniqueId)) {
                    arguments.add("-uniqueId");
                    arguments.add(this.args.uniqueId);
                }
            }
        }
    }

    private String resolveMethodTestName(String handleId) throws CoreException {
        final IMethod method = (IMethod) JavaCore.create(handleId);
        String testName = method.getElementName();
        if ((this.args.testKind == TestKind.JUnit5 || this.args.testKind == TestKind.JUnit6) &&
                method.getParameters().length > 0) {
            final ICompilationUnit unit = method.getCompilationUnit();
            if (unit == null) {
                throw new CoreException(new Status(IStatus.ERROR, JUnitPlugin.PLUGIN_ID, IStatus.ERROR,
                        "Cannot get compilation unit of method" + method.getElementName(), null)); //$NON-NLS-1$
            }
            final CompilationUnit root = (CompilationUnit) TestSearchUtils.parseToAst(unit,
                    false /*fromCache*/, new NullProgressMonitor());
            final MethodDeclaration methodDeclaration = ASTNodeSearchUtil.getMethodDeclarationNode(method, root);
            if (methodDeclaration == null) {
                throw new CoreException(new Status(IStatus.ERROR, JUnitPlugin.PLUGIN_ID, IStatus.ERROR,
                        "Cannot get method declaration of method" + method.getElementName(), null)); //$NON-NLS-1$
            }

            final List<String> parameters = new LinkedList<>();
            for (final Object obj : methodDeclaration.parameters()) {
                if (obj instanceof SingleVariableDeclaration) {
                    final ITypeBinding paramTypeBinding = ((SingleVariableDeclaration) obj)
                            .getType().resolveBinding();
                    if (paramTypeBinding == null) {
                        throw new CoreException(new Status(IStatus.ERROR, JUnitPlugin.PLUGIN_ID, IStatus.ERROR,
                                "Cannot set set argument for method" + methodDeclaration.toString(), null));
                    } else if (paramTypeBinding.isPrimitive()) {
                        parameters.add(paramTypeBinding.getQualifiedName());
                    } else {
                        parameters.add(paramTypeBinding.getBinaryName());
                    }
                }
            }
            if (parameters.size() > 0) {
                testName += "(" + String.join(",", parameters) + ")";
            }
        }
        return method.getDeclaringType().getFullyQualifiedName() + ':' + testName;
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

    private String createMethodTestNamesFile(String[] testNames) throws CoreException {
        try {
            final File file = File.createTempFile("testNames", ".txt"); //$NON-NLS-1$ //$NON-NLS-2$
            file.deleteOnExit();
            try (BufferedWriter bw = new BufferedWriter(new OutputStreamWriter(
                        new FileOutputStream(file), StandardCharsets.UTF_8));) {
                for (final String handleId : testNames) {
                    bw.write(resolveMethodTestName(handleId));
                    bw.newLine();
                }
            }
            return file.getAbsolutePath();
        } catch (IOException e) {
            throw new CoreException(new Status(
                    IStatus.ERROR, JUnitPlugin.PLUGIN_ID, IStatus.ERROR, "", e)); //$NON-NLS-1$
        }
    }
}
