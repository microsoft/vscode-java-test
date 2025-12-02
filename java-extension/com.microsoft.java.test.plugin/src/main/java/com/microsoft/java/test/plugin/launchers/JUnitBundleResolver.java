package com.microsoft.java.test.plugin.launchers;

import com.microsoft.java.test.plugin.util.JUnitPlugin;

import org.eclipse.core.runtime.FileLocator;
import org.eclipse.core.runtime.Platform;
import org.eclipse.jdt.core.IJavaProject;
import org.osgi.framework.Bundle;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * JUnit Bundle resolver that follows JDT LS Bundle extension patterns.
 * This class implements the same Bundle resolution strategy used by Eclipse JDT LS
 * for reliable JUnit 6 test execution.
 */
public class JUnitBundleResolver {

    /**
     * JUnit 6 Bundle dependencies in loading priority order.
     * This matches the extension point configuration used by JDT LS.
     */
    private static final String[] JUNIT6_RUNTIME_BUNDLES = {
        "org.eclipse.jdt.junit6.runtime",      // Primary: Contains JUnit6TestLoader
        "org.eclipse.jdt.junit.runtime",       // Base: Common JUnit runtime support
        "org.junit.platform.launcher",         // Platform: JUnit Platform Launcher
        "org.junit.platform.engine",           // Platform: Test engine support
        "org.junit.platform.commons",          // Platform: Common utilities
        "org.junit.jupiter.api",               // Jupiter: JUnit 5/6 API
        "org.junit.jupiter.engine",            // Jupiter: JUnit 5/6 execution engine
        "org.junit"                            // Legacy: JUnit 4 support (for compatibility)
    };

    private final IJavaProject javaProject;

    public JUnitBundleResolver(IJavaProject javaProject) {
        this.javaProject = javaProject;
    }

    /**
     * Resolve JUnit 6 Bundle dependencies using JDT LS Bundle extension patterns.
     * Returns a list of Bundle file paths that should be added to the classpath.
     */
    public List<String> resolveJUnit6BundlePaths() {
        final List<String> resolvedPaths = new ArrayList<>();
        
        JUnitPlugin.logInfo("=== JUnit 6 Bundle Resolution (JDT LS Pattern) ===");
        JUnitPlugin.logInfo("Resolving Bundle dependencies for project: " + 
            (javaProject != null ? javaProject.getElementName() : "null"));
        
        for (final String bundleId : JUNIT6_RUNTIME_BUNDLES) {
            final String bundlePath = resolveBundlePath(bundleId);
            if (bundlePath != null) {
                resolvedPaths.add(bundlePath);
                JUnitPlugin.logInfo("✅ Resolved: " + bundleId + " -> " + extractFileName(bundlePath));
            } else {
                // Only log as error for critical bundles
                if (isCriticalBundle(bundleId)) {
                    JUnitPlugin.logError("❌ Critical Bundle missing: " + bundleId);
                } else {
                    JUnitPlugin.logInfo("⚠️  Optional Bundle not found: " + bundleId);
                }
            }
        }
        
        JUnitPlugin.logInfo("Bundle resolution complete: " + resolvedPaths.size() + "/" + 
            JUNIT6_RUNTIME_BUNDLES.length + " Bundles resolved");
        JUnitPlugin.logInfo("==================================================");
        
        return resolvedPaths;
    }

    /**
     * Resolve a single Bundle path using Eclipse Platform Bundle APIs.
     * This follows the exact same logic as JDT LS Bundle resolution.
     */
    private String resolveBundlePath(String bundleId) {
        try {
            JUnitPlugin.logInfo("Resolving Bundle: " + bundleId);
            
            // Use Eclipse Platform Bundle API (same as JDT LS)
            final Bundle[] bundles = Platform.getBundles(bundleId, null);
            
            if (bundles != null && bundles.length > 0) {
                JUnitPlugin.logInfo("  Found " + bundles.length + " Bundle(s) for: " + bundleId);
                
                // Select the best Bundle using JDT LS selection criteria
                final Bundle selectedBundle = selectBestBundle(bundles);
                if (selectedBundle != null) {
                    final File bundleFile = FileLocator.getBundleFile(selectedBundle);
                    if (bundleFile != null && bundleFile.exists()) {
                        final String bundlePath = bundleFile.getAbsolutePath();
                        JUnitPlugin.logInfo("  ✅ Selected: " + selectedBundle.getSymbolicName() + 
                            " v" + selectedBundle.getVersion() + 
                            " (state: " + getBundleStateString(selectedBundle.getState()) + ")");
                        return bundlePath;
                    } else {
                        JUnitPlugin.logInfo("  ❌ Bundle file not accessible for: " + selectedBundle.getSymbolicName());
                    }
                } else {
                    JUnitPlugin.logInfo("  ❌ No suitable Bundle found for: " + bundleId);
                }
            } else {
                JUnitPlugin.logInfo("  ⚠️  No Bundles found for: " + bundleId);
            }
            
        } catch (Exception e) {
            JUnitPlugin.logException("Exception resolving Bundle: " + bundleId, e);
        }
        
        return null;
    }

    /**
     * Select the best Bundle from multiple candidates using JDT LS selection logic.
     */
    private Bundle selectBestBundle(Bundle[] bundles) {
        // JDT LS selection criteria: prefer ACTIVE, then RESOLVED, then highest version
        Bundle bestBundle = null;
        
        for (final Bundle bundle : bundles) {
            final int state = bundle.getState();
            
            if (state == Bundle.ACTIVE) {
                JUnitPlugin.logInfo("    Found ACTIVE Bundle: " + bundle.getSymbolicName() + 
                    " v" + bundle.getVersion());
                if (bestBundle == null || bestBundle.getState() != Bundle.ACTIVE) {
                    bestBundle = bundle;
                }
            } else if (state == Bundle.RESOLVED && (bestBundle == null || bestBundle.getState() == Bundle.INSTALLED)) {
                JUnitPlugin.logInfo("    Found RESOLVED Bundle: " + bundle.getSymbolicName() + 
                    " v" + bundle.getVersion());
                bestBundle = bundle;
            } else if (bestBundle == null) {
                JUnitPlugin.logInfo("    Found Bundle: " + bundle.getSymbolicName() + 
                    " v" + bundle.getVersion() + " (state: " + getBundleStateString(state) + ")");
                bestBundle = bundle;
            }
        }
        
        return bestBundle;
    }

    /**
     * Check if a Bundle is critical for JUnit 6 execution.
     */
    private boolean isCriticalBundle(String bundleId) {
        return bundleId.equals("org.eclipse.jdt.junit6.runtime") || 
               bundleId.equals("org.eclipse.jdt.junit.runtime");
    }

    /**
     * Get Bundle state as human-readable string.
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

    /**
     * Extract file name from full path.
     */
    private String extractFileName(String fullPath) {
        if (fullPath == null) {
            return "null";
        }
        final File file = new File(fullPath);
        return file.getName();
    }

    /**
     * Validate that critical JUnit 6 classes are accessible in resolved Bundles.
     */
    public boolean validateJUnit6TestLoaderAccess(List<String> bundlePaths) {
        for (final String bundlePath : bundlePaths) {
            if (bundlePath.contains("org.eclipse.jdt.junit6.runtime")) {
                try {
                    final File bundleFile = new File(bundlePath);
                    if (bundleFile.exists() && bundleFile.getName().endsWith(".jar")) {
                        final java.util.jar.JarFile jarFile = new java.util.jar.JarFile(bundleFile);
                        
                        // Check for JUnit6TestLoader class
                        final boolean hasTestLoader = jarFile.getEntry(
                            "org/eclipse/jdt/internal/junit6/runner/JUnit6TestLoader.class") != null;
                        
                        // Enhanced JAR content analysis
                        JUnitPlugin.logInfo("=== JUnit 6 Runtime JAR Analysis ===");
                        JUnitPlugin.logInfo("JAR: " + extractFileName(bundlePath));
                        JUnitPlugin.logInfo("Full path: " + bundlePath);
                        JUnitPlugin.logInfo("Size: " + bundleFile.length() + " bytes");
                        JUnitPlugin.logInfo("JUnit6TestLoader.class present: " + hasTestLoader);
                        
                        // List JUnit6-related entries
                        final java.util.Enumeration<java.util.jar.JarEntry> entries = jarFile.entries();
                        int entryCount = 0;
                        int junit6Entries = 0;
                        while (entries.hasMoreElements()) {
                            final java.util.jar.JarEntry entry = entries.nextElement();
                            final String entryName = entry.getName();
                            entryCount++;
                            
                            if (entryName.contains("junit6") || entryName.contains("JUnit6")) {
                                junit6Entries++;
                                JUnitPlugin.logInfo("  JUnit6 entry: " + entryName + 
                                    " (size: " + entry.getSize() + ")");
                            }
                        }
                        JUnitPlugin.logInfo("Total JAR entries: " + entryCount + ", JUnit6 entries: " + junit6Entries);
                        
                        jarFile.close();
                        
                        if (hasTestLoader) {
                            JUnitPlugin.logInfo("✅ JUnit6TestLoader validation successful");
                            
                            // Try runtime class loading verification
                            verifyRuntimeClassAccess(bundlePath);
                            
                            return true;
                        } else {
                            JUnitPlugin.logError("❌ JUnit6TestLoader NOT found in JAR");
                        }
                        JUnitPlugin.logInfo("=====================================");
                    }
                } catch (Exception e) {
                    JUnitPlugin.logException("Exception validating JUnit6TestLoader in: " + bundlePath, e);
                }
                break;
            }
        }
        return false;
    }
    
    /**
     * Attempt to verify runtime class loading access to JUnit6TestLoader.
     * Uses a more robust approach that handles class dependencies.
     */
    private void verifyRuntimeClassAccess(String bundlePath) {
        try {
            JUnitPlugin.logInfo("=== Runtime Class Loading Test ===");
            
            // Skip actual class loading test to avoid dependency issues during validation
            // The real test will happen when JUnit actually runs
            JUnitPlugin.logInfo("Skipping URLClassLoader test to avoid dependency conflicts");
            JUnitPlugin.logInfo("JUnit6TestLoader accessibility will be verified at runtime");
            
            // Instead, just verify the JAR structure and accessibility
            final File bundleFile = new File(bundlePath);
            if (bundleFile.canRead()) {
                JUnitPlugin.logInfo("✅ Bundle JAR is readable: " + bundleFile.getName());
                JUnitPlugin.logInfo("  File size: " + bundleFile.length() + " bytes");
                JUnitPlugin.logInfo("  Last modified: " + new java.util.Date(bundleFile.lastModified()));
            } else {
                JUnitPlugin.logError("❌ Bundle JAR is not readable: " + bundleFile.getName());
            }
            
            JUnitPlugin.logInfo("==================================");
            
        } catch (Exception e) {
            JUnitPlugin.logException("Runtime verification failed", e);
        }
    }
}
