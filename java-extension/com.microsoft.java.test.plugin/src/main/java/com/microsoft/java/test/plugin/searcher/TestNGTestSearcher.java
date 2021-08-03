/*******************************************************************************
* Copyright (c) 2018-2021 Microsoft Corporation and others.
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

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.core.runtime.OperationCanceledException;
import org.eclipse.core.runtime.SubProgressMonitor;
import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IMember;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IRegion;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.ITypeHierarchy;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.AST;
import org.eclipse.jdt.core.dom.ASTNode;
import org.eclipse.jdt.core.dom.ASTParser;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.dom.IAnnotationBinding;
import org.eclipse.jdt.core.dom.IBinding;
import org.eclipse.jdt.core.dom.IMethodBinding;
import org.eclipse.jdt.core.dom.ITypeBinding;
import org.eclipse.jdt.core.dom.Modifier;
import org.eclipse.jdt.core.dom.TypeDeclaration;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchMatch;
import org.eclipse.jdt.core.search.SearchParticipant;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.SearchRequestor;
import org.eclipse.jdt.internal.junit.util.CoreTestSearchEngine;

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public class TestNGTestSearcher extends BaseFrameworkSearcher {

    public TestNGTestSearcher() {
        super();
        this.testMethodAnnotations = new String[] { "org.testng.annotations.Test" };
    }

    @Override
    public TestKind getTestKind() {
        return TestKind.TestNG;
    }

    @Override
    public String getJdtTestKind() {
        return "";
    }

    @Override
    public boolean isTestMethod(final IMethodBinding methodBinding) {
        final int modifiers = methodBinding.getModifiers();
        if (Modifier.isAbstract(modifiers) || Modifier.isStatic(modifiers)) {
            return false;
        }

        if (methodBinding.isConstructor() || !"void".equals(methodBinding.getReturnType().getName())) {
            return false;
        }
        return this.findAnnotation(methodBinding.getAnnotations(), this.getTestMethodAnnotations());
    }

    @Override
    public boolean isTestClass(final IType type) throws JavaModelException {
        return internalIsTest(type, null);
    }

    /*
     * (non-Javadoc)
     *
     * @see org.testng.eclipse.launch.TestFinder#internalIsTest
     */
    private boolean internalIsTest(final IType type, final IProgressMonitor monitor) throws JavaModelException {
        if (CoreTestSearchEngine.isAccessibleClass(type)) {
            final ASTParser parser = ASTParser.newParser(AST.JLS14);
            /*
             * TODO: When bug 156352 is fixed: parser.setProject(type.getJavaProject());
             * IBinding[] bindings= parser.createBindings(new IJavaElement[] { type },
             * monitor); if (bindings.length == 1 && bindings[0] instanceof ITypeBinding) {
             * ITypeBinding binding= (ITypeBinding) bindings[0]; return isTest(binding); }
             */

            if (type.getCompilationUnit() != null) {
                parser.setSource(type.getCompilationUnit());
            } else if (!isAvailable(type.getSourceRange())) { // class file with no source
                parser.setProject(type.getJavaProject());
                final IBinding[] bindings = parser.createBindings(new IJavaElement[] { type }, monitor);
                if (bindings.length == 1 && bindings[0] instanceof ITypeBinding) {
                    final ITypeBinding binding = (ITypeBinding) bindings[0];
                    return isTest(binding);
                }
                return false;
            } else {
                parser.setSource(type.getClassFile());
            }
            parser.setFocalPosition(0);
            parser.setIgnoreMethodBodies(true);
            parser.setResolveBindings(true);
            final CompilationUnit root = (CompilationUnit) parser.createAST(monitor);
            final ASTNode node = root.findDeclaringNode(type.getKey());
            if (node instanceof TypeDeclaration) {
                final ITypeBinding binding = ((TypeDeclaration) node).resolveBinding();
                if (binding != null) {
                    return isTest(binding);
                }
            }
        }
        return false;
    }

    private boolean isAvailable(final ISourceRange range) {
        return range != null && range.getOffset() != -1;
    }

    private boolean isTest(final ITypeBinding binding) {
        if (Modifier.isAbstract(binding.getModifiers())) {
            return false;
        }

        return annotatesAtLeastOneMethod(binding, "org.testng.annotations.Test");
    }

    public boolean annotatesAtLeastOneMethod(ITypeBinding type, final String qualifiedName) {
        while (type != null) {
            final IMethodBinding[] declaredMethods = type.getDeclaredMethods();
            for (int i = 0; i < declaredMethods.length; i++) {
                final IMethodBinding curr = declaredMethods[i];
                if (annotates(curr.getAnnotations(), qualifiedName)) {
                    return true;
                }
            }
            type = type.getSuperclass();
        }
        return false;
    }

    private boolean annotates(final IAnnotationBinding[] annotations, final String qualifiedName) {
        for (int i = 0; i < annotations.length; i++) {
            final ITypeBinding annotationType = annotations[i].getAnnotationType();
            if (annotationType != null && (annotationType.getQualifiedName().equals(qualifiedName))) {
                return true;
            }
        }
        return false;
    }

    /*
     * (non-Javadoc)
     *
     * @see org.testng.eclipse.launch.TestFinder#findTestsInContainer
     */
    private void findTestsInContainer(final IJavaElement element, final Set result, IProgressMonitor pm)
            throws CoreException {
        if (element == null || result == null) {
            throw new IllegalArgumentException();
        }

        if (element instanceof IType) {
            if (internalIsTest((IType) element, pm)) {
                result.add(element);
                return;
            }
        }

        if (pm == null) {
            pm = new NullProgressMonitor();
        }

        try {
            final IRegion region = CoreTestSearchEngine.getRegion(element);
            final ITypeHierarchy hierarchy = JavaCore.newTypeHierarchy(region, null, new SubProgressMonitor(pm, 1));
            final IType[] allClasses = hierarchy.getAllClasses();

            // search for all types with references to RunWith and Test and all subclasses
            final Set<IType> candidates = new HashSet<>(allClasses.length);
            final SearchRequestor requestor = new AnnotationSearchRequestor(hierarchy, candidates);
            final IJavaSearchScope scope = SearchEngine.createJavaSearchScope(allClasses, IJavaSearchScope.SOURCES);
            final int matchRule = SearchPattern.R_EXACT_MATCH | SearchPattern.R_CASE_SENSITIVE;
            final SearchPattern annotationsPattern = SearchPattern.createPattern("org.testng.annotations.Test",
                    IJavaSearchConstants.ANNOTATION_TYPE, IJavaSearchConstants.ANNOTATION_TYPE_REFERENCE, matchRule);
            final SearchParticipant[] searchParticipants = new SearchParticipant[] {
                    SearchEngine.getDefaultSearchParticipant() };
            new SearchEngine().search(annotationsPattern, searchParticipants, scope, requestor,
                    new SubProgressMonitor(pm, 2));

            // find all classes in the region
            for (final IType curr : candidates) {
                if (CoreTestSearchEngine.isAccessibleClass(curr) && !Flags.isAbstract(curr.getFlags()) &&
                        region.contains(curr)) {
                    result.add(curr);
                }
            }
        } finally {
            pm.done();
        }
    }

    @Override
    public Set<IType> findTestItemsInContainer(IJavaElement element, IProgressMonitor monitor) throws CoreException {
        final Set<IType> types = new HashSet<>();
        try {
            this.findTestsInContainer(element, types, monitor);
        } catch (OperationCanceledException e) {
            return Collections.emptySet();
        }
        return types;
    }
}

/*
     * (non-Javadoc)
     *
     * @see org.testng.eclipse.launch.AnnotationSearchRequestor
     */
class AnnotationSearchRequestor extends SearchRequestor {

    private final Collection<IType> fResult;
    private final ITypeHierarchy fHierarchy;

    public AnnotationSearchRequestor(final ITypeHierarchy hierarchy, final Collection<IType> result) {
        fHierarchy = hierarchy;
        fResult = result;
    }

    public void acceptSearchMatch(final SearchMatch match) throws CoreException {
        if (match.getAccuracy() == SearchMatch.A_ACCURATE && !match.isInsideDocComment()) {
            final Object element = match.getElement();
            if (element instanceof IType || element instanceof IMethod) {
                final IMember member = (IMember) element;
                final IType type = member.getElementType() == IJavaElement.TYPE ? (IType) member
                        : member.getDeclaringType();
                addTypeAndSubtypes(type);
            }
        }
    }

    private void addTypeAndSubtypes(final IType type) {
        if (fResult.add(type)) {
            final IType[] subclasses = fHierarchy.getSubclasses(type);
            for (int i = 0; i < subclasses.length; i++) {
                addTypeAndSubtypes(subclasses[i]);
            }
        }
    }
}
