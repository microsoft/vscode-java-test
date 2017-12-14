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
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import javax.swing.ProgressMonitor;

import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.ISourceReference;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.ResourceUtils;
import org.eclipse.lsp4j.Range;

import com.microsoft.java.test.plugin.internal.testsuit.TestLevel;
import com.microsoft.java.test.plugin.internal.testsuit.TestSuite;

public class JUnitTestFetcher {

	public List<TestSuite> fetchTests(List<Object> arguments, IProgressMonitor monitor) {
		if (arguments == null || arguments.size() == 0) {
			return Collections.emptyList();
		}
		String uri = (String)arguments.get(0);
		final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(uri);
		if (unit == null || !unit.getResource().exists() || monitor.isCanceled()) {
			return Collections.emptyList();
		}
		try {
			IJavaElement[] elements = unit.getChildren();
			RelationShipCache relations = new RelationShipCache();
			List<TestSuite> lenses = fetchCore(unit, elements, monitor, relations);
			relations.ToIndex(lenses, monitor);
			if (monitor.isCanceled()) {
				lenses.clear();
			}
			return lenses;
		} catch (JavaModelException e) {
			System.out.println("Problem getting code lenses for" + unit.getElementName());
		}
		return Collections.emptyList();
	}
	
	private List<TestSuite> fetchCore(ICompilationUnit unit, IJavaElement[] elements, IProgressMonitor monitor, RelationShipCache relations) throws JavaModelException {
		ArrayList<TestSuite> suites = new ArrayList<>(elements.length);
		String uri = getUri(unit);
		for (IJavaElement element : elements) {
			if (monitor.isCanceled()) {
				return Collections.emptyList();
			}
			if (element.getElementType() == IJavaElement.TYPE) {
				IType type = (IType)element;
				if (!JUnitUtility.isAccessibleClass(type) || Flags.isAbstract(type.getFlags())) {
					continue;
				}
				List<TestSuite> children = fetchCore(unit, type.getChildren(), monitor, relations);
				suites.addAll(children);
				if (children.size() > 0 || type.getAnnotation("RunWith").exists()) {
					String test = type.getFullyQualifiedName();
					TestSuite cur = new TestSuite(
							getRange(unit, element),
							uri,
							test,
							type.getPackageFragment().getElementName(),
							TestLevel.Class);
					List<TestSuite> directChildren = children.stream().filter(c -> c.getParent() == null).collect(Collectors.toList());
					relations.children.put(cur, directChildren);
					for (TestSuite c : directChildren) {
						relations.parent.put(c, cur);
					}
					suites.add(cur);
				}
				
			} else if (element.getElementType() == IJavaElement.METHOD && !JDTUtils.isHiddenGeneratedElement(element)) {
				if (JUnitUtility.isTestMethod((IMethod)element, "Test")) {
					IType type = ((IMethod)element).getDeclaringType();
					String test = type.getFullyQualifiedName() + "#" + element.getElementName();
					suites.add(new TestSuite(
							getRange(unit, element),
							uri,
							test,
							type.getPackageFragment().getElementName(),
							TestLevel.Method));
				}
			}
		}
		return suites;
	}
	
	private Range getRange(ICompilationUnit typeRoot, IJavaElement element) throws JavaModelException {
		ISourceRange r = ((ISourceReference) element).getNameRange();
		final Range range = JDTUtils.toRange(typeRoot, r.getOffset(), r.getLength());
		return range;
	}
	
	private String getUri(ICompilationUnit typeRoot) {
		return ResourceUtils.toClientUri(JDTUtils.toUri(typeRoot));
	}
	
	private static class RelationShipCache {
		public HashMap<TestSuite, List<TestSuite>> children;
		public HashMap<TestSuite, TestSuite> parent;
		
		public RelationShipCache() {
			children = new HashMap<>();
			parent = new HashMap<>();
		}
		
		public void ToIndex(List<TestSuite> tests, IProgressMonitor monitor) {
			if (monitor.isCanceled()) {
				return;
			}
			Map<TestSuite, Integer> indices = IntStream.range(0, tests.size()).boxed().collect(Collectors.toMap(tests::get,i -> i));
			for(TestSuite t : tests) {
				List<TestSuite> cc = children.get(t);
				if (cc != null) {
					t.setChildren(cc.stream().map(c -> indices.get(c)).collect(Collectors.toList()));
				}
				TestSuite p = parent.get(t);
				if (p != null) {
					t.setParent(indices.get(p));
				}
			}
		}
	}
}
