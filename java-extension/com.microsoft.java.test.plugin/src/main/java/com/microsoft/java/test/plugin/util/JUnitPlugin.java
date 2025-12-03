/*******************************************************************************
 * Copyright (c) 2021 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.util;

import com.microsoft.java.test.plugin.handler.ClasspathUpdateHandler;
import com.microsoft.java.test.plugin.model.Option;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.Platform;
import org.eclipse.core.runtime.Status;
import org.eclipse.jdt.ls.core.internal.JavaLanguageServerPlugin;
import org.osgi.framework.BundleActivator;
import org.osgi.framework.BundleContext;

import java.util.List;

public class JUnitPlugin implements BundleActivator {

    /**
     * Client registered command to handle the server-side request to ask user for input
     */
    private static final String JAVA_TEST_ASK_CLIENT_FOR_INPUT = "_java.test.askClientForInput";

    /**
     * Client registered command to handle the server-side request to ask user for a choice
     */
    private static final String JAVA_TEST_ASK_CLIENT_FOR_CHOICE = "_java.test.askClientForChoice";

    /**
     * Client registered command to handle the server-side request to ask user for a choice in advanced mode
     */
    private static final String JAVA_TEST_ADVANCED_ASK_CLIENT_FOR_CHOICE = "_java.test.advancedAskClientForChoice";
    public static final String PLUGIN_ID = "java.test.runner";
    private static ClasspathUpdateHandler handler = new ClasspathUpdateHandler();
    private static BundleContext context;

    /*
     * (non-Javadoc)
     *
     * @see org.osgi.framework.BundleActivator#start(org.osgi.framework.BundleContext)
     */
    @Override
    public void start(BundleContext context) throws Exception {
        handler.addElementChangeListener();
        JUnitPlugin.context = context;
    }

    /*
     * (non-Javadoc)
     *
     * @see org.osgi.framework.BundleActivator#stop(org.osgi.framework.BundleContext)
     */
    @Override
    public void stop(BundleContext context) throws Exception {
        handler.removeElementChangeListener();
        JUnitPlugin.context = null;
    }

    public static void log(IStatus status) {
        if (context != null) {
            Platform.getLog(context.getBundle()).log(status);
        }
    }

    public static void log(CoreException e) {
        log(e.getStatus());
    }

    public static void logError(String message) {
        if (context != null) {
            log(new Status(IStatus.ERROR, context.getBundle().getSymbolicName(), message));
        }
    }

    public static void logInfo(String message) {
        if (context != null) {
            log(new Status(IStatus.INFO, context.getBundle().getSymbolicName(), message));
        }
    }

    public static void logException(String message, Throwable ex) {
        if (context != null) {
            log(new Status(IStatus.ERROR, context.getBundle().getSymbolicName(), message, ex));
        }
    }

    public static Object askClientForChoice(String placeHolder, List<Option> choices) {
        return askClientForChoice(placeHolder, choices, false);
    }

    public static Object askClientForChoice(String placeHolder, List<Option> choices, boolean canPickMany) {
        return JavaLanguageServerPlugin.getInstance().getClientConnection()
                    .executeClientCommand(JAVA_TEST_ASK_CLIENT_FOR_CHOICE, placeHolder, choices, canPickMany);
    }

    public static Object advancedAskClientForChoice(String placeHolder, List<Option> choices, String advancedAction,
            boolean canPickMany) {
        return JavaLanguageServerPlugin.getInstance().getClientConnection()
                .executeClientCommand(JAVA_TEST_ADVANCED_ASK_CLIENT_FOR_CHOICE, placeHolder, choices,
                advancedAction, canPickMany);
    }

    public static Object askClientForInput(String prompt, String defaultValue) {
        return JavaLanguageServerPlugin.getInstance().getClientConnection()
                    .executeClientCommand(JAVA_TEST_ASK_CLIENT_FOR_INPUT, prompt, defaultValue);
    }
}
