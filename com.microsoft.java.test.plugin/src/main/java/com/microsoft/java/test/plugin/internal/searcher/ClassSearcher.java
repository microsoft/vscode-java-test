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

package com.microsoft.java.test.plugin.internal.searcher;

import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.ls.core.internal.JDTUtils;

import com.microsoft.java.test.plugin.internal.searcher.model.SearchResult;
import com.microsoft.java.test.plugin.internal.searcher.model.TestTreeNodeType;
import com.microsoft.java.test.plugin.internal.testsuit.TestSuite;

@SuppressWarnings("restriction")
public abstract class ClassSearcher extends TestEntrySearcher {

    @Override
    protected SearchPattern resolveSearchPattern(String fullyqualifiedName) {
        return SearchPattern.createPattern(fullyqualifiedName + ".*", IJavaSearchConstants.CLASS, IJavaSearchConstants.DECLARATIONS, SearchPattern.R_PATTERN_MATCH);
    }

    protected SearchResult parseSearchEntriesResponse(IType type) throws JavaModelException {
        final TestSuite suite = new TestSuite(
                TestSearchUtility.getRange(type.getCompilationUnit(), type),
                JDTUtils.getFileURI(type.getResource()),
                type.getFullyQualifiedName(),
                type.getPackageFragment().getElementName(),
                null,
                null,
                type.getJavaProject().getProject().getName()
        );
        return new SearchResult(suite, type.getElementName(), TestTreeNodeType.Class);
    }


}
