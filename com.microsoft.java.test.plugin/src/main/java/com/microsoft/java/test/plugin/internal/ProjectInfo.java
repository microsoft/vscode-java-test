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
package com.microsoft.java.test.plugin.internal;

import java.net.URI;

public class ProjectInfo {
    private URI path;
    private String name;
    public URI getPath() {
        return path;
    }
    public void setPath(URI path) {
        this.path = path;
    }
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
    
    public ProjectInfo(URI path, String name) {
        this.path = path;
        this.name = name;
    }
}
