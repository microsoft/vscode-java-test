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

import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.SearchPattern;

public class JUnit4TestSearcher extends JUnitTestSearcher {

    public static final String JUNIT_TEST_ANNOTATION = "org.junit.Test";
    public static final String JUNIT_RUN_WITH_ANNOTATION = "org.junit.runner.RunWith";

    @Override
    public SearchPattern getSearchPattern() {
        final SearchPattern runWithPattern = SearchPattern.createPattern(JUNIT_RUN_WITH_ANNOTATION,
                IJavaSearchConstants.ANNOTATION_TYPE, IJavaSearchConstants.ANNOTATION_TYPE_REFERENCE,
                SearchPattern.R_EXACT_MATCH | SearchPattern.R_CASE_SENSITIVE);
        final SearchPattern testPattern = SearchPattern.createPattern(JUNIT_TEST_ANNOTATION,
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
