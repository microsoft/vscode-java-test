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

/**
 * public for testing purpose.
 */
public class JUnitLaunchArguments {
    public String workingDirectory;
    public String mainClass;
    public String projectName;
    public String[] classpath;
    public String[] modulepath;
    public String[] vmArguments;
    public String[] programArguments;
}
