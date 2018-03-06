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
package com.microsoft.java.test.plugin.internal;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.IAnnotatable;
import org.eclipse.jdt.core.IAnnotation;
import org.eclipse.jdt.core.IClassFile;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;

import com.microsoft.java.test.plugin.internal.testsuit.TestKind;

public class JUnitUtility {
    public static boolean isTestMethod(IMethod method, String annotation) {
        int flags;
        try {
            flags = method.getFlags();
            // 'V' is void signature
            return !(method.isConstructor() || !(annotation.contains("jupiter") ? true : Flags.isPublic(flags)) || Flags.isAbstract(flags)
                    || Flags.isStatic(flags) || !"V".equals(method.getReturnType()))
                    && hasTestAnnotation(method, annotation);
        } catch (JavaModelException e) {
            // ignore
            return false;
        }
    }

    public static boolean isTestClass(IType type, String annotation) {
        try {
            if (!isAccessibleClass(type)) {
                return false;
            }
            if (Flags.isAbstract(type.getFlags())) {
                return false;
            }
            List<IMethod> tests = Arrays.stream(type.getMethods()).filter(m -> isTestMethod(m, annotation))
                    .collect(Collectors.toList());
            return tests.size() > 0;
        } catch (JavaModelException e) {
            return false;
        }

    }

    public static boolean isAccessibleClass(IType type) throws JavaModelException {
        int flags = type.getFlags();
        if (Flags.isInterface(flags)) {
            return false;
        }
        IJavaElement parent = type.getParent();
        while (true) {
            if (parent instanceof ICompilationUnit || parent instanceof IClassFile) {
                return true;
            }
            if (!(parent instanceof IType) || !Flags.isStatic(flags) || !Flags.isPublic(flags)) {
                return false;
            }
            flags = ((IType) parent).getFlags();
            parent = parent.getParent();
        }
    }

    static boolean hasTestAnnotation(IMethod method, String annotation) {
        try {
            String name = annotation.substring(annotation.lastIndexOf('.') + 1);
            if (!Arrays.stream(method.getAnnotations()).anyMatch(a -> a.getElementName().equals(name))) {
                return false;
            }
            IAnnotation anno = method.getAnnotation(name);
            if (!anno.exists()) {
                return false;
            }
            String[][] fullNameArr = method.getDeclaringType().resolveType(name);
            String fullName = Arrays.stream(fullNameArr[0]).collect(Collectors.joining("."));
            return fullName.equals(annotation);
        } catch (JavaModelException e) {
            return false;
        }
    }
}
