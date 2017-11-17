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

public class JUnitRunTestCodeLensProvider extends JUnitCodeLensProviderImpl {

	private static final String JAVA_RUN_TEST_COMMAND = "java.run.test";
	private static final String RUNTEST_TYPE = "runtest";
	private static final String JAVA_RUN_TEST_LABEL = "Run Test";
	
	/**
	 * Preference key to enable/disable run test code lenses.
	 */
	public static final String RUN_TESTS_CODE_LENS_ENABLED_KEY = "java.runTestsCodeLens.enabled";

	@Override
	public String getType() {
		return RUNTEST_TYPE;
	}

	@Override
	public String commandLabel() {
		return JAVA_RUN_TEST_LABEL;
	}

	@Override
	public String commandName() {
		return JAVA_RUN_TEST_COMMAND;
	}

	@Override
	public String codeLensEnableKey() {
		return RUN_TESTS_CODE_LENS_ENABLED_KEY;
	}

}
