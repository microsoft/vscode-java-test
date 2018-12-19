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
import com.microsoft.java.test.plugin.searcher.JUnit4TestSearcher;
import com.microsoft.java.test.plugin.searcher.JUnit5TestSearcher;
import com.microsoft.java.test.plugin.searcher.TestFrameworkSearcher;
import com.microsoft.java.test.plugin.searcher.TestNGTestSearcher;

import org.eclipse.core.runtime.IPath;
import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.IAnnotation;
import org.eclipse.jdt.core.IClassFile;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.ISourceReference;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.lsp4j.Range;

import java.util.Arrays;
import java.util.Optional;
import java.util.stream.Collectors;

@SuppressWarnings("restriction")
public class TestSearchUtils {
    protected static final String DISPLAY_NAME_ANNOTATION_JUNIT5 = "org.junit.jupiter.api.DisplayName";

    public static final TestFrameworkSearcher[] frameworkSearchers = new TestFrameworkSearcher[] {
        new JUnit4TestSearcher(), new JUnit5TestSearcher(), new TestNGTestSearcher() };

    public static Range getRange(ICompilationUnit typeRoot, IJavaElement element) throws JavaModelException {
        final ISourceRange range = ((ISourceReference) element).getNameRange();
        return JDTUtils.toRange(typeRoot, range.getOffset(), range.getLength());
    }

    public static TestItem constructTestItem(IJavaElement element, TestLevel level) throws JavaModelException {
        return constructTestItem(element, level, null);
    }

    public static boolean isTestableClass(IType type) throws JavaModelException {
        int flags = type.getFlags();
        if (Flags.isInterface(flags) || Flags.isAbstract(flags)) {
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

    public static TestItem constructTestItem(IJavaElement element, TestLevel level, TestKind kind)
            throws JavaModelException {
        String displayName = element.getElementName();
        if (kind == TestKind.JUnit5 && element instanceof IMethod) {
            final Optional<IAnnotation> annotation = getAnnotation((IMethod) element, DISPLAY_NAME_ANNOTATION_JUNIT5);
            if (annotation.isPresent()) {
                displayName = (String) annotation.get().getMemberValuePairs()[0].getValue();
            }
        }

        return new TestItem(displayName, parseTestItemFullName(element, level),
                JDTUtils.getFileURI(element.getResource()), parseTestItemRange(element, level), level, kind,
                element.getJavaProject().getProject().getName());
    }

    public static TestKind resolveTestKindForMethod(IMethod method) {
        for (final TestFrameworkSearcher searcher : frameworkSearchers) {
            if (searcher.isTestMethod(method)) {
                return searcher.getTestKind();
            }
        }
        return null;
    }

    public static Optional<IAnnotation> getAnnotation(IMethod method, String methodAnnotation) {
        try {
            final Optional<IAnnotation> matched = Arrays.stream(method.getAnnotations())
                    .filter(annotation -> methodAnnotation.endsWith(annotation.getElementName())).findAny();
            if (!matched.isPresent()) {
                return Optional.empty();
            }
            final IAnnotation annotation = matched.get();
            if (!annotation.exists()) {
                return Optional.empty();
            }

            final String name = annotation.getElementName();
            final String[][] fullNameArr = method.getDeclaringType().resolveType(name);
            if (fullNameArr == null) {
                final ICompilationUnit cu = method.getCompilationUnit();
                if (cu != null && cu.getImport(methodAnnotation).exists()) {
                    return Optional.of(annotation);
                } else {
                    return Optional.empty();
                }
            }
            final String fullName = Arrays.stream(fullNameArr[0]).collect(Collectors.joining("."));
            return fullName.equals(methodAnnotation) ?
                Optional.of(annotation) : Optional.empty();
        } catch (final JavaModelException e) {
            return Optional.empty();
        }
    }

    public static boolean hasAnnotation(IMethod method, String methodAnnotation) {
        return getAnnotation(method, methodAnnotation).isPresent();
    }

    public static boolean isJavaElementExist(IJavaElement element) {
        return element != null && element.getResource() != null && element.getResource().exists();
    }

    public static boolean isInTestScope(IJavaElement element) throws JavaModelException {
        final IJavaProject project = element.getJavaProject();
        for (final IPath testRootPath : ProjectUtils.getTestPath(project)) {
            if (testRootPath.isPrefixOf(element.getPath())) {
                return true;
            }
        }
        return false;
    }

    public static TestLevel getTestLevelForIType(IType type) {
        if (type.getParent() instanceof ICompilationUnit) {
            return TestLevel.CLASS;
        } else {
            return TestLevel.NESTED_CLASS;
        }
    }

    public static String parseTestItemFullName(IJavaElement element, TestLevel level) {
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

    public static Range parseTestItemRange(IJavaElement element, TestLevel level) throws JavaModelException {
        switch (level) {
            case CLASS:
            case NESTED_CLASS:
                final IType type = (IType) element;
                return TestSearchUtils.getRange(type.getCompilationUnit(), type);
            case METHOD:
                final IMethod method = (IMethod) element;
                return TestSearchUtils.getRange(method.getCompilationUnit(), method);
            default:
                return null;
        }
    }
}
