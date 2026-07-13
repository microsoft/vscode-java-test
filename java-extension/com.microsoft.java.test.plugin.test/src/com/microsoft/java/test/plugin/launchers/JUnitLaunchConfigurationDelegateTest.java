/*******************************************************************************
* Copyright (c) 2023 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.launchers;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaCore;
import org.junit.Test;

import com.microsoft.java.test.plugin.AbstractProjectsManagerBasedTest;
import com.microsoft.java.test.plugin.model.Response;
import com.google.gson.Gson;

public class JUnitLaunchConfigurationDelegateTest extends AbstractProjectsManagerBasedTest {
	
    @Test
    public void testWorkingDirectoryForTestNgUnmanagedFolder() throws Exception {
        IProject invisibleProject = copyAndImportFolder("simple", "src/App.java");
        assertTrue(invisibleProject.exists());

        List<Object> arguments = Arrays.asList("{\"projectName\":\"" + invisibleProject.getName()
                + "\",\"testLevel\":5,\"testKind\":2,\"testNames\":[\"App\"]}");

        Response<JUnitLaunchArguments> response = JUnitLaunchUtils.resolveLaunchArgument(arguments, new NullProgressMonitor());

        assertEquals(0, response.getStatus());
        assertTrue(response.getBody().workingDirectory.endsWith("simple"));
    }

    @Test
    public void testAddOpensForAllSelectedPackagesInModularProject() throws Exception {
        final IProject project = importProjects("modular-junit").get(0);
        final IJavaProject javaProject = JavaCore.create(project);
        final IType firstTest = javaProject.findType("p1.FirstTest");
        final IType secondTest = javaProject.findType("p2.SecondTest");
        assertNotNull(firstTest);
        assertNotNull(secondTest);

        final Map<String, Object> request = new LinkedHashMap<>();
        request.put("projectName", javaProject.getElementName());
        request.put("testLevel", 5);
        request.put("testKind", 0);
        request.put("testNames", Arrays.asList(
                firstTest.getFullyQualifiedName(), secondTest.getFullyQualifiedName()));
        request.put("testHandles", Arrays.asList(
                firstTest.getHandleIdentifier(), secondTest.getHandleIdentifier()));

        final Response<JUnitLaunchArguments> response = JUnitLaunchUtils.resolveLaunchArgument(
                Arrays.asList(new Gson().toJson(request)), new NullProgressMonitor());

        assertEquals(0, response.getStatus());
        final List<String> vmArguments = Arrays.asList(response.getBody().vmArguments);
        final String firstPackagePrefix = "com.example.modular/p1=";
        final String firstPackageOpen = vmArguments.stream()
                .filter(argument -> argument.startsWith(firstPackagePrefix))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Missing --add-opens for p1"));
        final String targets = firstPackageOpen.substring(firstPackagePrefix.length());
        final String secondPackageOpen = "com.example.modular/p2=" + targets;
        assertEquals("--add-opens", vmArguments.get(vmArguments.indexOf(firstPackageOpen) - 1));
        assertTrue(vmArguments.contains(secondPackageOpen));
        assertEquals("--add-opens", vmArguments.get(vmArguments.indexOf(secondPackageOpen) - 1));
    }

}
