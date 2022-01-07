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

public class Option {
    public String value;
    public String label;
    public String description;
    public boolean isAdvanced;
    public boolean picked;

    public Option(String label) {
        this.label = label;
    }

    public Option(String value, String label, String description) {
        this.value = value;
        this.label = label;
        this.description = description;
    }

    public Option(String value, String label, String description, boolean isAdvanced) {
        this(value, label, description);
        this.isAdvanced = isAdvanced;
    }
}
