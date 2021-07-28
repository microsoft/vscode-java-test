/*******************************************************************************
 * Copyright (c) 2017-2021 Microsoft Corporation and others.
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
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.IAnnotationBinding;
import org.eclipse.jdt.core.dom.IMethodBinding;

import java.util.Set;

public interface TestFrameworkSearcher {

    TestKind getTestKind();

    String getJdtTestKind();

    boolean isTestMethod(IMethodBinding methodBinding);

    boolean isTestClass(IType type) throws JavaModelException;

    String[] getTestMethodAnnotations();

    boolean findAnnotation(IAnnotationBinding[] annotations, String[] annotationNames);

    Set<IType> findTestItemsInContainer(IJavaElement element, IProgressMonitor monitor) throws CoreException;
}
