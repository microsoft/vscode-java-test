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

import com.google.gson.annotations.SerializedName;

public enum TestKind {

    @SerializedName("0")
    JUnit5(0),

    @SerializedName("1")
    JUnit(1),

    @SerializedName("2")
    TestNG(2),

    @SerializedName("100")
    None(100);

    private int value;

    public static TestKind fromString(String s) {
        switch(s) {
            case "Unknown":
                return None;
            case "JUnit 4":
                return JUnit;
            case "JUnit 5":
                return JUnit5;
            case "TestNG":
                return TestNG;
            default:
                return null;
        }
    }

    @Override
    public String toString() {
        switch (this) {
            case None:
                return "Unknown";
            case JUnit:
                return "JUnit 4";
            case JUnit5:
                return "JUnit 5";
            case TestNG:
                return "TestNG";
            default:
                return "";
        }
    }

    public int getValue() {
        return this.value;
    }

    private TestKind(int value){
        this.value = value;
    }
}
