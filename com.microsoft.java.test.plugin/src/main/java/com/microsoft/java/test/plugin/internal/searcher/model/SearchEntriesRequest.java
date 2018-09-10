/*******************************************************************************
* Copyright (c) 2018 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.internal.searcher.model;

public class SearchEntriesRequest {
    private TestTreeNodeType nodeType;

    private String uri;

    private String fullName;

    public TestTreeNodeType getType() {
        return nodeType;
    }

    public void setType(TestTreeNodeType type) {
        this.nodeType = type;
    }

    public String getUri() {
        return uri;
    }

    public void setUri(String uri) {
        this.uri = uri;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }
}
