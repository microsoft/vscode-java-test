/*******************************************************************************
* Copyright (c) 2023 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.coverage;

import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IMember;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;

import java.util.HashMap;
import java.util.Map;

public class TypeTraverser {
    private final ICompilationUnit compilationUnit;
    private final Map<String, IType> types;

    public TypeTraverser(ICompilationUnit compilationUnit) {
        this.compilationUnit = compilationUnit;
        this.types = new HashMap<>();
    }

    public IType getType(String binaryName) {
        return this.types.get(binaryName);
    }

    public void process(IProgressMonitor monitor) throws JavaModelException {
        for (final IType type : this.compilationUnit.getTypes()) {
            if (monitor.isCanceled()) {
                return;
            }
            processType(new BinaryTypeName(type), type, monitor);
        }
    }

    private void processType(BinaryTypeName btn, IType type, IProgressMonitor monitor) throws JavaModelException {
        final String binaryName = btn.toString();
        this.types.put(binaryName, type);
        monitor.subTask(binaryName);
        for (final IJavaElement child : type.getChildren()) {
            switch (child.getElementType()) {
                case IJavaElement.TYPE:
                    final IType nestedType = (IType) child;
                    processType(btn.nest(nestedType), nestedType, monitor);
                    break;
                case IJavaElement.METHOD:
                case IJavaElement.FIELD:
                case IJavaElement.INITIALIZER:
                    processAnonymousInnerTypes(btn, (IMember) child, monitor);
                    break;
                default:
                    break;
            }
        }
    }

    private void processAnonymousInnerTypes(BinaryTypeName btn, IMember member, IProgressMonitor monitor)
            throws JavaModelException {
        for (final IJavaElement element : member.getChildren()) {
            if (element.getElementType() == IJavaElement.TYPE) {
                final IType type = (IType) element;
                processType(btn.nest(type), type, monitor);
            }
        }
    }

    /**
   * Internal utility to calculate binary names of nested classes.
   */
    private static class BinaryTypeName {

        private static class Ctr {
            private int i = 0;

            public int inc() {
                return ++i;
            }
        }

        private final String rootname;
        private final String typename;
        private final Ctr ctr;

        private BinaryTypeName(String rootname, String typename, Ctr ctr) {
            this.rootname = rootname;
            this.typename = typename;
            this.ctr = ctr;
        }

        public BinaryTypeName(IType roottype) {
            this.rootname = roottype.getFullyQualifiedName().replace('.', '/');
            this.typename = this.rootname;
            this.ctr = new Ctr();
        }

        public BinaryTypeName nest(IType type) throws JavaModelException {
            if (type.isAnonymous()) {
                return new BinaryTypeName(rootname, rootname + '$' + ctr.inc(), ctr);
            } else {
                return new BinaryTypeName(rootname,
                        typename + '$' + type.getElementName(), ctr);
            }
        }

        @Override
        public String toString() {
            return typename;
        }
    }
}
