/*******************************************************************************
* Copyright (c) 2023 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.coverage.model;

import java.util.List;

public class SourceFileCoverage {
    String uriString;
    List<LineCoverage> lineCoverages;
    List<MethodCoverage> methodCoverages;

    public SourceFileCoverage(String uriString, List<LineCoverage> lineCoverages,
            List<MethodCoverage> methodCoverages) {
        this.uriString = uriString;
        this.lineCoverages = lineCoverages;
        this.methodCoverages = methodCoverages;
    }
}
