/*******************************************************************************
 * Copyright (c) 2021 Microsoft Corporation and others.
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

public class JavaTestItem {
    private String id;

    private String label;

    private String fullName;

    private List<JavaTestItem> children;

    private TestLevel testLevel;

    private TestKind testKind;

    private String projectName;

    private String uri;

    private Range range;

    private String jdtHandler;

    /**
     * Optional field for project item.
     */
    private String[] natureIds;

    public JavaTestItem() {}

    public JavaTestItem(String displayName, String fullName, String project, String uri,
            Range range, TestLevel level, TestKind kind) {
        this.label = displayName;
        this.fullName = fullName;
        this.testLevel = level;
        this.testKind = kind;
        this.projectName = project;
        this.uri = uri;
        this.range = range;

        if (level.equals(TestLevel.PROJECT)) {
            this.id = fullName;
        } else {
            this.id = project + "@" + fullName;
        }
    }

    public Range getRange() {
        return range;
    }

    public void setRange(Range range) {
        this.range = range;
    }

    public String getUri() {
        return uri;
    }

    public void setUri(String uri) {
        this.uri = uri;
    }

    public String getJdtHandler() {
        return jdtHandler;
    }

    public void setJdtHandler(String jdtHandler) {
        this.jdtHandler = jdtHandler;
    }

    public String getId() {
        return id;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public List<JavaTestItem> getChildren() {
        return children;
    }

    public void setChildren(List<JavaTestItem> children) {
        this.children = children;
    }

    public TestLevel getTestLevel() {
        return testLevel;
    }

    public void setTestLevel(TestLevel testLevel) {
        this.testLevel = testLevel;
    }

    public TestKind getTestKind() {
        return testKind;
    }

    public void setTestKind(TestKind testKind) {
        this.testKind = testKind;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public String[] getNatureIds() {
        return natureIds;
    }

    public void setNatureIds(String[] natureIds) {
        this.natureIds = natureIds;
    }

    public void addChild(JavaTestItem child) {
        if (this.children == null) {
            this.children = new ArrayList<>();
        }
        this.children.add(child);
    }

    @Override
    public int hashCode() {
        final int prime = 31;
        int result = 1;
        result = prime * result + ((id == null) ? 0 : id.hashCode());
        return result;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }

        if (obj == null) {
            return false;
        }

        if (getClass() != obj.getClass()) {
            return false;
        }
        final JavaTestItem other = (JavaTestItem) obj;
        if (id == null) {
            if (other.id != null) {

                return false;
            }
        } else if (!id.equals(other.id)){
            return false;
        }
        return true;
    }
}
