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

import org.eclipse.lsp4j.Location;
import org.eclipse.lsp4j.Range;

import java.util.ArrayList;
import java.util.List;

public class TestItem {
    private String id;

    private String displayName;

    private String fullName;

    private List<String> children;

    private TestLevel level;

    private TestKind kind;

    private String project;

    private Location location;

    public TestItem(String displayName, String fullName, String uri, String project,
            Range range, TestLevel level, TestKind kind) {
        this.displayName = displayName;
        this.fullName = fullName;
        this.level = level;
        this.kind = kind;
        this.project = project;
        this.location = new Location(uri, range);
        this.id = project + "@" + fullName;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
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

    public List<String> getChildren() {
        return children;
    }

    public void setChildren(List<String> children) {
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

    public void addChild(String child) {
        if (this.children == null) {
            this.children = new ArrayList<>();
        }
        this.children.add(child);
    }

    public Location getLocation() {
        return location;
    }

    public void setLocation(Location location) {
        this.location = location;
    }
}
