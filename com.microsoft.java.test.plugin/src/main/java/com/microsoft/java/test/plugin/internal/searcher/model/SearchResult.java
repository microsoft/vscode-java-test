package com.microsoft.java.test.plugin.internal.searcher.model;

import com.microsoft.java.test.plugin.internal.testsuit.TestSuite;

public class SearchResult {
    private TestSuite suite;
    private String displayName;
    private TestTreeNodeType nodeType;

    public TestSuite getSuite() {
        return suite;
    }

    public void setSuite(TestSuite suite) {
        this.suite = suite;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public TestTreeNodeType getNodeType() {
        return nodeType;
    }

    public void setNodeType(TestTreeNodeType nodeType) {
        this.nodeType = nodeType;
    }

    public SearchResult(TestSuite suite, String displayName, TestTreeNodeType nodeType) {
        this.suite = suite;
        this.displayName = displayName;
        this.nodeType = nodeType;
    }
}
