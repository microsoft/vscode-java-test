package com.java.junit.plugin.internal;

import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.JavaModelException;

public class JUnitUtility {
	public static boolean isTestMethod(IMethod method, String annotation) {
		int flags;
		try {
			flags = method.getFlags();
			// 'V' is void signature
			return !(method.isConstructor() || !Flags.isPublic(flags) || Flags.isAbstract(flags) || Flags.isStatic(flags) || !"V".equals(method.getReturnType())) && method.getAnnotation(annotation) != null;
		} catch (JavaModelException e) {
			// ignore
			return false;
		}
	}
}
