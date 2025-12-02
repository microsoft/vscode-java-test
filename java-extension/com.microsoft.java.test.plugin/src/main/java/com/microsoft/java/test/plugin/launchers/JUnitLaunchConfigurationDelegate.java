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
            // Enhance launch configuration for JUnit 6 if needed
            final ILaunchConfiguration enhancedConfig = 
                enhanceConfigurationForJUnit6(configuration);
            
            final Method getVMRunnerConfiguration = getClass().getSuperclass().getDeclaredMethod(
                    "getVMRunnerConfiguration", ILaunchConfiguration.class, ILaunch.class, String.class,
                    IProgressMonitor.class);
            getVMRunnerConfiguration.setAccessible(true);
            final VMRunnerConfiguration config = (VMRunnerConfiguration) getVMRunnerConfiguration.invoke(this,
                    enhancedConfig, launch, mode, new NullProgressMonitor());
            final IJavaProject javaProject = getJavaProject(enhancedConfig);
            
            // Post-process VMRunnerConfiguration for JUnit 6 if needed
            final String[] enhancedClasspath = enhanceClasspathForJUnit6(config.getClassPath(), javaProject);
            
            // Apply enhanced classpath via reflection if needed
            if (this.args.testKind == TestKind.JUnit6 && !Arrays.equals(config.getClassPath(), enhancedClasspath)) {
                applyEnhancedClasspathToConfig(config, enhancedClasspath);
                configureJUnit6RuntimeEnvironment(config, javaProject);
            }
            
            final JUnitLaunchArguments launchArguments = new JUnitLaunchArguments();
            launchArguments.workingDirectory = config.getWorkingDirectory();
            launchArguments.mainClass = config.getClassToLaunch();
            launchArguments.projectName = javaProject.getProject().getName();
            launchArguments.classpath = enhancedClasspath;
            launchArguments.modulepath = config.getModulepath();
            launchArguments.vmArguments = getVmArguments(config);
            launchArguments.programArguments = parseParameters(config.getProgramArguments());

            return new Response<>(launchArguments, null);
        } catch (NoSuchMethodException | SecurityException | IllegalAccessException | IllegalArgumentException |
                InvocationTargetException | CoreException e) {
            // Enhanced error logging for loader issues
            Throwable cause = e;
            final StringBuilder errorDetails = new StringBuilder();
            errorDetails.append("Failed to resolve the classpath. Error chain:\n");
            while (cause != null) {
                errorDetails.append("  -> ").append(cause.getClass().getName())
                           .append(": ").append(cause.getMessage()).append("\n");
                cause = cause.getCause();
            }
            JUnitPlugin.logError(errorDetails.toString());
            JUnitPlugin.logException("failed to resolve the classpath.", e);
            final String msg = e.getCause() != null ? e.getCause().getMessage() : e.getMessage();
            return new Response<>(null, msg);
        }
    }

    /**
     * Enhance classpath for JUnit 6 using proper Bundle extension patterns (JDT LS approach).
     * This method leverages the new JUnitBundleResolver for reliable Bundle management.
     */
    private String[] enhanceClasspathForJUnit6(String[] originalClasspath, IJavaProject javaProject) {
        if (this.args.testKind != TestKind.JUnit6) {
            return originalClasspath;
        }
        
        JUnitPlugin.logInfo("=== JUnit 6 Classpath Enhancement (Bundle Extension Pattern) ===");
        JUnitPlugin.logInfo("Original classpath has " + originalClasspath.length + " entries");
        
        try {
            // Use the new Bundle resolver following JDT LS patterns
            final JUnitBundleResolver bundleResolver = new JUnitBundleResolver(javaProject);
            final List<String> junit6BundlePaths = bundleResolver.resolveJUnit6BundlePaths();
            
            if (!junit6BundlePaths.isEmpty()) {
                JUnitPlugin.logInfo("Successfully resolved " + junit6BundlePaths.size() + " JUnit 6 Bundles");
                
                // Validate JUnit6TestLoader accessibility
                final boolean loaderValidated = bundleResolver.validateJUnit6TestLoaderAccess(junit6BundlePaths);
                if (!loaderValidated) {
                    JUnitPlugin.logError("⚠️  JUnit6TestLoader validation failed, but proceeding with Bundle paths");
                }
                
                // Build enhanced classpath: Bundle paths FIRST, then original classpath
                final List<String> enhancedClasspath = new ArrayList<>();
                enhancedClasspath.addAll(junit6BundlePaths);  // Bundle dependencies first
                enhancedClasspath.addAll(Arrays.asList(originalClasspath));  // Original classpath second
                
                // Log enhancement details
                logBundleEnhancementSummary(junit6BundlePaths, originalClasspath, enhancedClasspath);
                
                return enhancedClasspath.toArray(new String[0]);
                
            } else {
                JUnitPlugin.logError("❌ No JUnit 6 Bundles resolved, using original classpath");
                return originalClasspath;
            }
            
        } catch (final Exception e) {
            JUnitPlugin.logException("Exception during JUnit 6 Bundle enhancement", e);
            return originalClasspath;
        }
    }

    /**
     * Log detailed summary of Bundle-based classpath enhancement.
     */
    private void logBundleEnhancementSummary(List<String> bundlePaths, String[] originalClasspath, 
            List<String> enhancedClasspath) {
        JUnitPlugin.logInfo("=== Bundle Enhancement Summary ===");
        JUnitPlugin.logInfo("Added " + bundlePaths.size() + " JUnit 6 Bundle paths at the BEGINNING:");
        
        for (int i = 0; i < bundlePaths.size(); i++) {
            final String bundlePath = bundlePaths.get(i);
            final String fileName = extractJarName(bundlePath);
            JUnitPlugin.logInfo("  Bundle[" + i + "]: " + fileName + " -> " + bundlePath);
        }
        
        JUnitPlugin.logInfo("Followed by " + originalClasspath.length + " original classpath entries");
        JUnitPlugin.logInfo("Total enhanced classpath size: " + enhancedClasspath.size() + " entries");
        
        // Show loading order for first few entries
        JUnitPlugin.logInfo("Classpath loading order (first 5 entries):");
        for (int i = 0; i < Math.min(5, enhancedClasspath.size()); i++) {
            final String entry = enhancedClasspath.get(i);
            final String entryType = i < bundlePaths.size() ? "Bundle" : "Original";
            JUnitPlugin.logInfo("  [" + i + "] (" + entryType + ") " + extractJarName(entry));
        }
        
        JUnitPlugin.logInfo("===================================");
    }
    
    /**
     * Configure additional JUnit 6 runtime environment settings.
     */
    private void configureJUnit6RuntimeEnvironment(VMRunnerConfiguration config, IJavaProject javaProject) {
        JUnitPlugin.logInfo("=== JUnit 6 Runtime Environment Configuration ===");
        
        try {
            // Get current VM arguments
            final String[] currentVMArgs = config.getVMArguments();
            final List<String> vmArgsList = new ArrayList<>(Arrays.asList(currentVMArgs));
            
            // Add system properties to help with JUnit 6 class loading
            boolean modified = false;
            
            // Ensure proper class loading for JUnit 6
            if (!containsSystemProperty(vmArgsList, "junit.platform.launcher.class")) {
                vmArgsList.add(
                    "-Djunit.platform.launcher.class=org.eclipse.jdt.internal.junit6.runner.JUnit6TestLoader");
                modified = true;
                JUnitPlugin.logInfo("Added JUnit 6 test loader system property");
            }
            
            // Enable detailed JUnit debugging
            if (!containsSystemProperty(vmArgsList, "junit.jupiter.testclass.order.default")) {
                vmArgsList.add(
                    "-Djunit.jupiter.testclass.order.default=org.junit.jupiter.api.ClassOrderer$OrderAnnotation");
                modified = true;
            }
            
            // Add classpath-related debugging for troubleshooting
            if (!containsSystemProperty(vmArgsList, "java.system.class.loader.debug")) {
                vmArgsList.add("-Djava.system.class.loader.debug=true");
                modified = true;
            }
            
            if (modified) {
                config.setVMArguments(vmArgsList.toArray(new String[0]));
                JUnitPlugin.logInfo("Enhanced VM arguments for JUnit 6 runtime");
                JUnitPlugin.logInfo("Total VM arguments: " + vmArgsList.size());
            }
            
            // Log final configuration
            JUnitPlugin.logInfo("Final classpath entries: " + config.getClassPath().length);
            JUnitPlugin.logInfo("VM arguments count: " + config.getVMArguments().length);
            JUnitPlugin.logInfo("Main class: " + config.getClassToLaunch());
            
        } catch (Exception e) {
            JUnitPlugin.logException("Error configuring JUnit 6 runtime environment", e);
        }
        
        JUnitPlugin.logInfo("=================================================");
    }
    
    /**
     * Apply enhanced classpath to VMRunnerConfiguration via reflection.
     * VMRunnerConfiguration's classpath field is private, so we use reflection.
     */
    private void applyEnhancedClasspathToConfig(VMRunnerConfiguration config, String[] enhancedClasspath) {
        try {
            JUnitPlugin.logInfo("=== Applying Enhanced Classpath via Reflection ===");
            
            // Use reflection to access the private fClassPath field
            final java.lang.reflect.Field classPathField = config.getClass().getDeclaredField("fClassPath");
            classPathField.setAccessible(true);
            
            // Log the change
            final String[] originalClasspath = config.getClassPath();
            JUnitPlugin.logInfo("Original VMRunnerConfiguration classpath: " + originalClasspath.length + " entries");
            JUnitPlugin.logInfo("Enhanced classpath: " + enhancedClasspath.length + " entries");
            
            // Apply the enhanced classpath
            classPathField.set(config, enhancedClasspath);
            
            // Verify the change
            final String[] updatedClasspath = config.getClassPath();
            JUnitPlugin.logInfo("✅ VMRunnerConfiguration classpath updated: " + updatedClasspath.length + " entries");
            JUnitPlugin.logInfo("Verification: first entry is now: " + 
                (updatedClasspath.length > 0 ? extractJarName(updatedClasspath[0]) : "empty"));
            
        } catch (Exception e) {
            JUnitPlugin.logException("❌ Failed to apply enhanced classpath via reflection", e);
            JUnitPlugin.logError("Will rely on JUnitLaunchArguments.classpath for classpath enhancement");
        }
        
        JUnitPlugin.logInfo("==================================================");
    }
    
    /**
     * Check if VM arguments already contain a specific system property.
     */
    private boolean containsSystemProperty(List<String> vmArgs, String propertyName) {
        final String propertyPrefix = "-D" + propertyName + "=";
        return vmArgs.stream().anyMatch(arg -> arg.startsWith(propertyPrefix));
    }
    
    /**
     * Check if a bundle is already present in the classpath array.
     */
    private boolean isAlreadyInClasspath(String[] classpath, String bundleName) {
        final boolean found = Arrays.stream(classpath)
            .anyMatch(path -> path != null && path.contains(bundleName));
        
        if (found) {
            // Find and log which specific entry contains the bundle
            for (int i = 0; i < classpath.length; i++) {
                if (classpath[i] != null && classpath[i].contains(bundleName)) {
                    JUnitPlugin.logInfo("Bundle " + bundleName + " found at classpath[" + i + "]: " + 
                        extractJarName(classpath[i]));
                    break;
                }
            }
        }
        
        return found;
    }
    
    /**
     * Extract jar/bundle name from full path for cleaner logging.
     */
    private String extractJarName(String fullPath) {
        if (fullPath == null) {
            return "<null>";
        }
        final String[] parts = fullPath.replace('\\', '/').split("/");
        if (parts.length > 0) {
            final String fileName = parts[parts.length - 1];
            return fileName.isEmpty() ? "<directory>" : fileName;
        }
        return fullPath;
    }
    
    /**
     * Resolve bundle path using JDT LS's existing mechanisms via reflection.
     * This leverages the battle-tested bundle resolution logic already in JDT LS.
     */
    private String resolveBundlePathUsingJDTLS(String bundleId, IJavaProject javaProject) {
        JUnitPlugin.logInfo("    Resolving bundle: " + bundleId);
        try {
            // Try to use JavaRuntime.resolveBundle or similar JDT LS methods
            // First attempt: Use standard OSGi Platform APIs (which JDT LS uses internally)
            final Bundle[] bundles = Platform.getBundles(bundleId, null);
            JUnitPlugin.logInfo("    Platform.getBundles() returned " + 
                (bundles != null ? bundles.length : 0) + " bundles");
            
            if (bundles != null && bundles.length > 0) {
                // Log all available bundles for this ID
                for (int i = 0; i < bundles.length; i++) {
                    final Bundle bundle = bundles[i];
                    JUnitPlugin.logInfo("      Bundle[" + i + "]: " + bundle.getSymbolicName() + 
                        " v" + bundle.getVersion() + " (state: " + getBundleStateString(bundle.getState()) + ")");
                }
                
                // Use JDT LS's bundle selection logic by looking for the best bundle
                for (final Bundle bundle : bundles) {
                    if (bundle.getState() == Bundle.ACTIVE || bundle.getState() == Bundle.RESOLVED) {
                        final File bundleFile = FileLocator.getBundleFile(bundle);
                        if (bundleFile != null && bundleFile.exists()) {
                            final String bundlePath = bundleFile.getAbsolutePath();
                            JUnitPlugin.logInfo("    ✅ Selected bundle: " + bundle.getSymbolicName() + 
                                " v" + bundle.getVersion() + " at: " + bundlePath +
                                " (state: " + getBundleStateString(bundle.getState()) + ")");
                            return bundlePath;
                        } else {
                            JUnitPlugin.logInfo("    ❌ Bundle file not accessible: " + bundle.getSymbolicName());
                        }
                    } else {
                        JUnitPlugin.logInfo("    ⚠️  Bundle not active/resolved: " + bundle.getSymbolicName() + 
                            " (state: " + getBundleStateString(bundle.getState()) + ")");
                    }
                }
            } else {
                JUnitPlugin.logInfo("    ⚠️  No bundles found for: " + bundleId);
            }
            
            // Second attempt: Try to call JDT LS's classpath resolution methods via reflection
            return tryJDTLSClasspathResolution(bundleId, javaProject);
            
        } catch (Exception e) {
            JUnitPlugin.logException("    ❌ Error resolving bundle via JDT LS: " + bundleId, e);
        }
        return null;
    }
    
    /**
     * Attempt to use JDT LS's internal classpath resolution via reflection.
     * This leverages existing JDT LS infrastructure instead of reimplementing logic.
     */
    private String tryJDTLSClasspathResolution(String bundleId, IJavaProject javaProject) {
        try {
            JUnitPlugin.logInfo("Attempting JDT LS classpath resolution for: " + bundleId);
            
            // Try to use JavaRuntime.resolveRuntimeClasspath or similar methods
            // that are already available in the parent class context
            final Class<?> javaRuntimeClass = Class.forName("org.eclipse.jdt.launching.JavaRuntime");
            
            // Method 1: Try to get default JRE classpath entries which might include system bundles
            final Method getDefaultJRELibraryMethod = javaRuntimeClass.getMethod("getDefaultJREContainerEntry");
            if (getDefaultJRELibraryMethod != null) {
                JUnitPlugin.logInfo("Found JavaRuntime.getDefaultJREContainerEntry method");
                // Could inspect the default JRE entries here
            }
            
            // Method 2: Since we're already calling getVMRunnerConfiguration via reflection,
            // we can try to access more parent class methods for classpath resolution
            final Class<?> parentClass = getClass().getSuperclass(); // JUnitLaunchConfigurationDelegate
            final Method[] parentMethods = parentClass.getDeclaredMethods();
            
            for (final Method method : parentMethods) {
                final String methodName = method.getName();
                // Look for helpful methods in the parent class
                if (methodName.contains("classpath") || methodName.contains("runtime") || 
                    methodName.contains("resolve")) {
                    JUnitPlugin.logInfo("Available parent method: " + methodName + 
                        " with " + method.getParameterCount() + " parameters");
                }
            }
            
            return null; // For now, rely on the Platform.getBundles approach above
            
        } catch (Exception e) {
            JUnitPlugin.logException("JDT LS reflection attempt failed for: " + bundleId, e);
        }
        return null;
    }

    /**
     * Basic configuration enhancement for JUnit 6 (mainly for validation).
     * The main classpath enhancement is done post-processing in enhanceClasspathForJUnit6().
     */
    private ILaunchConfiguration enhanceConfigurationForJUnit6(ILaunchConfiguration configuration) 
            throws CoreException {
        if (this.args.testKind != TestKind.JUnit6) {
            return configuration;
        }
        
        JUnitPlugin.logInfo("=== JUnit 6 Launch Configuration Enhancement ===");
        
        // Create a working copy to modify the configuration
        final org.eclipse.debug.core.ILaunchConfigurationWorkingCopy workingCopy = 
            configuration.getWorkingCopy();
        
        // For JUnit 6, we keep RemoteTestRunner as the main class
        // but ensure the TEST_KIND points to junit6 so it uses JUnit6TestLoader
        workingCopy.setAttribute("org.eclipse.jdt.junit.TEST_KIND", "org.eclipse.jdt.junit.loader.junit6");
        
        // Add JUnit 6 specific system properties to help with class loading
        final String vmArgs = workingCopy.getAttribute(
            org.eclipse.jdt.launching.IJavaLaunchConfigurationConstants.ATTR_VM_ARGUMENTS, "");
        
        final StringBuilder enhancedVMArgs = new StringBuilder(vmArgs);
        if (!vmArgs.contains("-Djunit.testloader.class")) {
            if (enhancedVMArgs.length() > 0) {
                enhancedVMArgs.append(" ");
            }
            enhancedVMArgs.append("-Djunit.testloader.class=org.eclipse.jdt.internal.junit6.runner.JUnit6TestLoader");
        }
        
        workingCopy.setAttribute(
            org.eclipse.jdt.launching.IJavaLaunchConfigurationConstants.ATTR_VM_ARGUMENTS, 
            enhancedVMArgs.toString());
        
        JUnitPlugin.logInfo("✅ Set TEST_KIND to junit6");
        JUnitPlugin.logInfo("✅ Added JUnit6TestLoader system property");
        JUnitPlugin.logInfo("Enhanced launch configuration for JUnit 6 with correct test kind");
        JUnitPlugin.logInfo("=============================================");
        
        return workingCopy;
    }
    
    /**
     * Verify that JUnit6TestLoader is accessible in the enhanced classpath.
     */
    private void verifyJUnit6TestLoaderAccessibility(final List<String> enhancedClasspath) {
        try {
            JUnitPlugin.logInfo("Verifying JUnit6TestLoader accessibility...");
            
            // Try to simulate class loading from the enhanced classpath
            for (final String entry : enhancedClasspath) {
                if (entry.contains("org.eclipse.jdt.junit6.runtime")) {
                    JUnitPlugin.logInfo("Found JUnit 6 runtime bundle: " + extractJarName(entry));
                    
                    // Try to check if the class exists in this JAR
                    final File jarFile = new File(entry);
                    if (jarFile.exists() && jarFile.getName().endsWith(".jar")) {
                        try {
                            final java.util.jar.JarFile jar = new java.util.jar.JarFile(jarFile);
                            final java.util.zip.ZipEntry loaderEntry = 
                                jar.getEntry("org/eclipse/jdt/internal/junit6/runner/JUnit6TestLoader.class");
                            if (loaderEntry != null) {
                                JUnitPlugin.logInfo("✓ JUnit6TestLoader.class found in: " + extractJarName(entry));
                                final long size = loaderEntry.getSize();
                                JUnitPlugin.logInfo("  Class size: " + size + " bytes");
                            } else {
                                JUnitPlugin.logInfo("✗ JUnit6TestLoader.class NOT found in: " + extractJarName(entry));
                            }
                            jar.close();
                        } catch (final Exception jarEx) {
                            JUnitPlugin.logInfo("Failed to inspect JAR " + extractJarName(entry) + 
                                ": " + jarEx.getMessage());
                        }
                    }
                    break; // Only check the first JUnit 6 runtime bundle
                }
            }
            
            // Also log class loading order information
            JUnitPlugin.logInfo("Enhanced classpath class loading order:");
            for (int i = 0; i < Math.min(5, enhancedClasspath.size()); i++) {
                final String entry = enhancedClasspath.get(i);
                JUnitPlugin.logInfo("  [" + i + "] " + extractJarName(entry) + 
                    (entry.contains("junit") ? " (JUnit-related)" : ""));
            }
            
        } catch (final Exception e) {
            JUnitPlugin.logInfo("Exception during JUnit6TestLoader verification: " + e.getMessage());
        }
    }

    /**
     * Get bundle state as string for logging.
     */
    private String getBundleStateString(int state) {
        switch (state) {
            case Bundle.UNINSTALLED: return "UNINSTALLED";
            case Bundle.INSTALLED: return "INSTALLED";
            case Bundle.RESOLVED: return "RESOLVED";
            case Bundle.STARTING: return "STARTING";
            case Bundle.STOPPING: return "STOPPING";
            case Bundle.ACTIVE: return "ACTIVE";
            default: return "UNKNOWN(" + state + ")";
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
}
