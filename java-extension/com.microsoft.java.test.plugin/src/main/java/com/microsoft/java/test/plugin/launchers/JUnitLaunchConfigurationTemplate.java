/*******************************************************************************
 * Copyright (c) 2019 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.launchers;

public class JUnitLaunchConfigurationTemplate {

    //@formatter:off
    public static final String JUNIT_TEMPLATE = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n" +
        "<launchConfiguration type=\"org.eclipse.jdt.junit.launchconfig\">\n" +
          "<listAttribute key=\"org.eclipse.debug.core.MAPPED_RESOURCE_PATHS\">\n" +
          "</listAttribute>\n" +
          "<listAttribute key=\"org.eclipse.debug.core.MAPPED_RESOURCE_TYPES\">\n" +
          "</listAttribute>\n" +
          "<booleanAttribute key=\"org.eclipse.jdt.junit.KEEPRUNNING_ATTR\" value=\"false\"/>\n" +
          "<stringAttribute key=\"org.eclipse.jdt.junit.TEST_KIND\" value=\"${testKind}\"/>\n" +
          "<stringAttribute key=\"org.eclipse.jdt.launching.MAIN_TYPE\" value=\"${mainType}\"/>\n" +
          "<stringAttribute key=\"org.eclipse.jdt.launching.VM_ARGUMENTS\" value=\"-ea\"/>\n" +
        "</launchConfiguration>\n";
    //@formatter:on
}
