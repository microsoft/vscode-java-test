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
package com.microsoft.java.test.plugin.internal;

import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.SearchPattern;

import com.microsoft.java.test.plugin.internal.testsuit.TestKind;

public class JUnit5TestSearcher extends JUnitTestSearcher {

    private final String JUNIT_TEST_ANNOTATION = "org.junit.jupiter.api.Test";

    @Override
    public SearchPattern getSearchPattern() {
        SearchPattern testPattern = SearchPattern.createPattern(JUNIT_TEST_ANNOTATION,
                IJavaSearchConstants.ANNOTATION_TYPE, IJavaSearchConstants.ANNOTATION_TYPE_REFERENCE,
                SearchPattern.R_EXACT_MATCH | SearchPattern.R_CASE_SENSITIVE);
        return testPattern;
    }

    @Override
    public TestKind getTestKind() {
        return TestKind.JUnit5;
    }

    @Override
    public String getTestMethodAnnotation() {
        return JUNIT_TEST_ANNOTATION;
    }
}
