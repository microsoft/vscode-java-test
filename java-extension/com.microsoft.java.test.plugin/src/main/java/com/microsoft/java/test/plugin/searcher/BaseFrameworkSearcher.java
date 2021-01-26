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
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.IAnnotationBinding;
import org.eclipse.jdt.core.dom.IMethodBinding;
import org.eclipse.jdt.core.dom.ITypeBinding;

public abstract class BaseFrameworkSearcher implements TestFrameworkSearcher {

    protected String[] testMethodAnnotations;

    @Override
    public abstract TestKind getTestKind();

    @Override
    public String[] getTestMethodAnnotations() {
        return this.testMethodAnnotations;
    }

    @Override
    public boolean findAnnotation(IAnnotationBinding[] annotations, String[] annotationNames) {
        for (final IAnnotationBinding annotation : annotations) {
            final ITypeBinding annotationType = annotation.getAnnotationType();
            for (final String annotationName : annotationNames) {
                if (TestFrameworkUtils.isEquivalentAnnotationType(annotationType, annotationName)) {
                    return true;
                }
            }
        }
        return false;
    }

    @Override
    public TestItem parseTestItem(IMethodBinding methodBinding) throws JavaModelException {
        return TestItemUtils.constructTestItem((IMethod) methodBinding.getJavaElement(),
            TestLevel.METHOD, this.getTestKind());
    }
}
