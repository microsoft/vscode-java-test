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
