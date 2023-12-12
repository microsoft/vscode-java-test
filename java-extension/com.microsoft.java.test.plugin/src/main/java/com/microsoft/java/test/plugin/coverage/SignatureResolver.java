/*******************************************************************************
 * Copyright (c) 2006, 2020 Mountainminds GmbH & Co. KG and Contributors
 * This program and the accompanying materials are made available under
 * the terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *    Marc R. Hoffmann - initial API and implementation
 *
 ******************************************************************************/

package com.microsoft.java.test.plugin.coverage;

import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.ITypeParameter;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.Signature;

/**
 * Utility to get a resolved binary signature from a given method.
 */
public final class SignatureResolver {

    private static final String EMPTY = ""; //$NON-NLS-1$

    private static final String OBJECT = "Ljava/lang/Object;"; //$NON-NLS-1$

    private static final char SLASH = '/';

    /**
     * Extracts the parameter part from the given signature, i.e. the substring
     * contained in braces.
     *
     * @param signature
     *                  method signature
     * @return parameter part only
     */
    public static String getParameters(final String signature) {
        final int pos = signature.lastIndexOf(')');
        // avoid String instances for methods without parameters
        return pos == 1 ? EMPTY : signature.substring(1, pos);
    }

    /**
     * Extracts the resolved binary parameters from the given method
     *
     * @param method
     *               method to resolve
     * @return binary parameter specification
     */
    public static String getParameters(final IMethod method)
            throws JavaModelException {
        if (method.isBinary()) {
            return getParameters(method.getSignature());
        }
        final StringBuilder buffer = new StringBuilder();
        final String[] parameterTypes = method.getParameterTypes();
        for (final String t : parameterTypes) {
            resolveArrayParameterType(method, t, buffer);
        }
        return buffer.toString();
    }

    private static final void resolveArrayParameterType(final IMethod method,
            final String parameterType, final StringBuilder result)
            throws JavaModelException {
        final int arrayCount = Signature.getArrayCount(parameterType);
        for (int i = 0; i < arrayCount; i++) {
            result.append(Signature.C_ARRAY);
        }
        resolveParameterType(method, parameterType.substring(arrayCount), result);
    }

    private static final void resolveParameterType(final IMethod method,
            final String parameterType, final StringBuilder result)
            throws JavaModelException {
        final char kind = parameterType.charAt(0);
        switch (kind) {
            case Signature.C_UNRESOLVED:
                final String identifier = parameterType.substring(1,
                        parameterType.length() - 1);
                if (resolveType(method.getDeclaringType(), identifier, result)) {
                    return;
                }
                if (resolveTypeParameter(method, identifier, result)) {
                    return;
                }
                break;
        }
        result.append(parameterType);
    }

    private static final boolean resolveType(final IType scope,
            final String identifier, final StringBuilder result)
            throws JavaModelException {
        final String[][] types = scope
                .resolveType(Signature.getTypeErasure(identifier));
        if (types == null || types.length != 1) {
            return false;
        }
        result.append(Signature.C_RESOLVED);
        final String qualifier = types[0][0];
        if (qualifier.length() > 0) {
            replace(qualifier, Signature.C_DOT, SLASH, result);
            result.append(SLASH);
        }
        replace(types[0][1], Signature.C_DOT, Signature.C_DOLLAR, result);
        result.append(Signature.C_SEMICOLON);
        return true;
    }

    private static final boolean resolveTypeParameter(final IMethod method,
            final String identifier, final StringBuilder result)
            throws JavaModelException {
        IType type = method.getDeclaringType();
        if (resolveTypeParameter(type, method.getTypeParameters(), identifier,
                result)) {
            return true;
        }
        while (type != null) {
            if (resolveTypeParameter(type, type.getTypeParameters(), identifier,
                    result)) {
                return true;
            }
            type = type.getDeclaringType();
        }
        return false;
    }

    private static final boolean resolveTypeParameter(final IType context,
            final ITypeParameter[] typeParameters, final String identifier,
            final StringBuilder result) throws JavaModelException {
        for (final ITypeParameter p : typeParameters) {
            if (identifier.equals(p.getElementName())) {
                final String[] bounds = p.getBounds();
                if (bounds.length == 0) {
                    result.append(OBJECT);
                    return true;
                } else {
                    return resolveType(context, bounds[0], result);
                }
            }
        }
        return false;
    }

    private static final void replace(final String source, final char oldChar,
            final char newChar, final StringBuilder result) {
        final int len = source.length();
        for (int i = 0; i < len; i++) {
            final char c = source.charAt(i);
            result.append(c == oldChar ? newChar : c);
        }
    }

    private SignatureResolver() {
        // no instances
    }
}
