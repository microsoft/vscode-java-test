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

import java.io.File;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

import javax.management.RuntimeErrorException;

import com.google.gson.Gson;
import com.microsoft.java.test.plugin.launchers.JUnitLaunchConfigurationDelegate.JUnitLaunchArguments;
import com.microsoft.java.test.plugin.model.TestKind;

import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringEscapeUtils;
import org.apache.commons.lang3.StringUtils;
import org.eclipse.core.resources.IContainer;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;

/**
 * JUnitLauncherUtils
 */
public class JUnitLaunchUtils {

    private JUnitLaunchUtils() {}

    public static JUnitLaunchArguments resolveLaunchArgument(List<Object> arguments, IProgressMonitor monitor) throws URISyntaxException, CoreException {
        final Gson gson = new Gson();
        final Argument args = gson.fromJson((String) arguments.get(0), Argument.class);

        TestInfo info = new TestInfo();
        // Only support JUnit 4 for now
        info.testKind = "org.eclipse.jdt.junit.loader.junit4";

        if (args.runFromRoot) {
            parseConfigurationInfoForContainer(info, args);
        } else {
            File file = Paths.get(new URI(args.uri)).toFile();
            if (file.isFile()) {
                parseConfigurationInfoForClass(info, args);
            } else if (file.isDirectory()) {
                parseConfigurationInfoForContainer(info, args);
            } else {
                throw new RuntimeException("The resource: " + file.getPath() + " is not testable.");
            }
        }

        ILaunchConfiguration configuration = new JUnitLaunchConfiguration("JUnit Launch Configuration", info);
		JUnitLaunchConfigurationDelegate delegate = new JUnitLaunchConfigurationDelegate();
		return delegate.getJUnitLaunchArguments(configuration, "run", monitor);
    }

    private static void parseConfigurationInfoForClass(TestInfo info, Argument args) throws JavaModelException {
        ICompilationUnit cu = JDTUtils.resolveCompilationUnit(args.uri);
            if (cu == null) {
                throw new RuntimeException("Cannot resolve compilation unit from: " + args.uri);
            }

            for (IType type : cu.getAllTypes()) {
                if (type.getFullyQualifiedName().equals(args.classFullName)) {
                    info.mainType = args.classFullName;
                    // TODO: validate test name
                    info.testName = StringUtils.isEmpty(args.testName) ? "" : args.testName;
                    info.project = type.getJavaProject().getProject();
                    break;
                }
            }

            if (info.mainType == null) {
                throw new RuntimeException("Failed to find class '" + args.classFullName + "'");
            }
    }

    private static void parseConfigurationInfoForContainer(TestInfo info, Argument args) throws URISyntaxException {
        IContainer[] targetContainers = ResourcesPlugin.getWorkspace().getRoot().findContainersForLocationURI(new URI(args.uri));
			if (targetContainers == null || targetContainers.length == 0) {
				throw new RuntimeException("Cannot find resource containers from: " + args.uri);
			}

			// For multi-module scenario, findContainersForLocationURI API may return a container array, need put the result from the nearest project in front.
			Arrays.sort(targetContainers, (Comparator<IContainer>) (IContainer a, IContainer b) -> {
				return a.getFullPath().toPortableString().length() - b.getFullPath().toPortableString().length();
			});

			IJavaElement targetElement = null;
			for (IContainer container : targetContainers) {
				targetElement = JavaCore.create(container);
				if (targetElement != null) {
                    IJavaProject javaProject = targetElement.getJavaProject();
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

    class Argument {
        public String uri;
        public String classFullName;
        public String testName;
        public boolean runFromRoot;
    }
}