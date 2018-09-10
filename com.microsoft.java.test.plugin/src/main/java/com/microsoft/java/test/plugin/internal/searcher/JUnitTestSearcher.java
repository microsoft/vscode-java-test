/*******************************************************************************
* Copyright (c) 2017, 2018 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/
package com.microsoft.java.test.plugin.internal.searcher;

import org.eclipse.jdt.core.search.SearchPattern;

import com.microsoft.java.test.plugin.internal.testsuit.TestKind;

public abstract class JUnitTestSearcher {
    public abstract SearchPattern getSearchPattern();

    public abstract TestKind getTestKind();

    public abstract String getTestMethodAnnotation();
}
