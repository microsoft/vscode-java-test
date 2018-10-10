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

package com.microsoft.java.test.plugin.util;

import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.IAnnotation;
import org.eclipse.jdt.core.IClassFile;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

public class JUnitUtility {
    public static boolean isTestMethod(IMethod method, String annotation) {
        final int flags;
        try {
            flags = method.getFlags();
            // 'V' is void signature
            return !(method.isConstructor() || !(annotation.contains("jupiter") ? true : Flags.isPublic(flags)) ||
                    Flags.isAbstract(flags) || Flags.isStatic(flags) || !"V".equals(method.getReturnType())) &&
                    hasTestAnnotation(method, annotation);
        } catch (final JavaModelException e) {
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
            final List<IMethod> tests = Arrays.stream(type.getMethods()).filter(m -> isTestMethod(m, annotation))
                    .collect(Collectors.toList());
            return tests.size() > 0;
        } catch (final JavaModelException e) {
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

    public static boolean hasTestAnnotation(IMethod method, String annotation) {
        try {
            final Optional<IAnnotation> matched = Arrays.stream(method.getAnnotations())
                    .filter(a -> annotation.endsWith(a.getElementName())).findAny();
            if (!matched.isPresent()) {
                return false;
            }
            final IAnnotation anno = matched.get();
            if (!anno.exists()) {
                return false;
            }
            final String name = anno.getElementName();
            final String[][] fullNameArr = method.getDeclaringType().resolveType(name);
            if (fullNameArr == null) {
                final ICompilationUnit cu = method.getCompilationUnit();
                return cu != null && cu.getImport(annotation).exists();
            }
            final String fullName = Arrays.stream(fullNameArr[0]).collect(Collectors.joining("."));
            return fullName.equals(annotation);
        } catch (final JavaModelException e) {
            return false;
        }
    }
}
