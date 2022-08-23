/*******************************************************************************
* Copyright (c) 2018-2022 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.util;

import com.microsoft.java.test.plugin.model.TestLevel;

import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.ISourceReference;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.SourceRange;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.lsp4j.Range;

@SuppressWarnings("restriction")
public class TestItemUtils {

    public static Range parseTestItemRange(IJavaElement element) throws JavaModelException {
        if (element instanceof ISourceReference) {
            final ISourceRange sourceRange = ((ISourceReference) element).getSourceRange();
            final ISourceRange nameRange = ((ISourceReference) element).getNameRange();
            // get the code range excluding the comment part
            if (SourceRange.isAvailable(sourceRange) && SourceRange.isAvailable(nameRange)) {
                return JDTUtils.toRange(element.getOpenable(), nameRange.getOffset(),
                        sourceRange.getLength() - nameRange.getOffset() + sourceRange.getOffset());
            }
        }
        return null;
    }

    public static String parseFullName(IJavaElement element, TestLevel level) {
        switch (level) {
            case CLASS:
                final IType type = (IType) element;
                return type.getFullyQualifiedName();
            case METHOD:
                final IMethod method = (IMethod) element;
                return method.getDeclaringType().getFullyQualifiedName() + "#" + method.getElementName();
            default:
                return element.getElementName();
        }
    }
}
