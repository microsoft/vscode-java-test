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

package com.microsoft.java.test.plugin.util;

import com.microsoft.java.test.plugin.model.TestItem;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;

import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.jdt.core.IAnnotation;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.ISourceReference;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.ASTNode;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.dom.MethodDeclaration;
import org.eclipse.jdt.core.dom.NodeFinder;
import org.eclipse.jdt.core.dom.SingleVariableDeclaration;
import org.eclipse.jdt.core.manipulation.CoreASTProvider;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.lsp4j.Range;

import java.util.LinkedList;
import java.util.List;
import java.util.Optional;

import static java.util.Collections.emptyList;

@SuppressWarnings("restriction")
public class TestItemUtils {
    protected static final String DISPLAY_NAME_ANNOTATION_JUNIT5 = "org.junit.jupiter.api.DisplayName";

    public static TestItem constructTestItem(IJavaElement element, TestLevel level) throws JavaModelException {
        return constructTestItem(element, level, null);
    }

    public static TestItem constructTestItem(IJavaElement element, TestLevel level, TestKind kind)
            throws JavaModelException {
        final String displayName = parseDisplayName(element, kind);
        final String fullName = parseTestItemFullName(element, level);
        final String uri = JDTUtils.getFileURI(element.getResource());
        final Range range = parseTestItemRange(element, level);
        final String projectName = element.getJavaProject().getProject().getName();
        final List<String> paramTypes = element instanceof IMethod ? parseParameterTypes(element) : null;

        return new TestItem(displayName, fullName, uri, range, level, kind, projectName, paramTypes);
    }

    public static TestLevel getTestLevelForIType(IType type) {
        if (type.getParent() instanceof ICompilationUnit) {
            return TestLevel.CLASS;
        } else {
            return TestLevel.NESTED_CLASS;
        }
    }

    private static String parseDisplayName(IJavaElement element, TestKind kind) throws JavaModelException {
        String displayName = element.getElementName();
        if (element instanceof IMethod && kind == TestKind.JUnit5) {
            final Optional<IAnnotation> annotation = TestFrameworkUtils.getAnnotation((IMethod) element,
                    DISPLAY_NAME_ANNOTATION_JUNIT5);
            if (annotation.isPresent()) {
                displayName = (String) annotation.get().getMemberValuePairs()[0].getValue();
            }
        }

        return displayName;
    }

    private static String parseTestItemFullName(IJavaElement element, TestLevel level) {
        switch (level) {
            case CLASS:
            case NESTED_CLASS:
                final IType type = (IType) element;
                return type.getFullyQualifiedName();
            case METHOD:
                final IMethod method = (IMethod) element;
                return method.getDeclaringType().getFullyQualifiedName() + "#" + method.getElementName();
            default:
                return element.getElementName();
        }
    }

    private static Range parseTestItemRange(IJavaElement element, TestLevel level) throws JavaModelException {
        switch (level) {
            case CLASS:
            case NESTED_CLASS:
                final IType type = (IType) element;
                return getRange(type.getCompilationUnit(), type);
            case METHOD:
                final IMethod method = (IMethod) element;
                return getRange(method.getCompilationUnit(), method);
            default:
                return null;
        }
    }

    @SuppressWarnings("rawtypes")
    private static List<String> parseParameterTypes(IJavaElement element) throws JavaModelException {
        if (element instanceof IMethod) {
            final IMethod method = (IMethod) element;
            final List<String> result = new LinkedList<>();
            final CompilationUnit astRoot = CoreASTProvider.getInstance().getAST(
                    method.getDeclaringType().getCompilationUnit(), CoreASTProvider.WAIT_YES,
                    new NullProgressMonitor());
            final ASTNode name = NodeFinder.perform(astRoot, method.getSourceRange());
            if (name instanceof MethodDeclaration) {
                final List parameterList = ((MethodDeclaration) name).parameters();
                for (final Object obj : parameterList) {
                    if (obj instanceof SingleVariableDeclaration) {
                        result.add(((SingleVariableDeclaration) obj).getType().resolveBinding().getQualifiedName());
                    }
                }
            }
            return result;
        }
        return emptyList();
    }

    private static Range getRange(ICompilationUnit typeRoot, IJavaElement element) throws JavaModelException {
        final ISourceRange range = ((ISourceReference) element).getNameRange();
        return JDTUtils.toRange(typeRoot, range.getOffset(), range.getLength());
    }
}
