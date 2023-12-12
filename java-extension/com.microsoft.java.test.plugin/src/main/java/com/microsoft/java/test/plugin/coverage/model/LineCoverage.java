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

public class LineCoverage {
    int lineNumber;
    int hit;
    List<BranchCoverage> branchCoverages;

    public LineCoverage(int lineNumber, int hit, List<BranchCoverage> branchCoverages) {
        this.lineNumber = lineNumber;
        this.hit = hit;
        this.branchCoverages = branchCoverages;
    }
}
