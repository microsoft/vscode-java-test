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
