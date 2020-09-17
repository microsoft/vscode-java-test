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

import com.google.gson.Gson;
import com.microsoft.java.test.plugin.launchers.JUnitLaunchConfigurationDelegate.JUnitLaunchArguments;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.util.TestSearchUtils;

import org.apache.commons.lang3.StringEscapeUtils;
import org.apache.commons.lang3.StringUtils;
import org.eclipse.core.resources.IContainer;
import org.eclipse.core.resources.IFolder;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.IPackageFragmentRoot;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.ASTNode;
import org.eclipse.jdt.core.dom.ITypeBinding;
import org.eclipse.jdt.core.dom.MethodDeclaration;
import org.eclipse.jdt.core.dom.NodeFinder;
import org.eclipse.jdt.core.dom.SingleVariableDeclaration;
import org.eclipse.jdt.launching.IRuntimeClasspathEntry;
import org.eclipse.jdt.launching.JavaRuntime;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.jdt.ls.core.internal.handlers.JsonRpcHelpers;
import org.eclipse.lsp4j.Position;

import java.io.File;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;

public class JUnitLaunchUtils {

    private static final String TESTNG_LOADER = "com.microsoft.java.test.loader.testng";
    private static final String JUNIT5_LOADER = "org.eclipse.jdt.junit.loader.junit5";
    private static final String JUNIT4_LOADER = "org.eclipse.jdt.junit.loader.junit4";

    private JUnitLaunchUtils() {}

    public static JUnitLaunchArguments resolveLaunchArgument(List<Object> arguments, IProgressMonitor monitor)
            throws URISyntaxException, CoreException {
        final Gson gson = new Gson();
        final Argument args = gson.fromJson((String) arguments.get(0), Argument.class);

        final TestInfo info = new TestInfo();

        info.testKind = getEclipseTestKind(args.testKind);

        final IJavaProject javaProject = ProjectUtils.getJavaProject(args.project);
        if (javaProject == null || !javaProject.exists()) {
            throw new RuntimeException("Failed to get the project with name: " + args.project);
        }
        info.project = javaProject.getProject();

        if (args.scope == TestLevel.ROOT || args.scope == TestLevel.FOLDER) {
            info.testContainer = StringEscapeUtils.escapeXml(javaProject.getHandleIdentifier());
        } else {
            final File file = Paths.get(new URI(args.uri)).toFile();
            if (args.scope == TestLevel.PACKAGE && file.isDirectory()) {
                parseConfigurationInfoForContainer(info, args);
            } else if ((args.scope == TestLevel.CLASS || args.scope == TestLevel.METHOD) && file.isFile()) {
                parseConfigurationInfoForClass(info, args, monitor);
            } else {
                throw new RuntimeException("The resource: " + file.getPath() + " is not testable.");
            }
        }

        final ILaunchConfiguration configuration = new JUnitLaunchConfiguration("JUnit Launch Configuration", info);
        final JUnitLaunchConfigurationDelegate delegate = new JUnitLaunchConfigurationDelegate();

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

    private static void parseConfigurationInfoForClass(TestInfo info, Argument args,
            IProgressMonitor monitor) throws JavaModelException {
        final ICompilationUnit cu = JDTUtils.resolveCompilationUnit(args.uri);
        if (cu == null) {
            throw new RuntimeException("Cannot resolve compilation unit from: " + args.uri);
        }

        for (final IType type : cu.getAllTypes()) {
            if (type.getFullyQualifiedName().equals(args.classFullName)) {
                info.mainType = args.classFullName;
                info.testName = parseTestName(args, cu, monitor);
                break;
            }
        }

        if (info.mainType == null) {
            throw new RuntimeException("Failed to find class '" + args.classFullName + "'");
        }
    }

    private static String parseTestName(Argument args, ICompilationUnit cu,
            IProgressMonitor monitor) throws JavaModelException {
        String testName = StringUtils.isEmpty(args.testName) ? "" : args.testName;
        // JUnit 5's methods need to have parameter information to launch
        if (args.testKind == TestKind.JUnit5 && args.scope == TestLevel.METHOD) {
            final ASTNode unit = TestSearchUtils.parseToAst(cu, monitor);
            if (unit == null) {
                return "";
            }
            final int startOffset = JsonRpcHelpers.toOffset(cu.getOpenable(), args.start.getLine(),
                args.start.getCharacter());
            final int endOffset = JsonRpcHelpers.toOffset(cu.getOpenable(), args.end.getLine(),
                args.end.getCharacter());
            // the offsets point to the range of SimpleName
            ASTNode methodDeclaration = NodeFinder.perform(unit, startOffset, endOffset - startOffset, cu);
            while (!(methodDeclaration instanceof MethodDeclaration)) {
                methodDeclaration = methodDeclaration.getParent();
            }
            final List<String> parameters = new LinkedList<>();
            for (final Object obj : ((MethodDeclaration) methodDeclaration).parameters()) {
                if (obj instanceof SingleVariableDeclaration) {
                    final ITypeBinding paramTypeBinding = ((SingleVariableDeclaration) obj).getType().resolveBinding();
                    if (paramTypeBinding.isParameterizedType()) {
                        parameters.add(paramTypeBinding.getBinaryName());
                    } else {
                        parameters.add(paramTypeBinding.getQualifiedName());
                    }
                }
            }
            if (parameters.size() > 0) {
                testName += String.format("(%s)", String.join(",", parameters));
            }
        }
        return testName;
    }

    private static void parseConfigurationInfoForContainer(TestInfo info, Argument args) throws URISyntaxException {
        final IContainer[] targetContainers = ResourcesPlugin.getWorkspace().getRoot()
                .findContainersForLocationURI(new URI(args.uri));
        if (targetContainers == null || targetContainers.length == 0) {
            throw new RuntimeException("Cannot find resource containers from: " + args.uri);
        }

        // For multi-module scenario, findContainersForLocationURI API may return a container array,
        // need put the result from the nearest project in front.
        Arrays.sort(targetContainers, (Comparator<IContainer>) (IContainer a, IContainer b) -> {
            return a.getFullPath().toPortableString().length() - b.getFullPath().toPortableString().length();
        });

        IJavaElement targetElement = null;
        for (final IContainer container : targetContainers) {
            targetElement = JavaCore.create(container);
            if (targetElement != null) {
                final IJavaProject javaProject = targetElement.getJavaProject();
                if (javaProject == null) {
                    continue;
                }
                info.project = javaProject.getProject();
                break;
            }
        }
        
        if (targetElement == null) {
            throw new RuntimeException("Cannot resolve valid element from: " + args.uri);
        }
        info.testContainer = StringEscapeUtils.escapeXml(targetElement.getHandleIdentifier());
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
        public String uri;
        public String classFullName;
        public String testName;
        public String project;
        public TestLevel scope;
        public TestKind testKind;
        public Position start;
        public Position end;
    }
}
