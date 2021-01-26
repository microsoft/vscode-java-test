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

import com.microsoft.java.test.plugin.model.TestItem;
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

    public static final TestFrameworkSearcher[] FRAMEWORK_SEARCHERS = new TestFrameworkSearcher[] {
        JUNIT4_TEST_SEARCHER, JUNIT5_TEST_SEARCHER, TESTNG_TEST_SEARCHER };

    public static void findTestItemsInTypeBinding(ITypeBinding typeBinding, List<TestItem> result,
            TestItem parentClassTestItem, IProgressMonitor monitor) throws JavaModelException {
        if (monitor.isCanceled()) {
            return;
        }

        final List<TestFrameworkSearcher> searchers = new ArrayList<>();
        final IType type = (IType) typeBinding.getJavaElement();
        for (final TestFrameworkSearcher searcher : FRAMEWORK_SEARCHERS) {
            if (CoreTestSearchEngine.isAccessibleClass(type, searcher.getJdtTestKind())) {
                searchers.add(searcher);
            }
        }

        if (searchers.size() == 0) {
            return;
        }

        final List<TestItem> testMethods = new LinkedList<>();
        final List<String> testMethodIds = new LinkedList<>();
        for (final IMethodBinding methodBinding : typeBinding.getDeclaredMethods()) {
            for (final TestFrameworkSearcher searcher : searchers) {
                if (searcher.isTestMethod(methodBinding)) {
                    final TestItem methodItem = searcher.parseTestItem(methodBinding);
                    testMethods.add(methodItem);
                    testMethodIds.add(methodItem.getId());
                    break;
                }
            }
        }
        TestItem classItem = null;
        if (testMethods.size() > 0) {
            result.addAll(testMethods);
            classItem = TestItemUtils.constructTestItem((IType) typeBinding.getJavaElement(),
                    TestLevel.CLASS);
            classItem.setChildren(testMethodIds);
            classItem.setKind(testMethods.get(0).getKind());
            result.add(classItem);
        } else {
            if (JUNIT4_TEST_SEARCHER.isTestClass(type)) {
                // to handle @RunWith classes
                classItem = TestItemUtils.constructTestItem(type, TestLevel.CLASS, TestKind.JUnit);
                result.add(classItem);
            } else if (JUNIT5_TEST_SEARCHER.isTestClass(type)) {
                // to handle @Nested and @Testable classes
                classItem = TestItemUtils.constructTestItem(type, TestLevel.CLASS, TestKind.JUnit5);
                result.add(classItem);
            }
        }

        // set the class item as the child of its declaring type
        if (classItem != null && parentClassTestItem != null) {
            parentClassTestItem.addChild(classItem.getId());
        }

        for (final ITypeBinding childTypeBinding : typeBinding.getDeclaredTypes()) {
            findTestItemsInTypeBinding(childTypeBinding, result, classItem, monitor);
        }
    }

    public static boolean isEquivalentAnnotationType(ITypeBinding annotationType, String annotationName) {
        return annotationType != null && Objects.equals(annotationType.getQualifiedName(), annotationName);
    }
}
