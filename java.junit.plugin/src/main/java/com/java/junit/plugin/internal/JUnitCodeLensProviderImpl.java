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
import org.eclipse.jdt.ls.core.internal.codelens.CodeLensProvider;
import org.eclipse.jdt.ls.core.internal.preferences.PreferenceManager;
import org.eclipse.jdt.ls.core.internal.preferences.Preferences;
import org.eclipse.lsp4j.CodeLens;
import org.eclipse.lsp4j.Command;

public abstract class JUnitCodeLensProviderImpl implements CodeLensProvider {
	private PreferenceManager preferenceManager;
	
	public abstract String commandLabel();
	
	public abstract String commandName();
	
	public abstract String codeLensEnableKey();
	
	@Override
	public void setPreferencesManager(PreferenceManager pm) {
		this.preferenceManager = pm;
	}
	
	@Override
	public List<CodeLens> collectCodeLenses(ITypeRoot root, IProgressMonitor monitor) throws JavaModelException {
		IJavaElement[] elements = root.getChildren();
		ArrayList<CodeLens> lenses = new ArrayList<>(elements.length);
		collectCodeLensesCore(root, elements, lenses, monitor);
		return lenses;
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
	
	private boolean collectCodeLensesCore(ITypeRoot root, IJavaElement[] elements, ArrayList<CodeLens> lenses, IProgressMonitor monitor) throws JavaModelException {
		if (!isJunitCodeLensEnabled()) {
			return false;
		}
		boolean hasTests = false;
		for (IJavaElement element : elements) {
			if (monitor.isCanceled()) {
				return false;
			}
			if (element.getElementType() == IJavaElement.TYPE && ((IType) element).isClass()) {
				boolean res = collectCodeLensesCore(root, ((IType) element).getChildren(), lenses, monitor);
				if (res) {
					lenses.add(createCodeLens(element, root));
					hasTests = true;
				}
			} else if (element.getElementType() == IJavaElement.METHOD && !JDTUtils.isHiddenGeneratedElement(element)) {
				IMethod method = (IMethod) element;
				if (JUnitUtility.isTestMethod(method, "org.junit.Test")) {
					lenses.add(createCodeLens(element, root));
					hasTests = true;
				}
			}
		}
		return hasTests;
	}
	
	private boolean isJunitCodeLensEnabled() {
		Preferences prefs = this.preferenceManager.getPreferences();
		if (!prefs.isCodeLensEnabled()) {
			return false;
		}
		Map<String, Object> config = prefs.asMap();
		return getBoolean(config, codeLensEnableKey(), true);
	}
}
