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
     * Filter the classpath/modulepath based on the test kind to avoid version conflicts.
     * For JUnit 5: use junit-platform-* version 1.x and junit-jupiter-* version 5.x
     * For JUnit 6: use junit-platform-* version 6.x and junit-jupiter-* version 6.x
     * 
     * @param paths the original classpath or modulepath array
     * @param testKind the test framework kind
     * @return filtered paths array
     */
    private String[] filterClasspathByTestKind(String[] paths, TestKind testKind) {
        return filterClasspathByTestKind(paths, testKind, false);
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

        // Pattern to match junit-platform-* and junit-jupiter-* jars with version numbers
        // Supports both Maven format (junit-jupiter-api-6.0.0.jar) and 
        // OSGi bundle format (junit-jupiter-api_6.0.0.jar)
        // Capture full version string for version matching
        final Pattern junitVersionPattern = Pattern.compile(
                "(junit-platform-[a-z-]+|junit-jupiter-[a-z-]+)[-_](\\d+)\\.(\\d+)\\.(\\d+)\\.jar$");

        final List<String> filteredPaths = new ArrayList<>();
        final Set<String> foundJUnitArtifacts = new HashSet<>();
        int includedCount = 0;
        int excludedCount = 0;
        
        // First pass: check if project has incomplete JUnit dependencies
        // If so, we'll use all OSGi bundles to ensure version consistency
        boolean needsFullBundleInjection = false;
        if (injectBundles && (testKind == TestKind.JUnit5 || testKind == TestKind.JUnit6)) {
            final Set<String> projectArtifacts = new HashSet<>();
            for (final String path : paths) {
                final String fileName = new File(path).getName();
                final Matcher m = junitVersionPattern.matcher(fileName);
                if (m.find()) {
                    projectArtifacts.add(m.group(1));
                }
            }
            // Check if essential runtime bundles are missing
            final boolean hasApi = projectArtifacts.contains("junit-jupiter-api");
            final boolean hasEngine = projectArtifacts.contains("junit-jupiter-engine");
            final boolean hasLauncher = projectArtifacts.contains("junit-platform-launcher");
            needsFullBundleInjection = hasApi && (!hasEngine || !hasLauncher);
            
            if (needsFullBundleInjection) {
                JUnitPlugin.logInfo("[Classpath Filter] Project has incomplete JUnit dependencies, " +
                        "will use OSGi bundles for all JUnit components to ensure version consistency");
            }
        }
        
        for (final String path : paths) {
            final String fileName = new File(path).getName();
            final Matcher matcher = junitVersionPattern.matcher(fileName);
            
            if (matcher.find()) {
                final String artifactName = matcher.group(1);
                final int majorVersion = Integer.parseInt(matcher.group(2));
                
                // If we need full bundle injection, exclude ALL project JUnit jars
                if (needsFullBundleInjection) {
                    excludedCount++;
                    JUnitPlugin.logInfo("[Classpath Filter] Excluding project jar " +
                            "(will use OSGi bundle): " + fileName);
                    continue;
                }
                
                if (testKind == TestKind.JUnit5) {
                    // For JUnit 5: only include version 1.x for platform, 5.x for jupiter
                    if (majorVersion < 6) {
                        filteredPaths.add(path);
                        foundJUnitArtifacts.add(artifactName);
                        includedCount++;
                    } else {
                        excludedCount++;
                        JUnitPlugin.logInfo("[Classpath Filter] JUnit5 - Excluding: " + fileName);
                    }
                } else if (testKind == TestKind.JUnit6) {
                    // For JUnit 6: only include version 6.x for both platform and jupiter
                    if (majorVersion >= 6) {
                        filteredPaths.add(path);
                        foundJUnitArtifacts.add(artifactName);
                        includedCount++;
                    } else {
                        excludedCount++;
                        JUnitPlugin.logInfo("[Classpath Filter] JUnit6 - Excluding: " + fileName);
                    }
                } else {
                    // For other test kinds, include all
                    filteredPaths.add(path);
                    foundJUnitArtifacts.add(artifactName);
                    includedCount++;
                }
            } else {
                // Not a junit-platform/jupiter jar, include it
                filteredPaths.add(path);
            }
        }
        
        // Inject JUnit bundles from OSGi if needed
        // If needsFullBundleInjection, foundJUnitArtifacts is empty so all bundles will be injected
        if (injectBundles && (testKind == TestKind.JUnit5 || testKind == TestKind.JUnit6)) {
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
        
        // Define required bundles based on test kind
        final String[][] bundleSpecs;
        if (testKind == TestKind.JUnit5) {
            bundleSpecs = new String[][] {
                {"junit-jupiter-api", "[5.0.0,6.0.0)"},
                {"junit-jupiter-engine", "[5.0.0,6.0.0)"},
                {"junit-jupiter-params", "[5.0.0,6.0.0)"},
                {"junit-platform-commons", "[1.0.0,2.0.0)"},
                {"junit-platform-engine", "[1.0.0,2.0.0)"},
                {"junit-platform-launcher", "[1.0.0,2.0.0)"},
                {"junit-platform-suite-api", "[1.0.0,2.0.0)"},
                {"junit-platform-suite-engine", "[1.0.0,2.0.0)"}
            };
        } else if (testKind == TestKind.JUnit6) {
            bundleSpecs = new String[][] {
                {"junit-jupiter-api", "[6.0.0,7.0.0)"},
                {"junit-jupiter-engine", "[6.0.0,7.0.0)"},
                {"junit-jupiter-params", "[6.0.0,7.0.0)"},
                {"junit-platform-commons", "[6.0.0,7.0.0)"},
                {"junit-platform-engine", "[6.0.0,7.0.0)"},
                {"junit-platform-launcher", "[6.0.0,7.0.0)"},
                {"junit-platform-suite-api", "[6.0.0,7.0.0)"},
                {"junit-platform-suite-engine", "[6.0.0,7.0.0)"}
            };
        } else {
            return bundlePaths;
        }
        
        // Common dependencies
        final String[][] commonBundles = {
            {"org.opentest4j", "[1.0.0,3.0.0)"},
            {"org.apiguardian.api", "[1.0.0,2.0.0)"}
        };
        
        // Inject bundles that are not already in classpath
        for (final String[] spec : bundleSpecs) {
            final String bundleName = spec[0];
            final String versionRange = spec[1];
            
            if (!foundArtifacts.contains(bundleName)) {
                final String bundlePath = getBundlePath(bundleName, versionRange);
                if (bundlePath != null) {
                    bundlePaths.add(bundlePath);
                    JUnitPlugin.logInfo("[Classpath Inject] Added bundle: " +
                            bundleName + " -> " + bundlePath);
                } else {
                    JUnitPlugin.logInfo("[Classpath Inject] Bundle not found: " +
                            bundleName + " " + versionRange);
                }
            }
        }
        
        // Inject common dependencies if not present
        for (final String[] spec : commonBundles) {
            final String bundleName = spec[0];
            final String versionRange = spec[1];
            
            final boolean found = foundArtifacts.stream()
                    .anyMatch(a -> a.contains("opentest4j") || a.contains("apiguardian"));
            
            if (!found) {
                final String bundlePath = getBundlePath(bundleName, versionRange);
                if (bundlePath != null) {
                    bundlePaths.add(bundlePath);
                    JUnitPlugin.logInfo("[Classpath Inject] Added common bundle: " +
                            bundleName + " -> " + bundlePath);
                }
            }
        }
        
        return bundlePaths;
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
