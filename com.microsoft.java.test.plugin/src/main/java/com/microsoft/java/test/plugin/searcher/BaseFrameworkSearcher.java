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

package com.microsoft.java.test.plugin.searcher;

import com.microsoft.java.test.plugin.model.TestKind;
import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.JavaModelException;

public abstract class BaseFrameworkSearcher implements TestFrameworkSearcher {

    @Override
    public abstract TestKind getTestKind();

    @Override
    public boolean isTestMethod(IMethod method) {
       try {
           final int flags = method.getFlags();
           if (Flags.isAbstract(flags) || Flags.isStatic(flags)) {
               return false;
           }
            // 'V' is void signature
           if (method.isConstructor() || !"V".equals(method.getReturnType())) {
               return false;
           }
            return true;
       } catch (final JavaModelException e) {
           // ignore
           return false;
       }
   }
}
