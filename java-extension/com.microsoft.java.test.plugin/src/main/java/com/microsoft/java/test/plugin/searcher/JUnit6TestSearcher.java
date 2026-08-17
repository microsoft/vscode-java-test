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

import org.eclipse.jdt.internal.junit.launcher.TestKindRegistry;

/**
 * Test searcher for JUnit 6 (Jupiter API 6.x).
 *
 * <p>JUnit 5 and JUnit 6 share the same Jupiter test discovery semantics. The
 * JUnit version is distinguished when selecting the test kind and runtime.
 *
 * @see JUnit5TestSearcher
 */
public class JUnit6TestSearcher extends JUnit5TestSearcher {

    @Override
    public TestKind getTestKind() {
        return TestKind.JUnit6;
    }

    @Override
    public String getJdtTestKind() {
        return TestKindRegistry.JUNIT6_TEST_KIND_ID;
    }
}
