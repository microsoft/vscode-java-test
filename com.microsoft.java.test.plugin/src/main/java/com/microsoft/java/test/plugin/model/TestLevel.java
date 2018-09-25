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

import com.google.gson.annotations.SerializedName;

public enum TestLevel {
    @SerializedName("0")
    Folder,
    @SerializedName("1")
    Package,
    @SerializedName("2")
    Class,
    @SerializedName("3")
    NestedClass,
    @SerializedName("4")
    Method;
}
