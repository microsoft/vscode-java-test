/*******************************************************************************
 * Copyright (c) 2016-2019 Red Hat Inc. and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License 2.0
 * which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *     Red Hat Inc. - initial API and implementation
 *******************************************************************************/
package com.microsoft.java.test.plugin;

import static org.junit.Assert.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Hashtable;
import java.util.List;

import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.StringUtils;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IWorkspaceRunnable;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.core.runtime.Path;
import org.eclipse.core.runtime.jobs.Job;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.formatter.DefaultCodeFormatterConstants;
import org.eclipse.jdt.core.manipulation.CoreASTProvider;
import org.eclipse.jdt.ls.core.internal.JavaLanguageServerPlugin;
import org.eclipse.jdt.ls.core.internal.JobHelpers;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.jdt.ls.core.internal.managers.StandardProjectsManager;
import org.eclipse.jdt.ls.core.internal.preferences.ClientPreferences;
import org.eclipse.jdt.ls.core.internal.preferences.PreferenceManager;
import org.eclipse.jdt.ls.core.internal.preferences.Preferences;
import org.eclipse.jdt.ls.core.internal.preferences.StandardPreferenceManager;
import org.junit.After;
import org.junit.Before;
import org.mockito.Mock;
import org.mockito.Mockito;

/**
 * @author Fred Bricon
 *
 */
public abstract class AbstractProjectsManagerBasedTest {

	public static final String TEST_PROJECT_NAME = "TestProject";

	protected StandardProjectsManager projectsManager;
	@Mock
	protected PreferenceManager preferenceManager;

	private PreferenceManager oldPreferenceManager;

	protected Preferences preferences;

	@Before
	public void initProjectManager() throws Exception {
		preferences = new Preferences();
		initPreferences(preferences);
		if (preferenceManager == null) {
			preferenceManager = mock(StandardPreferenceManager.class);
		}
		initPreferenceManager(true);

		oldPreferenceManager = JavaLanguageServerPlugin.getPreferencesManager();
		JavaLanguageServerPlugin.setPreferencesManager(preferenceManager);
		projectsManager = new StandardProjectsManager(preferenceManager);
	}

	protected void initPreferences(Preferences preferences) throws IOException {
		preferences.setRootPaths(Collections.singleton(new Path(getWorkingProjectDirectory().getAbsolutePath())));
		preferences.setCodeGenerationTemplateGenerateComments(true);
		preferences.setMavenDownloadSources(true);
		preferences.setJavaQuickFixShowAt("problem");
	}

	protected ClientPreferences initPreferenceManager(boolean supportClassFileContents) {
		StandardPreferenceManager.initialize();
		Hashtable<String, String> javaCoreOptions = JavaCore.getOptions();
		javaCoreOptions.put(DefaultCodeFormatterConstants.FORMATTER_TAB_CHAR, JavaCore.TAB);
		javaCoreOptions.put(DefaultCodeFormatterConstants.FORMATTER_TAB_SIZE, "4");
		JavaCore.setOptions(javaCoreOptions);
		Mockito.lenient().when(preferenceManager.getPreferences()).thenReturn(preferences);
		Mockito.lenient().when(preferenceManager.getPreferences(any())).thenReturn(preferences);
		Mockito.lenient().when(preferenceManager.isClientSupportsClassFileContent()).thenReturn(supportClassFileContents);
		ClientPreferences clientPreferences = mock(ClientPreferences.class);
		Mockito.lenient().when(clientPreferences.isProgressReportSupported()).thenReturn(true);
		Mockito.lenient().when(preferenceManager.getClientPreferences()).thenReturn(clientPreferences);
		Mockito.lenient().when(clientPreferences.isSupportedCodeActionKind(anyString())).thenReturn(true);
		Mockito.lenient().when(clientPreferences.isOverrideMethodsPromptSupported()).thenReturn(true);
		Mockito.lenient().when(clientPreferences.isHashCodeEqualsPromptSupported()).thenReturn(true);
		Mockito.lenient().when(clientPreferences.isGenerateToStringPromptSupported()).thenReturn(true);
		Mockito.lenient().when(clientPreferences.isAdvancedGenerateAccessorsSupported()).thenReturn(true);
		Mockito.lenient().when(clientPreferences.isGenerateConstructorsPromptSupported()).thenReturn(true);
		Mockito.lenient().when(clientPreferences.isGenerateDelegateMethodsPromptSupported()).thenReturn(true);
		return clientPreferences;
	}
	
	protected IProject copyAndImportFolder(String folder, String triggerFile) throws Exception {
		File projectFolder = copyFiles(folder, true);
		return importRootFolder(projectFolder, triggerFile);
	}
	
	protected IProject importRootFolder(IPath rootPath, String triggerFile) throws Exception {
		if (StringUtils.isNotBlank(triggerFile)) {
			IPath triggerFilePath = rootPath.append(triggerFile);
			Preferences preferences = preferenceManager.getPreferences();
			preferences.setTriggerFiles(Arrays.asList(triggerFilePath));
		}
		final List<IPath> roots = Arrays.asList(rootPath);
		IWorkspaceRunnable runnable = new IWorkspaceRunnable() {
			@Override
			public void run(IProgressMonitor monitor) throws CoreException {
				projectsManager.initializeProjects(roots, monitor);
			}
		};
		JavaCore.run(runnable, null, new NullProgressMonitor());
		waitForBackgroundJobs();
		String invisibleProjectName = ProjectUtils.getWorkspaceInvisibleProjectName(rootPath);
		return ResourcesPlugin.getWorkspace().getRoot().getProject(invisibleProjectName);
	}
	
	protected IProject importRootFolder(File projectFolder, String triggerFile) throws Exception {
		IPath rootPath = Path.fromOSString(projectFolder.getAbsolutePath());
		return importRootFolder(rootPath, triggerFile);
	}

	protected List<IProject> importProjects(String path) throws Exception {
		return importProjects(Collections.singleton(path));
	}

	protected List<IProject> importExistingProjects(String path) throws Exception {
		return importProjects(Collections.singleton(path), false);
	}

	protected List<IProject> importProjects(Collection<String> paths) throws Exception {
		return importProjects(paths, true);
	}

	protected List<IProject> importProjects(Collection<String> paths, boolean deleteExistingFiles) throws Exception {
		final List<IPath> roots = new ArrayList<>();
		for (String path : paths) {
			File file = copyFiles(path, deleteExistingFiles);
			roots.add(Path.fromOSString(file.getAbsolutePath()));
		}
		waitForBackgroundJobs();
		IWorkspaceRunnable runnable = new IWorkspaceRunnable() {
			@Override
			public void run(IProgressMonitor monitor) throws CoreException {
				projectsManager.initializeProjects(roots, monitor);
			}
		};
		JavaCore.run(runnable, null, new NullProgressMonitor());
		waitForBackgroundJobs();
		return WorkspaceHelper.getAllProjects();
	}

	protected void waitForBackgroundJobs() throws Exception {
		JobHelpers.waitForJobsToComplete(new NullProgressMonitor());
		Job.getJobManager().join("org.eclipse.buildship.core.jobs", new NullProgressMonitor());
		JobHelpers.waitUntilIndexesReady();
	}

	protected File getSourceProjectDirectory() {
		return new File("projects");
	}

	protected File getWorkingProjectDirectory() throws IOException {
		File dir = new File("target", "workingProjects");
		FileUtils.forceMkdir(dir);
		return dir;
	}

	@After
	public void cleanUp() throws Exception {
		JavaLanguageServerPlugin.setPreferencesManager(oldPreferenceManager);
		projectsManager = null;
		Job.getJobManager().setProgressProvider(null);
		try {
			waitForBackgroundJobs();
		} catch (Exception e) {
			JavaLanguageServerPlugin.logException(e);
		}
		WorkspaceHelper.deleteAllProjects();
		try {
			waitForBackgroundJobs();
		} catch (Exception e) {
			JavaLanguageServerPlugin.logException(e);
		}
		File workspaceDir = new File("target", "workingProjects");
		try {
			// https://github.com/eclipse/eclipse.jdt.ls/issues/996
			FileUtils.forceDelete(workspaceDir);
		} catch (IOException e) {
			JavaLanguageServerPlugin.logException(e);
			workspaceDir.deleteOnExit();
		}
		assertFalse(workspaceDir.exists());
		try {
			waitForBackgroundJobs();
		} catch (Exception e) {
			JavaLanguageServerPlugin.logException(e);
		}
		ResourcesPlugin.getWorkspace().save(true/*full save*/, null/*no progress*/);
		CoreASTProvider.getInstance().disposeAST();
	}

	protected File copyFiles(String path, boolean reimportIfExists) throws IOException {
		File from = new File(getSourceProjectDirectory(), path);
		File to = new File(getWorkingProjectDirectory(), path);
		if (to.exists()) {
			if (!reimportIfExists) {
				return to;
			}
			FileUtils.forceDelete(to);
		}

		if (from.isDirectory()) {
			FileUtils.copyDirectory(from, to);
		} else {
			FileUtils.copyFile(from, to);
		}

		return to;
	}

}
