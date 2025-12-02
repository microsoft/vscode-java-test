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
import org.eclipse.core.runtime.FileLocator;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.core.runtime.Platform;
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
import org.osgi.framework.Bundle;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class JUnitLaunchConfigurationDelegate extends org.eclipse.jdt.junit.launcher.JUnitLaunchConfigurationDelegate {

    private Argument args;

    private static final Set<String> testNameArgs = new HashSet<>(
        Arrays.asList("-test", "-classNames", "-packageNameFile", "-testNameFile"));

    // Pattern to match junit-platform-* and junit-jupiter-* jars with version numbers
    // Supports both Maven format (junit-jupiter-api-6.0.0.jar) and
    // OSGi bundle format (junit-jupiter-api_6.0.0.jar)
    private static final Pattern JUNIT_VERSION_PATTERN = Pattern.compile(
            "(junit-platform-[a-z-]+|junit-jupiter-[a-z-]+)[-_](\\d+)\\.(\\d+)\\.(\\d+)\\.jar$");

    // JUnit bundle names that need to be injected for test execution
    private static final String[] JUNIT_BUNDLE_NAMES = {
        "junit-jupiter-api",
        "junit-jupiter-engine",
        "junit-jupiter-params",
        "junit-platform-commons",
        "junit-platform-engine",
        "junit-platform-launcher",
        "junit-platform-suite-api",
        "junit-platform-suite-engine"
    };

    // Common dependency bundle names
    private static final String[] COMMON_BUNDLE_NAMES = {
        "org.opentest4j",
        "org.apiguardian.api"
    };

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
            
            // Debug: Log original classpath
            JUnitPlugin.logInfo("[JUnit Launch] TestKind: " + this.args.testKind);
            JUnitPlugin.logInfo("[JUnit Launch] Original classpath entries: " + 
                (config.getClassPath() != null ? config.getClassPath().length : 0));
            if (config.getClassPath() != null) {
                for (final String cp : config.getClassPath()) {
                    JUnitPlugin.logInfo("[JUnit Launch] Classpath: " + cp);
                }
            }
            
            launchArguments.classpath = filterClasspathByTestKind(config.getClassPath(), this.args.testKind, true);
            launchArguments.modulepath = filterClasspathByTestKind(config.getModulepath(), this.args.testKind, false);
            
            // Debug: Log filtered classpath
            JUnitPlugin.logInfo("[JUnit Launch] Filtered classpath entries: " + 
                (launchArguments.classpath != null ? launchArguments.classpath.length : 0));
            
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
            arguments.add("-test");
            final IMethod method = (IMethod) JavaCore.create(this.args.testNames[0]);
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
            arguments.add(method.getDeclaringType().getFullyQualifiedName() + ':' + testName);

            if (StringUtils.isNotBlank(this.args.uniqueId)) {
                arguments.add("-uniqueId");
                arguments.add(this.args.uniqueId);
            }
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

    /**
     * Check if the given major version is compatible with the test kind.
     * For JUnit 5: version < 6 (1.x for platform, 5.x for jupiter)
     * For JUnit 6: version >= 6
     * 
     * @param majorVersion the major version number
     * @param testKind the test framework kind
     * @return true if compatible, false otherwise
     */
    private boolean isVersionCompatible(int majorVersion, TestKind testKind) {
        switch (testKind) {
            case JUnit5:
                return majorVersion < 6;
            case JUnit6:
                return majorVersion >= 6;
            default:
                return true;
        }
    }

    /**
     * Filter the classpath/modulepath based on the test kind to avoid version conflicts.
     * For JUnit 5: use junit-platform-* version 1.x and junit-jupiter-* version 5.x
     * For JUnit 6: use junit-platform-* version 6.x and junit-jupiter-* version 6.x
     * 
     * Also optionally injects the required JUnit bundles from OSGi into the classpath since
     * Eclipse's ClasspathLocalizer only adds the junit*runtime bundle but not its Require-Bundle deps.
     * 
     * @param paths the original classpath or modulepath array
     * @param testKind the test framework kind
     * @param injectBundles whether to inject missing JUnit bundles (should only be true for classpath)
     * @return filtered paths array with JUnit bundles optionally injected
     */
    private String[] filterClasspathByTestKind(String[] paths, TestKind testKind, boolean injectBundles) {
        if (paths == null || testKind == null) {
            return paths;
        }

        // For non-JUnit5/6 test kinds, no filtering needed
        if (testKind != TestKind.JUnit5 && testKind != TestKind.JUnit6) {
            return paths;
        }

        final List<String> filteredPaths = new ArrayList<>();
        final Set<String> foundJUnitArtifacts = new HashSet<>();
        // Track essential artifacts for incomplete dependency detection
        boolean hasApi = false;
        boolean hasEngine = false;
        boolean hasLauncher = false;
        int includedCount = 0;
        int excludedCount = 0;

        // Single pass: filter paths and detect incomplete dependencies simultaneously
        for (final String path : paths) {
            final String fileName = new File(path).getName();
            final Matcher matcher = JUNIT_VERSION_PATTERN.matcher(fileName);

            if (!matcher.find()) {
                // Not a junit-platform/jupiter jar, include it directly
                filteredPaths.add(path);
                continue;
            }

            final String artifactName = matcher.group(1);
            final int majorVersion = Integer.parseInt(matcher.group(2));

            // Track essential artifacts for bundle injection decision
            if (injectBundles) {
                if ("junit-jupiter-api".equals(artifactName)) {
                    hasApi = true;
                } else if ("junit-jupiter-engine".equals(artifactName)) {
                    hasEngine = true;
                } else if ("junit-platform-launcher".equals(artifactName)) {
                    hasLauncher = true;
                }
            }

            if (isVersionCompatible(majorVersion, testKind)) {
                filteredPaths.add(path);
                foundJUnitArtifacts.add(artifactName);
                includedCount++;
            } else {
                excludedCount++;
                JUnitPlugin.logInfo("[Classpath Filter] " + testKind + " - Excluding: " + fileName);
            }
        }

        // Handle incomplete JUnit dependencies: if project has API but missing engine/launcher,
        // remove all project JUnit jars and use OSGi bundles for version consistency
        final boolean needsFullBundleInjection = injectBundles && hasApi && (!hasEngine || !hasLauncher);
        if (needsFullBundleInjection) {
            JUnitPlugin.logInfo("[Classpath Filter] Project has incomplete JUnit dependencies, " +
                    "will use OSGi bundles for all JUnit components to ensure version consistency");
            // Remove all JUnit jars that were added
            filteredPaths.removeIf(p -> JUNIT_VERSION_PATTERN.matcher(new File(p).getName()).find());
            foundJUnitArtifacts.clear();
            excludedCount += includedCount;
            includedCount = 0;
        }

        // Inject JUnit bundles from OSGi if needed
        if (injectBundles) {
            final List<String> injectedPaths = injectMissingJUnitBundles(testKind, foundJUnitArtifacts);
            if (!injectedPaths.isEmpty()) {
                filteredPaths.addAll(injectedPaths);
                JUnitPlugin.logInfo("[Classpath Inject] Injected " + injectedPaths.size() +
                        " JUnit bundles for " + testKind);
            }
        }

        JUnitPlugin.logInfo("[Classpath Filter] TestKind=" + testKind + ", Included=" +
                includedCount + " JUnit jars, Excluded=" + excludedCount +
                " JUnit jars, Found artifacts=" + foundJUnitArtifacts +
                ", Total paths=" + filteredPaths.size());

        return filteredPaths.toArray(new String[0]);
    }
    
    /**
     * Inject missing JUnit bundles from OSGi runtime into the classpath.
     * User's project typically only declares junit-jupiter-api as dependency,
     * but test execution needs engine, launcher, and other runtime bundles.
     * 
     * @param testKind the test framework kind
     * @param foundArtifacts set of JUnit artifact names already in classpath
     * @return list of bundle paths to add to classpath
     */
    private List<String> injectMissingJUnitBundles(TestKind testKind, Set<String> foundArtifacts) {
        final List<String> bundlePaths = new ArrayList<>();

        // Inject JUnit bundles that are not already in classpath
        for (final String bundleName : JUNIT_BUNDLE_NAMES) {
            if (!foundArtifacts.contains(bundleName)) {
                injectBundle(bundleName, getVersionRange(bundleName, testKind), bundlePaths);
            }
        }

        // Inject common dependencies if not present (check once, not per bundle)
        final boolean hasCommonDeps = foundArtifacts.stream()
                .anyMatch(a -> a.contains("opentest4j") || a.contains("apiguardian"));

        if (!hasCommonDeps) {
            for (final String bundleName : COMMON_BUNDLE_NAMES) {
                injectBundle(bundleName, getVersionRange(bundleName, testKind), bundlePaths);
            }
        }

        return bundlePaths;
    }

    /**
     * Get the OSGi version range for a bundle based on test kind.
     * 
     * @param bundleName the bundle symbolic name
     * @param testKind the test framework kind
     * @return the OSGi version range string
     */
    private String getVersionRange(String bundleName, TestKind testKind) {
        if (bundleName.startsWith("junit-jupiter")) {
            return testKind == TestKind.JUnit5 ? "[5.0.0,6.0.0)" : "[6.0.0,7.0.0)";
        } else if (bundleName.startsWith("junit-platform")) {
            return testKind == TestKind.JUnit5 ? "[1.0.0,2.0.0)" : "[6.0.0,7.0.0)";
        } else if ("org.opentest4j".equals(bundleName)) {
            return "[1.0.0,3.0.0)";
        } else if ("org.apiguardian.api".equals(bundleName)) {
            return "[1.0.0,2.0.0)";
        }
        return null;
    }

    /**
     * Try to inject a bundle into the classpath.
     * 
     * @param bundleName the bundle symbolic name
     * @param versionRange the OSGi version range
     * @param bundlePaths the list to add the bundle path to
     */
    private void injectBundle(String bundleName, String versionRange, List<String> bundlePaths) {
        if (versionRange == null) {
            return;
        }
        final String bundlePath = getBundlePath(bundleName, versionRange);
        if (bundlePath != null) {
            bundlePaths.add(bundlePath);
            JUnitPlugin.logInfo("[Classpath Inject] Added bundle: " + bundleName + " -> " + bundlePath);
        } else {
            JUnitPlugin.logInfo("[Classpath Inject] Bundle not found: " + bundleName + " " + versionRange);
        }
    }
    
    /**
     * Get the file path for an OSGi bundle by its symbolic name and version range.
     * 
     * @param bundleName the bundle symbolic name
     * @param versionRange the OSGi version range string
     * @return the absolute file path to the bundle, or null if not found
     */
    private String getBundlePath(String bundleName, String versionRange) {
        final Bundle[] bundles = Platform.getBundles(bundleName, versionRange);
        if (bundles != null && bundles.length > 0) {
            final Bundle bundle = bundles[0];
            try {
                final Optional<File> bundleFile = FileLocator.getBundleFileLocation(bundle);
                if (bundleFile.isPresent()) {
                    return bundleFile.get().getAbsolutePath();
                }
                // Fallback: try to resolve via bundle entry
                final URL bundleUrl = bundle.getEntry("/");
                if (bundleUrl != null) {
                    final URL fileUrl = FileLocator.toFileURL(bundleUrl);
                    return new File(fileUrl.getPath()).getAbsolutePath();
                }
            } catch (IOException e) {
                JUnitPlugin.logException("Failed to get bundle path for " + bundleName, e);
            }
        }
        return null;
    }
}
