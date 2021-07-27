/*******************************************************************************
* Copyright (c) 2018-2021 Microsoft Corporation and others.
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

public enum TestLevel {
    @SerializedName("0")
    ROOT,

    @SerializedName("1")
    WORKSPACE,

    @SerializedName("2")
    WORKSPACE_FOLDER,

    @SerializedName("3")
    PROJECT,

    @SerializedName("4")
    PACKAGE,

    @SerializedName("5")
    CLASS,

    @SerializedName("6")
    METHOD;

    public static TestLevel fromInteger(Integer i) {
        switch(i) {
            case 0:
                return ROOT;
            case 1:
                return WORKSPACE;
            case 2:
                return WORKSPACE_FOLDER;
            case 3:
                return PROJECT;
            case 4:
                return PACKAGE;
            case 5:
                return CLASS;
            case 6:
                return METHOD;
            default:
                return null;
        }
    }
}
