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
package com.java.junit.plugin.internal;

import static org.eclipse.jdt.ls.core.internal.handlers.MapFlattener.getBoolean;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.ITypeRoot;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.launching.JavaRuntime;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.codelens.CodeLensContext;
import org.eclipse.jdt.ls.core.internal.codelens.CodeLensProvider;
import org.eclipse.jdt.ls.core.internal.preferences.PreferenceManager;
import org.eclipse.jdt.ls.core.internal.preferences.Preferences;
import org.eclipse.lsp4j.CodeLens;
import org.eclipse.lsp4j.Command;

public abstract class JUnitCodeLensProviderImpl implements CodeLensProvider {
	private PreferenceManager preferenceManager;
	private final String annotation = "Test";
	
	public abstract String commandLabel();
	
	public abstract String commandName();
	
	public abstract String codeLensEnableKey();
	
	@Override
	public void setPreferencesManager(PreferenceManager pm) {
		this.preferenceManager = pm;
	}

	@Override
	public CodeLens resolveCodeLens(CodeLens lens, IProgressMonitor monitor) {
		if (lens == null) {
			return null;
		}
		List<Object> data = (List<Object>) lens.getData();
		Map<String, Object> position = (Map<String, Object>) data.get(1);
		String uri = (String) data.get(0);
		try {
			ICompilationUnit unit = JDTUtils.resolveCompilationUnit(uri);
			if (unit != null) {
				IJavaElement element = JDTUtils.findElementAtSelection(unit, ((Double) position.get("line")).intValue(), ((Double) position.get("character")).intValue(), this.preferenceManager, monitor);
				List<String> suite = new ArrayList<>();
				if (element instanceof IType) {
					suite.add(((IType) element).getFullyQualifiedName());
				} else {
					String parent = ((IType) element.getParent()).getFullyQualifiedName();
					suite.add(parent + "#" + element.getElementName());
				}
				String[] classpaths = JavaRuntime.computeDefaultRuntimeClassPath(unit.getJavaProject());
				Command c = new Command(commandLabel(), commandName(), Arrays.asList(uri, classpaths, suite));
				lens.setCommand(c);
				return lens;
			}
		} catch (CoreException e) {
			System.out.println("Problem resolving code lens");
		}
		return lens;
	}

	@Override
	public int visit(IType type, CodeLensContext context, IProgressMonitor monitor) throws JavaModelException {
		if (!isJunitCodeLensEnabled()) {
			return 0;
		}

		if (!type.isClass()) {
			return 0;
		}
		
		if (!JUnitUtility.isTestClass(type, annotation)) {
			return 0;
		}
		CodeLens lens = createCodeLens(type, context.getRoot());
		context.addCodeLens(lens);
		return 1;
	}

	@Override
	public int visit(IMethod method, CodeLensContext context, IProgressMonitor monitor) throws JavaModelException {
		if (!isJunitCodeLensEnabled()) {
			return 0;
		}
		
		if (!JUnitUtility.isTestMethod(method, annotation)) {
			return 0;
		}

		CodeLens lens = createCodeLens(method, context.getRoot());
		context.addCodeLens(lens);
		return 1;
	}
	
	private boolean isJunitCodeLensEnabled() {
		Preferences prefs = this.preferenceManager.getPreferences();
		if (!prefs.isCodeLensEnabled()) {
			return false;
		}
		boolean defaultValue = true;
		Map<String, Object> config = prefs.asMap();
		if (config == null) {
			return defaultValue;
		}
		return getBoolean(config, codeLensEnableKey(), defaultValue);
	}
}
