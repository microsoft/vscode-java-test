/*******************************************************************************
 * Copyright (c) 2017-2025 Microsoft Corporation and others.
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

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.OperationCanceledException;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.internal.junit.launcher.TestKindRegistry;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Test searcher for JUnit 6 (Jupiter API 6.x).
 * 
 * <p>JUnit 6 is an evolutionary release built on top of JUnit 5's Jupiter platform.
 * It maintains full backward compatibility with JUnit 5 while adding improvements
 * and new features. This class extends JUnit5TestSearcher to inherit all the 
 * Jupiter test detection logic, only overriding the parts specific to JUnit 6:
 * <ul>
 *   <li>Test kind identification (JUnit6 vs JUnit5)</li>
 *   <li>Test finder instance (uses JUnit6TestFinder for proper classpath resolution)</li>
 * </ul>
 * 
 * @see JUnit5TestSearcher
 * @see JUnit6TestFinder
 */
public class JUnit6TestSearcher extends JUnit5TestSearcher {

    private static final JUnit6TestFinder JUNIT6_TEST_FINDER = new JUnit6TestFinder();

    @Override
    public TestKind getTestKind() {
        return TestKind.JUnit6;
    }

    @Override
    public String getJdtTestKind() {
        return TestKindRegistry.JUNIT6_TEST_KIND_ID;
    }

    @Override
    public boolean isTestClass(IType type) throws JavaModelException {
        return JUNIT6_TEST_FINDER.isTest(type);
    }

    @Override
    public Set<IType> findTestItemsInContainer(IJavaElement element, IProgressMonitor monitor) throws CoreException {
        final Set<IType> types = new HashSet<>();
        try {
            JUNIT6_TEST_FINDER.findTestsInContainer(element, types, monitor);
        } catch (OperationCanceledException e) {
            return Collections.emptySet();
        }
        return types;
    }
}
