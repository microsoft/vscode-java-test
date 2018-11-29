/*******************************************************************************
 * Copyright (c) 2017 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.searcher;

import com.microsoft.java.test.plugin.model.TestKind;

import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.search.SearchPattern;

public interface TestFrameworkSearcher {

    TestKind getTestKind();

    boolean isTestMethod(IMethod method);

    String getTestMethodAnnotation();

    SearchPattern getSearchPattern();
}
