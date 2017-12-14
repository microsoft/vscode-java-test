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

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMember;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IPackageFragmentRoot;
import org.eclipse.jdt.core.IRegion;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.ISourceReference;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.ITypeHierarchy;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchMatch;
import org.eclipse.jdt.core.search.SearchParticipant;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.SearchRequestor;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.ResourceUtils;
import org.eclipse.lsp4j.Range;

import com.microsoft.java.test.plugin.internal.testsuit.TestLevel;
import com.microsoft.java.test.plugin.internal.testsuit.TestSuite;

public class JUnitTestSearcher {
	private final String JUNIT_TEST_ANNOTATION = "org.junit.Test";
	private final String JUNIT_RUN_WITH_ANNOTATION = "org.junit.runner.RunWith";
	
	public List<TestSuite> searchAllTests(IProgressMonitor monitor) {
		SearchPattern runWithPattern = SearchPattern.createPattern(
				JUNIT_RUN_WITH_ANNOTATION,
				IJavaSearchConstants.ANNOTATION_TYPE,
				IJavaSearchConstants.ANNOTATION_TYPE_REFERENCE,
				SearchPattern.R_EXACT_MATCH | SearchPattern.R_CASE_SENSITIVE);
		SearchPattern testPattern = SearchPattern.createPattern(
				JUNIT_TEST_ANNOTATION,
				IJavaSearchConstants.ANNOTATION_TYPE,
				IJavaSearchConstants.ANNOTATION_TYPE_REFERENCE,
				SearchPattern.R_EXACT_MATCH | SearchPattern.R_CASE_SENSITIVE);
		SearchPattern pattern = SearchPattern.createOrPattern(runWithPattern, testPattern);
		List<TestSuite> tests = new ArrayList<>();
		HashSet<IType> testClasses = new HashSet<>();

		SearchRequestor requestor = new SearchRequestor() {
			@Override
			public void acceptSearchMatch(SearchMatch match) throws CoreException {

				Object element = match.getElement();
				if (element instanceof IType || element instanceof IMethod) {
					IMember member = (IMember) element;
					IType type = member.getElementType() == IJavaElement.TYPE ? (IType) member
							: member.getDeclaringType();
					testClasses.add(type);
				}
			}
		};

		try {
		    IJavaSearchScope scope = createSearchScope();
			new SearchEngine().search(
					pattern,
					new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant()},
					scope,
					requestor,
					monitor);
			for (IType type : testClasses) {
				if (JUnitUtility.isAccessibleClass(type) &&
						!Flags.isAbstract(type.getFlags())) {
					TestSuite parent = getTestSuite(type);
					tests.add(parent);
					int parentIndex = tests.size() - 1;
					int childIndex = parentIndex + 1;
					List<Integer> children = new ArrayList<>();
					for (IMethod m : type.getMethods()) {
						if (JUnitUtility.isTestMethod(m, "Test")) {
							TestSuite child = getTestSuite(m);
							child.setParent(parentIndex);
							tests.add(child);
							children.add(childIndex);
							childIndex++;
						}
					}
					parent.setChildren(children);
				}
			}
		} catch (CoreException e) {
			// ignore
		}
		return tests;
	}
	
	private static IJavaSearchScope createSearchScope() throws JavaModelException {
		IJavaProject[] projects = JavaCore.create(ResourcesPlugin.getWorkspace().getRoot()).getJavaProjects();
		return SearchEngine.createJavaSearchScope(projects, IJavaSearchScope.SOURCES);
	}
	
	private TestSuite getTestSuite(IMember member) throws JavaModelException {
		ICompilationUnit unit = member.getCompilationUnit();
		String uri = ResourceUtils.toClientUri(JDTUtils.toUri(unit));
		if (member.getElementType() == IJavaElement.TYPE) {
			IType type = (IType)member;
			return new TestSuite(
					getRange(unit, member),
					uri,
					type.getFullyQualifiedName(),
					type.getPackageFragment().getElementName(),
					TestLevel.Class);
		} else {
			IType type = ((IMethod)member).getDeclaringType();
			return new TestSuite(
					getRange(unit, member),
					uri,
					type.getFullyQualifiedName()  + "#" + member.getElementName(),
					type.getPackageFragment().getElementName(),
					TestLevel.Method);
		}
	}
	
	private Range getRange(ICompilationUnit typeRoot, IJavaElement element) throws JavaModelException {
		ISourceRange r = ((ISourceReference) element).getNameRange();
		return JDTUtils.toRange(typeRoot, r.getOffset(), r.getLength());
	}
}
