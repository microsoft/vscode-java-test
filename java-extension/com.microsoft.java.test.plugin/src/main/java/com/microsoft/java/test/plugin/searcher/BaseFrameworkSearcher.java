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

package com.microsoft.java.test.plugin.searcher;

import com.microsoft.java.test.plugin.model.TestItem;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.util.TestFrameworkUtils;
import com.microsoft.java.test.plugin.util.TestItemUtils;

import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.SearchPattern;

public abstract class BaseFrameworkSearcher implements TestFrameworkSearcher {

    protected String[] testMethodAnnotations;
    protected String[] testClassAnnotations;

    @Override
    public abstract TestKind getTestKind();

    @Override
    public String[] getTestMethodAnnotations() {
        return this.testMethodAnnotations;
    }

    @Override
    public String[] getTestClassAnnotations() {
        return this.testClassAnnotations;
    }

    @Override
    public boolean isTestClass(IType type) {
        for (final String annotation : this.getTestClassAnnotations()) {
            if (TestFrameworkUtils.hasAnnotation(type, annotation)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public SearchPattern getSearchPattern() {
        if (this.getTestMethodAnnotations().length <= 0) {
            throw new RuntimeException(
                    "Failed to initialize the supported test annotations for " + this.getClass().getName());
        }
        SearchPattern searchPattern = SearchPattern.createPattern(this.getTestMethodAnnotations()[0],
                IJavaSearchConstants.ANNOTATION_TYPE, IJavaSearchConstants.ANNOTATION_TYPE_REFERENCE,
                SearchPattern.R_EXACT_MATCH);
        for (int i = 1; i < this.getTestMethodAnnotations().length; i++) {
            searchPattern = SearchPattern.createOrPattern(searchPattern,
                    SearchPattern.createPattern(this.getTestMethodAnnotations()[i],
                            IJavaSearchConstants.ANNOTATION_TYPE, IJavaSearchConstants.ANNOTATION_TYPE_REFERENCE,
                            SearchPattern.R_EXACT_MATCH));
        }
        for (final String classAnnotation : this.getTestClassAnnotations()) {
            searchPattern = SearchPattern.createOrPattern(searchPattern,
                    SearchPattern.createPattern(classAnnotation, IJavaSearchConstants.ANNOTATION_TYPE,
                            IJavaSearchConstants.ANNOTATION_TYPE_REFERENCE, SearchPattern.R_EXACT_MATCH));
        }
        return searchPattern;
    }

    @Override
    public TestItem parseTestItem(IMethod method) throws JavaModelException {
        return TestItemUtils.constructTestItem(method, TestLevel.METHOD, this.getTestKind());
    }

    @Override
    public TestItem parseTestItem(IType type) throws JavaModelException {
        return TestItemUtils.constructTestItem(type, TestLevel.CLASS, this.getTestKind());
    }
}
