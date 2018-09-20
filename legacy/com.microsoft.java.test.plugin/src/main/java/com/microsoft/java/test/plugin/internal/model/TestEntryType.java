package com.microsoft.java.test.plugin.internal.model;

import com.google.gson.annotations.SerializedName;

public enum TestEntryType {
    @SerializedName("0")
    Folder,
    @SerializedName("1")
    Package,
    @SerializedName("2")
    Class,
    @SerializedName("3")
    Method;
}
