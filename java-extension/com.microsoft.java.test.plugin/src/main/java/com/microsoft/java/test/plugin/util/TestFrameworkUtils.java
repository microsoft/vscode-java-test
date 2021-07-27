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

package com.microsoft.java.test.plugin.util;

import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.searcher.JUnit4TestSearcher;
import com.microsoft.java.test.plugin.searcher.JUnit5TestSearcher;
import com.microsoft.java.test.plugin.searcher.TestFrameworkSearcher;
import com.microsoft.java.test.plugin.searcher.TestNGTestSearcher;

import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.IMethodBinding;
import org.eclipse.jdt.core.dom.ITypeBinding;
import org.eclipse.jdt.internal.junit.util.CoreTestSearchEngine;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.Objects;

public class TestFrameworkUtils {

    public static final TestFrameworkSearcher JUNIT4_TEST_SEARCHER = new JUnit4TestSearcher();
    public static final TestFrameworkSearcher JUNIT5_TEST_SEARCHER = new JUnit5TestSearcher();
    public static final TestFrameworkSearcher TESTNG_TEST_SEARCHER = new TestNGTestSearcher();

    public static boolean isEquivalentAnnotationType(ITypeBinding annotationType, String annotationName) {
        return annotationType != null && Objects.equals(annotationType.getQualifiedName(), annotationName);
    }
}
