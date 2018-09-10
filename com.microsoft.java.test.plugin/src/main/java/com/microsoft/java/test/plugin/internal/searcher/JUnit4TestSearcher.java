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
package com.microsoft.java.test.plugin.internal.searcher;

import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.SearchPattern;

import com.microsoft.java.test.plugin.internal.testsuit.TestKind;

public class JUnit4TestSearcher extends JUnitTestSearcher {

    private final String JUNIT_TEST_ANNOTATION = "org.junit.Test";
    private final String JUNIT_RUN_WITH_ANNOTATION = "org.junit.runner.RunWith";

    @Override
    public SearchPattern getSearchPattern() {
        SearchPattern runWithPattern = SearchPattern.createPattern(JUNIT_RUN_WITH_ANNOTATION,
                IJavaSearchConstants.ANNOTATION_TYPE, IJavaSearchConstants.ANNOTATION_TYPE_REFERENCE,
                SearchPattern.R_EXACT_MATCH | SearchPattern.R_CASE_SENSITIVE);
        SearchPattern testPattern = SearchPattern.createPattern(JUNIT_TEST_ANNOTATION,
                IJavaSearchConstants.ANNOTATION_TYPE, IJavaSearchConstants.ANNOTATION_TYPE_REFERENCE,
                SearchPattern.R_EXACT_MATCH | SearchPattern.R_CASE_SENSITIVE);
        return SearchPattern.createOrPattern(runWithPattern, testPattern);
    }

    @Override
    public TestKind getTestKind() {
        return TestKind.JUnit;
    }

    @Override
    public String getTestMethodAnnotation() {
        return JUNIT_TEST_ANNOTATION;
    }

}
