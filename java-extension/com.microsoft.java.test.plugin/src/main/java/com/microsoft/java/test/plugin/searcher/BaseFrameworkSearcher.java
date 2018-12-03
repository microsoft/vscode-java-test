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

import com.microsoft.java.test.plugin.model.TestKind;

import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.SearchPattern;

public abstract class BaseFrameworkSearcher implements TestFrameworkSearcher {

    protected String[] testMethodAnnotation;

    public BaseFrameworkSearcher(String[] annotation) {
        this.testMethodAnnotation = annotation;
    }

    @Override
    public abstract TestKind getTestKind();

    @Override
    public String[] getTestMethodAnnotation() {
        return this.testMethodAnnotation;
    }

    @Override
    public boolean isTestMethod(IMethod method) {
        try {
            final int flags = method.getFlags();
            if (Flags.isAbstract(flags) || Flags.isStatic(flags)) {
                return false;
            }
            // 'V' is void signature
            if (method.isConstructor() || !"V".equals(method.getReturnType())) {
                return false;
            }
            return true;
        } catch (final JavaModelException e) {
            // ignore
            return false;
        }
    }

    @Override
    public SearchPattern getSearchPattern() {
        SearchPattern searchPattern = SearchPattern.createPattern(this.getTestMethodAnnotation()[0],
                IJavaSearchConstants.ANNOTATION_TYPE, IJavaSearchConstants.ANNOTATION_TYPE_REFERENCE,
                SearchPattern.R_EXACT_MATCH);
        for (int i = 1; i < this.getTestMethodAnnotation().length; i++) {
            searchPattern = SearchPattern.createOrPattern(searchPattern,
                    SearchPattern.createPattern(this.getTestMethodAnnotation()[i], IJavaSearchConstants.ANNOTATION_TYPE,
                            IJavaSearchConstants.ANNOTATION_TYPE_REFERENCE, SearchPattern.R_EXACT_MATCH));
        }
        return searchPattern;
    }
}
