/*******************************************************************************
* Copyright (c) 2018 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.util;

import com.microsoft.java.test.plugin.model.TestItem;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;

import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.OperationCanceledException;
import org.eclipse.core.runtime.jobs.Job;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.handlers.DocumentLifeCycleHandler;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@SuppressWarnings("restriction")
public class CodeLensUtils {

    public static List<TestItem> searchCodeLens(List<Object> arguments, IProgressMonitor monitor)
            throws OperationCanceledException, InterruptedException, JavaModelException {
        final List<TestItem> resultList = new ArrayList<>();
        if (arguments == null || arguments.size() == 0) {
            return resultList;
        }

        final String uri = (String) arguments.get(0);

        // wait for the LS finishing updating
        Job.getJobManager().join(DocumentLifeCycleHandler.DOCUMENT_LIFE_CYCLE_JOBS, monitor);

        final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(uri);
        if (!TestSearchUtils.isJavaElementExist(unit) || !TestSearchUtils.isInTestScope(unit) || monitor.isCanceled()) {
            return resultList;
        }

        final IType[] childrenTypes = unit.getAllTypes();
        for (final IType type : childrenTypes) {
            if (!TestSearchUtils.isTestableClass(type)) {
                continue;
            }
            final List<TestItem> testMethodList = Arrays.stream(type.getMethods()).map(m -> {
                try {
                    final TestKind kind = TestSearchUtils.resolveTestKindForMethod(m);
                    if (kind != null) {
                        return TestSearchUtils.constructTestItem(m, TestLevel.METHOD, kind);
                    }
                    return null;
                } catch (final JavaModelException e) {
                    return null;
                }
            }).filter(Objects::nonNull).collect(Collectors.toList());
            if (testMethodList.size() > 0) {
                final TestItem parent = TestSearchUtils.constructTestItem(type,
                        TestSearchUtils.getTestLevelForIType(type));
                parent.setChildren(testMethodList);
                // Assume the kinds of all methods are the same.
                parent.setKind(testMethodList.get(0).getKind());
                resultList.add(parent);
            }
        }

        return resultList;
    }
}
