package com.java.junit.plugin.internal;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

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

import com.java.junit.plugin.internal.testsuit.TestLevel;
import com.java.junit.plugin.internal.testsuit.TestSuite;

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
			List<TestSuite> lenses = fetchCore(unit, elements, monitor);
			if (monitor.isCanceled()) {
				lenses.clear();
			}
			return lenses;
		} catch (JavaModelException e) {
			System.out.println("Problem getting code lenses for" + unit.getElementName());
		}
		return Collections.emptyList();
	}
	
	private List<TestSuite> fetchCore(ICompilationUnit unit, IJavaElement[] elements, IProgressMonitor monitor) throws JavaModelException {
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
				List<TestSuite> children = fetchCore(unit, type.getChildren(), monitor);
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
					cur.setChildren(directChildren);
					for (TestSuite c : directChildren) {
						c.setParent(cur);
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
}
