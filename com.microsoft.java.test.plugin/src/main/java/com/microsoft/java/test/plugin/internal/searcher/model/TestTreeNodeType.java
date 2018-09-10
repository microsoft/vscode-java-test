package com.microsoft.java.test.plugin.internal.searcher.model;

import com.google.gson.annotations.SerializedName;

public enum TestTreeNodeType {
    @SerializedName("0")
    Method,
    @SerializedName("1")
    Class,
    @SerializedName("2")
    Package,
    @SerializedName("3")
    Folder
}
