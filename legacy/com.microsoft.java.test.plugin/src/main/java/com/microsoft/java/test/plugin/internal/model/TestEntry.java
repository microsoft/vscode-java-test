package com.microsoft.java.test.plugin.internal.model;

import java.util.List;

import org.eclipse.lsp4j.Range;

import com.microsoft.java.test.plugin.internal.testsuit.TestKind;

public class TestEntry {
    private String displayName;

    private String fullName;

    private String uri;

    private Range range;

    private List<TestEntry> children;

    private TestEntry parent;

    private TestEntryType type;

    private TestKind kind;

    private String project;

    public TestEntry(String displayName, String fullName, String uri, Range range, TestEntryType type, TestKind kind, String project) {
        this.displayName = displayName;
        this.fullName = fullName;
        this.uri = uri;
        this.range = range;
        this.type = type;
        this.kind = kind;
        this.project = project;
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

    public List<TestEntry> getChildren() {
        return children;
    }

    public void setChildren(List<TestEntry> children) {
        this.children = children;
    }

    public TestEntry getParent() {
        return parent;
    }

    public void setParent(TestEntry parent) {
        this.parent = parent;
    }

    public TestEntryType getType() {
        return type;
    }

    public void setType(TestEntryType type) {
        this.type = type;
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
}
