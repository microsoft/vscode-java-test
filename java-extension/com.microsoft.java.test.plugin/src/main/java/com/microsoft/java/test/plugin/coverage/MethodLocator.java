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
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.Signature;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Internal utility to select methods by their binary signature. For performance
 * optimization matching is performed in two steps, where the first step should
 * quickly identify methods in most situations: Identification by name and
 * parameter count. Only if the first step does fails to identify a method
 * unambiguously the parameter types are resolved in a second step.
 */
public class MethodLocator {

    /** Index on methods by name and parameter count. */
    private final Map<String, IMethod> indexParamCount = new HashMap<String, IMethod>();

    /**
     * For the keys in this set there are multiple overloaded methods with the
     * same name and the more expensive signature resolver must be used.
     */
    private final Set<String> ambiguous = new HashSet<String>();

    /** Index on methods by name and parameter signature. */
    private final Map<String, IMethod> indexParamSignature = new HashMap<String, IMethod>();

    private final IType type;

    /**
     * Initializes a new locator for method search within the given type.
     *
     * @param type
     *             type to search methods in
     * @throws JavaModelException
     */
    public MethodLocator(final IType type) throws JavaModelException {
        this.type = type;
        for (final IMethod m : type.getMethods()) {
            addToIndex(m);
        }
    }

    /**
     * Searches for the method with the given binary name.
     *
     * @param name
     *                  binary method name
     * @param signature
     *                  binary method signature
     * @return method or <code>null</code>
     */
    public IMethod findMethod(String name, String signature) {
        if ("<init>".equals(name)) { //$NON-NLS-1$
            name = type.getElementName();
        }
        final String paramCountKey = createParamCountKey(name, signature);
        if (ambiguous.contains(paramCountKey)) {
            return indexParamSignature.get(createParamSignatureKey(name, signature));
        } else {
            return indexParamCount.get(paramCountKey);
        }
    }

    private void addToIndex(final IMethod method) throws JavaModelException {
        final String paramCountKey = createParamCountKey(method);
        if (ambiguous.contains(paramCountKey)) {
            indexParamSignature.put(createParamSignatureKey(method), method);
        } else {
            final IMethod existing = indexParamCount.get(paramCountKey);
            if (existing == null) {
                indexParamCount.put(paramCountKey, method);
            } else {
                ambiguous.add(paramCountKey);
                indexParamSignature.put(createParamSignatureKey(existing), existing);
                indexParamSignature.put(createParamSignatureKey(method), method);
            }
        }
    }

    private String createParamCountKey(final IMethod method) {
        return method.getElementName() + "@" + method.getParameterTypes().length; //$NON-NLS-1$
    }

    private String createParamCountKey(final String name,
            final String fullSignature) {
        return name + "@" + Signature.getParameterCount(fullSignature); //$NON-NLS-1$
    }

    private String createParamSignatureKey(final IMethod method)
            throws JavaModelException {
        return method.getElementName() + "#" + SignatureResolver.getParameters(method);
                
    }

    private String createParamSignatureKey(final String name,
            final String fullSignature) {
        return name + "#" + SignatureResolver.getParameters(fullSignature);
    }
}
