package com.microsoft.java.test.plugin.model;

import com.google.gson.annotations.SerializedName;

public enum TestKind {
    @SerializedName("0")
    JUnit,
    
    @SerializedName("1")
    JUnit5,
    
    @SerializedName("2")
    TestNG
}
