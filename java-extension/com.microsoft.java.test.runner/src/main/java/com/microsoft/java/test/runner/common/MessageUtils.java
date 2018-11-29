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

package com.microsoft.java.test.runner.common;

import java.util.Arrays;
import java.util.List;

public class MessageUtils {

    public static TestMessageItem createWithName(String title, String nameValue) {
        return create(title, new Pair(TestMessageConstants.NAME, nameValue));
    }

    public static TestMessageItem create(String title, Pair... attributes) {
        List<Pair> pairList = null;
        if (attributes != null) {
            pairList = Arrays.asList(attributes);
        }
        return create(title, pairList);
    }

    public static TestMessageItem create(String title, List<Pair> attributes) {
        final TestMessageItem item = new TestMessageItem(TestMessageType.Info, title, attributes);
        return item;
    }

}
