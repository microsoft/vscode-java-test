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
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.List;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.junit.Test;

import com.microsoft.java.test.plugin.AbstractProjectsManagerBasedTest;
import com.microsoft.java.test.plugin.model.Response;

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
}
