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

package com.microsoft.java.test.plugin.model;

import org.eclipse.lsp4j.Range;

import java.util.ArrayList;
import java.util.List;

public class TestItem extends Location {
    private String displayName;

    private String fullName;

    private List<TestItem> children;

    private TestLevel level;

    private TestKind kind;

    private String project;

    private List<String> paramTypes;

    public TestItem(String displayName, String fullName, String uri, String project, List<String> paramTypes,
            Range range, TestLevel level, TestKind kind) {
        super(uri, range);
        this.displayName = displayName;
        this.fullName = fullName;
        this.level = level;
        this.kind = kind;
        this.project = project;
        this.paramTypes = paramTypes;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getUri() {
        return uri;
    }

    public void setUri(String uri) {
        this.uri = uri;
    }

    public Range getRange() {
        return range;
    }

    public void setRange(Range range) {
        this.range = range;
    }

    public List<TestItem> getChildren() {
        return children;
    }

    public void setChildren(List<TestItem> children) {
        this.children = children;
    }

    public TestLevel getLevel() {
        return level;
    }

    public void setLevel(TestLevel level) {
        this.level = level;
    }

    public TestKind getKind() {
        return kind;
    }

    public void setKind(TestKind kind) {
        this.kind = kind;
    }

    public String getProject() {
        return project;
    }

    public void setProject(String project) {
        this.project = project;
    }

    public void addChild(TestItem child) {
        if (this.children == null) {
            this.children = new ArrayList<>();
        }
        this.children.add(child);
    }

    public List<String> getParamTypes() {
        return paramTypes;
    }

    public void setParamTypes(List<String> paramTypes) {
        this.paramTypes = paramTypes;
    }
}
