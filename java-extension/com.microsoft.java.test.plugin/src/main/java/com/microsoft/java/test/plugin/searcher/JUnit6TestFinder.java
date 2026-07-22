/*******************************************************************************
 * Copyright (c) 2017-2025 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.searcher;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.SubMonitor;
import org.eclipse.jdt.core.IClassFile;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IRegion;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.ITypeHierarchy;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.AST;
import org.eclipse.jdt.core.dom.ASTNode;
import org.eclipse.jdt.core.dom.ASTParser;
import org.eclipse.jdt.core.dom.AbstractTypeDeclaration;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.dom.IAnnotationBinding;
import org.eclipse.jdt.core.dom.IBinding;
import org.eclipse.jdt.core.dom.IMethodBinding;
import org.eclipse.jdt.core.dom.ITypeBinding;
import org.eclipse.jdt.core.dom.Modifier;
import org.eclipse.jdt.core.dom.RecordDeclaration;
import org.eclipse.jdt.core.dom.TypeDeclaration;
import org.eclipse.jdt.internal.junit.JUnitCorePlugin;
import org.eclipse.jdt.internal.junit.launcher.ITestFinder;
import org.eclipse.jdt.internal.junit.util.CoreTestSearchEngine;

import java.util.HashSet;
import java.util.Set;

/**
 * Test finder for JUnit 6 (Jupiter API 6.x).
 * 
 * <p>This class is similar to JUnit5TestFinder but uses the JUnit 6 loader
 * to properly detect tests in JUnit 6 projects.
 * 
 * <p><b>Why this class exists:</b> Eclipse JDT does not yet have built-in support for JUnit 6.
 * This is a custom implementation that will be needed until Eclipse JDT adds official JUnit 6 support.
 * 
 * <p><b>Key differences from JUnit5TestFinder:</b>
 * <ul>
 *   <li>Uses custom loader ID "org.eclipse.jdt.junit.loader.junit6"</li>
 *   <li>Filters out abstract classes explicitly</li>
 *   <li>Only supports JUnit Jupiter annotations (not JUnit 4 vintage)</li>
 * </ul>
 * 
 * @see org.eclipse.jdt.internal.junit.launcher.JUnit5TestFinder
 */
public class JUnit6TestFinder implements ITestFinder {

    /**
     * Custom loader ID for JUnit 6 tests.
     * This is used by Eclipse JDT's classpath resolution mechanism to identify
     * JUnit 6 test runtime dependencies.
     */
    private static final String JUNIT6_LOADER = "org.eclipse.jdt.junit.loader.junit6";

    private static class Annotation {

        private static final Annotation RUN_WITH = new Annotation("org.junit.runner.RunWith"); //$NON-NLS-1$

        private static final Annotation TEST_4 = new Annotation("org.junit.Test"); //$NON-NLS-1$

        private static final Annotation SUITE = new Annotation("org.junit.platform.suite.api.Suite"); //$NON-NLS-1$

        private static final Annotation TESTABLE = new Annotation(JUnitCorePlugin.JUNIT5_TESTABLE_ANNOTATION_NAME);

        private static final Annotation NESTED = new Annotation(JUnitCorePlugin.JUNIT5_JUPITER_NESTED_ANNOTATION_NAME);

        private final String fName;

        private Annotation(String name) {
            fName = name;
        }

        String getName() {
            return fName;
        }

        boolean annotatesAtLeastOneInnerClass(ITypeBinding type) {
            if (type == null) {
                return false;
            }
            if (annotatesDeclaredTypes(type)) {
                return true;
            }
            final ITypeBinding superClass = type.getSuperclass();
            if (annotatesAtLeastOneInnerClass(superClass)) {
                return true;
            }
            final ITypeBinding[] interfaces = type.getInterfaces();
            for (final ITypeBinding intf : interfaces) {
                if (annotatesAtLeastOneInnerClass(intf)) {
                    return true;
                }
            }
            return false;
        }

        private boolean annotatesDeclaredTypes(ITypeBinding type) {
            final ITypeBinding[] declaredTypes = type.getDeclaredTypes();
            for (final ITypeBinding declaredType : declaredTypes) {
                if (isNestedClass(declaredType)) {
                    return true;
                }
            }
            return false;
        }

        private boolean isNestedClass(ITypeBinding type) {
            final int modifiers = type.getModifiers();
            if (type.isInterface() || Modifier.isPrivate(modifiers) || Modifier.isStatic(modifiers)) {
                return false;
            }
            if (annotates(type.getAnnotations())) {
                return true;
            }
            return false;
        }

        boolean annotatesTypeOrSuperTypes(ITypeBinding type) {
            while (type != null) {
                if (annotates(type.getAnnotations())) {
                    return true;
                }
                type = type.getSuperclass();
            }
            return false;
        }

        boolean annotatesAtLeastOneMethod(ITypeBinding type) {
            if (type == null) {
                return false;
            }
            if (annotatesDeclaredMethods(type)) {
                return true;
            }
            final ITypeBinding superClass = type.getSuperclass();
            if (annotatesAtLeastOneMethod(superClass)) {
                return true;
            }
            final ITypeBinding[] interfaces = type.getInterfaces();
            for (final ITypeBinding intf : interfaces) {
                if (annotatesAtLeastOneMethod(intf)) {
                    return true;
                }
            }
            return false;
        }

        private boolean annotatesDeclaredMethods(ITypeBinding type) {
            final IMethodBinding[] declaredMethods = type.getDeclaredMethods();
            for (final IMethodBinding curr : declaredMethods) {
                if (annotates(curr.getAnnotations())) {
                    return true;
                }
            }
            return false;
        }

        // See JUnitLaunchConfigurationTab#isAnnotatedWithTestable also.
        private boolean annotates(IAnnotationBinding[] annotations) {
            for (final IAnnotationBinding annotation : annotations) {
                if (annotation == null) {
                    continue;
                }
                if (matchesName(annotation.getAnnotationType())) {
                    return true;
                }
                if (TESTABLE.getName().equals(fName) || NESTED.getName().equals(fName)) {
                    final Set<ITypeBinding> hierarchy = new HashSet<>();
                    if (matchesNameInAnnotationHierarchy(annotation, hierarchy)) {
                        return true;
                    }
                }
            }
            return false;
        }

        private boolean matchesName(ITypeBinding annotationType) {
            if (annotationType != null) {
                final String qualifiedName = annotationType.getQualifiedName();
                if (qualifiedName.equals(fName)) {
                    return true;
                }
            }
            return false;
        }

        private boolean matchesNameInAnnotationHierarchy(IAnnotationBinding annotation, Set<ITypeBinding> hierarchy) {
            final ITypeBinding type = annotation.getAnnotationType();
            if (type != null) {
                for (final IAnnotationBinding annotationBinding : type.getAnnotations()) {
                    if (annotationBinding != null) {
                        final ITypeBinding annotationType = annotationBinding.getAnnotationType();
                        if (annotationType != null && hierarchy.add(annotationType)) {
                            if (matchesName(annotationType) ||
                                    matchesNameInAnnotationHierarchy(annotationBinding, hierarchy)) {
                                return true;
                            }
                        }
                    }
                }
            }
            return false;
        }
    }

    public JUnit6TestFinder() {
    }

    @Override
    public void findTestsInContainer(IJavaElement element, Set<IType> result, IProgressMonitor pm)
            throws CoreException {
        if (element == null || result == null) {
            throw new IllegalArgumentException();
        }

        if (element instanceof IType) {
            final IType type = (IType) element;
            if (internalIsTest(type, pm)) {
                result.add(type);
            }
            return;
        }

        final SubMonitor subMonitor = SubMonitor.convert(pm, "Searching for JUnit 6 tests...", 4);

        final IRegion region = CoreTestSearchEngine.getRegion(element);
        final ITypeHierarchy hierarchy = JavaCore.newTypeHierarchy(region, null, subMonitor.split(1));
        final IType[] allClasses = hierarchy.getAllClasses();

        for (final IType type : allClasses) {
            if (region.contains(type) && internalIsTest(type, pm)) {
                addTypeAndSubtypes(type, result, hierarchy);
            }
        }

        // Also find JUnit 3 style tests that implement junit.framework.Test
        final IType testInterface = element.getJavaProject().findType("junit.framework.Test");
        if (testInterface != null) {
            CoreTestSearchEngine.findTestImplementorClasses(hierarchy, testInterface, region, result);
        }

        CoreTestSearchEngine.findSuiteMethods(element, result, subMonitor.split(1));
    }

    private void addTypeAndSubtypes(IType type, Set<IType> result, ITypeHierarchy hierarchy) {
        if (result.add(type)) {
            final IType[] subclasses = hierarchy.getSubclasses(type);
            for (final IType subclass : subclasses) {
                addTypeAndSubtypes(subclass, result, hierarchy);
            }
        }
    }

    @Override
    public boolean isTest(IType type) throws JavaModelException {
        return internalIsTest(type, null);
    }

    private boolean internalIsTest(IType type, IProgressMonitor pm) throws JavaModelException {
        // Use JUnit 6 loader to check if the class is accessible
        if (!CoreTestSearchEngine.isAccessibleClass(type, JUNIT6_LOADER)) {
            return false;
        }

        if (CoreTestSearchEngine.hasSuiteMethod(type)) {
            return true;
        }

        final ASTParser parser = ASTParser.newParser(AST.getJLSLatest());

        if (type.getCompilationUnit() != null) {
            parser.setSource(type.getCompilationUnit());
        } else if (!isAvailable(type.getSourceRange())) {
            parser.setProject(type.getJavaProject());
            final IBinding[] bindings = parser.createBindings(new IJavaElement[] { type }, pm);
            if (bindings.length == 1 && bindings[0] instanceof ITypeBinding) {
                final ITypeBinding typeBinding = (ITypeBinding) bindings[0];
                return isTest(typeBinding);
            }
            return false;
        } else {
            final IClassFile classFile = type.getClassFile();
            if (classFile != null) {
                parser.setSource(classFile);
            } else {
                return false;
            }
        }

        parser.setFocalPosition(0);
        parser.setResolveBindings(true);

        final CompilationUnit cu = (CompilationUnit) parser.createAST(pm);
        final ASTNode node = cu.findDeclaringNode(type.getKey());

        if (node instanceof TypeDeclaration || node instanceof RecordDeclaration) {
            final AbstractTypeDeclaration typeDecl = (AbstractTypeDeclaration) node;
            final ITypeBinding binding = typeDecl.resolveBinding();
            if (binding != null) {
                return isTest(binding);
            }
        }

        return false;
    }

    private static boolean isAvailable(ISourceRange range) {
        return range != null && range.getOffset() != -1;
    }

    private boolean isTest(ITypeBinding binding) {
        if (binding == null || Modifier.isAbstract(binding.getModifiers())) {
            return false;
        }

        if (Annotation.RUN_WITH.annotatesTypeOrSuperTypes(binding) ||
                Annotation.SUITE.annotatesTypeOrSuperTypes(binding) ||
                Annotation.TEST_4.annotatesAtLeastOneMethod(binding) ||
                Annotation.TESTABLE.annotatesAtLeastOneMethod(binding) ||
                Annotation.TESTABLE.annotatesTypeOrSuperTypes(binding) ||
                Annotation.NESTED.annotatesAtLeastOneInnerClass(binding)) {
            return true;
        }
        return CoreTestSearchEngine.isTestImplementor(binding);
    }

    private boolean hasTestMethods(ITypeBinding typeBinding) {
        for (final IMethodBinding method : typeBinding.getDeclaredMethods()) {
            if (isTestMethod(method)) {
                return true;
            }
        }
        return false;
    }

    private boolean isTestMethod(IMethodBinding method) {
        for (final IAnnotationBinding annotation : method.getAnnotations()) {
            if (annotation == null) {
                continue;
            }
            final ITypeBinding annotationType = annotation.getAnnotationType();
            if (annotationType != null) {
                // Check for @Testable meta-annotation
                if (isTestableAnnotation(annotationType, new HashSet<>())) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Checks if an annotation or its meta-annotations is a JUnit testable annotation.
     * This supports JUnit Platform's meta-annotation model where custom annotations
     * can be annotated with @Testable to make them test annotations.
     * 
     * @param annotationType the annotation type to check
     * @param visited set of already visited annotations to prevent infinite recursion
     * @return true if this is a testable annotation or has @Testable in its hierarchy
     */
    private boolean isTestableAnnotation(ITypeBinding annotationType, Set<ITypeBinding> visited) {
        if (annotationType == null || !visited.add(annotationType)) {
            return false;
        }

        final String qualifiedName = annotationType.getQualifiedName();
        
        // Direct check for @Testable meta-annotation
        if ("org.junit.platform.commons.annotation.Testable".equals(qualifiedName)) {
            return true;
        }

        // Check for common JUnit Jupiter test annotations
        if (qualifiedName.startsWith("org.junit.jupiter.api.")) {
            if (qualifiedName.equals("org.junit.jupiter.api.Test") ||
                qualifiedName.equals("org.junit.jupiter.api.RepeatedTest") ||
                qualifiedName.equals("org.junit.jupiter.api.ParameterizedTest") ||
                qualifiedName.equals("org.junit.jupiter.api.TestFactory") ||
                qualifiedName.equals("org.junit.jupiter.api.TestTemplate")) {
                return true;
            }
        }

        // Check meta-annotations
        for (final IAnnotationBinding metaAnnotation : annotationType.getAnnotations()) {
            if (metaAnnotation == null) {
                continue;
            }
            final ITypeBinding metaAnnotationType = metaAnnotation.getAnnotationType();
            if (isTestableAnnotation(metaAnnotationType, visited)) {
                return true;
            }
        }

        return false;
    }

    private boolean isNestedTestClass(ITypeBinding nestedType) {
        for (final IAnnotationBinding annotation : nestedType.getAnnotations()) {
            if (annotation == null) {
                continue;
            }
            final ITypeBinding annotationType = annotation.getAnnotationType();
            if (annotationType != null && 
                "org.junit.jupiter.api.Nested".equals(annotationType.getQualifiedName())) {
                return isTest(nestedType);
            }
        }
        return false;
    }
}
