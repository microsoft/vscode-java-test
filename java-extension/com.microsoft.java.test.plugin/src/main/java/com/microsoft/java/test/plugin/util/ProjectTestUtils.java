/*******************************************************************************
* Copyright (c) 2017 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.util;

import com.google.gson.Gson;
import com.microsoft.java.test.plugin.model.Result;

import org.eclipse.core.resources.IContainer;
import org.eclipse.core.resources.IFolder;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.OperationCanceledException;
import org.eclipse.jdt.core.IClasspathAttribute;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.internal.core.ClasspathEntry;
import org.eclipse.jdt.ls.core.internal.JavaLanguageServerPlugin;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.jdt.ls.core.internal.ResourceUtils;
import org.eclipse.jdt.ls.core.internal.preferences.PreferenceManager;

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.eclipse.jdt.ls.core.internal.ProjectUtils.WORKSPACE_LINK;

@SuppressWarnings("restriction")
public final class ProjectTestUtils {

    private static final String TEST_SCOPE = "test";
    private static final String MAVEN_SCOPE_ATTRIBUTE = "maven.scope";
    private static final String GRADLE_SCOPE_ATTRIBUTE = "gradle_scope";

    /**
     * Method to get the valid paths which contains test code
     *
     * @param arguments Array of the workspace folder path
     * @param monitor
     * @throws URISyntaxException
     * @throws JavaModelException
     */
    @SuppressWarnings("unchecked")
    public static List<SourcePathInfo> listTestSourcePaths(List<Object> arguments, IProgressMonitor monitor)
            throws JavaModelException {
        final List<SourcePathInfo> testSourcePathList = new ArrayList<>();
        if (arguments == null || arguments.size() == 0) {
            return testSourcePathList;
        }

        final ArrayList<String> uriArray = ((ArrayList<String>) arguments.get(0));
        for (final String uri : uriArray) {
            final Set<IJavaProject> projectSet = parseProjects(uri);
            for (final IJavaProject javaProject : projectSet) {
                final IProject project = javaProject.getProject();
                final String projectName = project.getName();
                String projectType = "General";
                if (ProjectUtils.isMavenProject(project)) {
                    projectType = "Maven";
                }

                if (ProjectUtils.isGradleProject(project)) {
                    projectType = "Gradle";
                }

                IContainer projectRoot = project;
                if (!ProjectUtils.isVisibleProject(project)) {
                    projectType = "Workspace";
                    final IFolder workspaceLinkFolder = project.getFolder(ProjectUtils.WORKSPACE_LINK);
                    if (!workspaceLinkFolder.isLinked()) {
                        continue;
                    }

                    projectRoot = workspaceLinkFolder;
                }
                for (final IPath path : ProjectUtils.listSourcePaths(javaProject)) {
                    final IPath relativePath = path.makeRelativeTo(projectRoot.getFullPath());
                    final IPath location = projectRoot.getRawLocation().append(relativePath);
                    final IPath displayPath = getWorkspacePath(location);
                    testSourcePathList.add(new SourcePathInfo(location.toOSString(), displayPath.toOSString(),
                            isTest(javaProject, path), projectName, projectType));
                }
            }
        }
        return testSourcePathList;
    }

    public static Result updateTestSourcePaths(List<Object> arguments, IProgressMonitor monitor) {
        if (arguments == null || arguments.size() == 0) {
            throw new IllegalArgumentException("The test path input is empty");
        }

        try {
            final Gson gson = new Gson();
            final SourcePathInfo[] pathInfos = gson.fromJson((String) arguments.get(0), SourcePathInfo[].class);
            for (final SourcePathInfo pathInfo : pathInfos) {
                final IPath sourceFolderPath = ResourceUtils.filePathFromURI(pathInfo.path);
                IProject targetProject = findBelongedProject(sourceFolderPath);
                IPath projectLocation = null;
                IContainer projectRootResource = null;
                if (targetProject == null) {
                    final IPath workspaceRoot = ProjectUtils.findBelongedWorkspaceRoot(sourceFolderPath);
                    if (workspaceRoot == null) {
                        return new Result(false, 
                                "Cannot find belonged workspace for source path: " + sourceFolderPath.toOSString());
                    }

                    targetProject = ProjectUtils.createInvisibleProjectIfNotExist(workspaceRoot);
                    final IFolder workspaceLink = targetProject.getFolder(ProjectUtils.WORKSPACE_LINK);
                    projectLocation = workspaceRoot;
                    projectRootResource = workspaceLink;
                } else {
                    projectLocation = targetProject.getLocation();
                    projectRootResource = targetProject;
                }

                final IPath relativeSourcePath = sourceFolderPath.makeRelativeTo(projectLocation);
                final IPath sourcePath = relativeSourcePath.isEmpty() ? projectRootResource.getFullPath() :
                        projectRootResource.getFolder(relativeSourcePath).getFullPath();
                final IJavaProject javaProject = JavaCore.create(targetProject);
                final IClasspathEntry[] clonedEntries = javaProject.getRawClasspath().clone();
                for (int i = 0; i < clonedEntries.length; i++) {
                    if (clonedEntries[i].getEntryKind() != IClasspathEntry.CPE_SOURCE) {
                        continue;
                    }
                    if (clonedEntries[i].getPath().equals(sourcePath)) {
                        clonedEntries[i] = updateTestAttributes(clonedEntries[i], pathInfo.isTest);
                        break;
                    }
                }
                javaProject.setRawClasspath(clonedEntries, monitor);
            }

            return new Result(true, "");
        } catch (final OperationCanceledException | CoreException ex) {
            return new Result(false, ex.getMessage());
        }
    }

    public static Set<IJavaProject> parseProjects(String uriStr) {
        final IPath parentPath = ResourceUtils.filePathFromURI(uriStr);
        if (parentPath == null) {
            return Collections.emptySet();
        }
        return Arrays.stream(ProjectUtils.getJavaProjects())
                .filter(p -> belongToProject(parentPath, p.getProject()))
                .collect(Collectors.toSet());
    }

    public static List<IPath> getTestPath(IJavaProject project) throws JavaModelException {
        final IClasspathEntry[] entries = project.getRawClasspath();
        return Arrays.stream(entries)
                .filter(entry -> isTest(entry))
                .map(entry -> entry.getPath())
                .collect(Collectors.toList());
    }

    public static Set<IPath> getTestOutputPath(IJavaProject project) throws JavaModelException {
        final IClasspathEntry[] entries = project.getRawClasspath();
        final IPath projectLocation = project.getProject().getLocation();
        return Arrays.stream(entries)
                .filter(entry -> isTest(entry))
                .map(entry -> {
                    final IPath outputLocation = entry.getOutputLocation();
                    if (outputLocation == null) {
                        return null;
                    }
                    final IPath relativePath = outputLocation.makeRelativeTo(project.getPath());
                    return projectLocation.append(relativePath);
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    public static boolean isTest(IJavaProject project, IPath path) {
        try {
            final IClasspathEntry entry = project.getClasspathEntryFor(path);
            if (entry == null) {
                return false;
            }
            return isTest(entry);
        } catch (final JavaModelException e) {
            return false;
        }
    }

    public static boolean isTest(IClasspathEntry entry) {
        if (entry.getEntryKind() != ClasspathEntry.CPE_SOURCE) {
            return false;
        }

        for (final IClasspathAttribute attribute : entry.getExtraAttributes()) {
            if (MAVEN_SCOPE_ATTRIBUTE.equals(attribute.getName()) ||
                    GRADLE_SCOPE_ATTRIBUTE.equals(attribute.getName())) {
                return TEST_SCOPE.equals(attribute.getValue());
            }
            if (TEST_SCOPE.equals(attribute.getName())) {
                return "true".equalsIgnoreCase(attribute.getValue());
            }
        }

        return entry.isTest();
    }

    public static boolean belongToProject(IPath testPath, IProject project) {
        // Check if the path belongs to visible project
        if (project.getLocation() != null && project.getLocation().isPrefixOf(testPath)) {
            return true;
        }


        // Check if the path belongs to invisible project
        final IPath linkedLocation = project.getFolder(WORKSPACE_LINK).getLocation();
        if (linkedLocation != null && linkedLocation.isPrefixOf(testPath)) {
            return true;
        }

        return false;
    }

    private static IProject findBelongedProject(IPath sourceFolder) {
        final List<IProject> projects = Stream.of(ProjectUtils.getAllProjects())
                .filter(ProjectUtils::isJavaProject)
                .sorted(new Comparator<IProject>() {
                    @Override
                    public int compare(IProject p1, IProject p2) {
                        return p2.getLocation().toOSString().length() - p1.getLocation().toOSString().length();
                    }
                })
                .collect(Collectors.toList());

        for (final IProject project : projects) {
            if (project.getLocation().isPrefixOf(sourceFolder)) {
                return project;
            }
        }

        return null;
    }

    private static IClasspathEntry updateTestAttributes(IClasspathEntry entry, boolean isTest) {
        final List<IClasspathAttribute> extraAttributes = new LinkedList<>();
        for (final IClasspathAttribute attribute : entry.getExtraAttributes()) {
            if (!TEST_SCOPE.equals(attribute.getName())) {
                extraAttributes.add(attribute);
            }
        }
        if (isTest) {
            extraAttributes.add(JavaCore.newClasspathAttribute(TEST_SCOPE, String.valueOf(true)));
        }
        return JavaCore.newSourceEntry(entry.getPath(), entry.getInclusionPatterns(), entry.getExclusionPatterns(),
                entry.getOutputLocation(), extraAttributes.toArray(new IClasspathAttribute[0]));
    }

    private static IPath getWorkspacePath(IPath path) {
        final PreferenceManager manager = JavaLanguageServerPlugin.getPreferencesManager();
        final Collection<IPath> rootPaths = manager.getPreferences().getRootPaths();
        if (rootPaths != null) {
            for (final IPath rootPath : rootPaths) {
                if (rootPath.isPrefixOf(path)) {
                    return path.makeRelativeTo(rootPath.append(".."));
                }
            }
        }

        return path;
    }

    public static class SourcePathInfo  {
        public String path;
        public String displayPath;
        public boolean isTest;
        public String projectName;
        public String projectType;

        SourcePathInfo(String path, String displayPath, boolean isTest, String projectName, String projectType) {
            this.path = path;
            this.displayPath = displayPath;
            this.isTest = isTest;
            this.projectName = projectName;
            this.projectType = projectType;
        }
    }

}
