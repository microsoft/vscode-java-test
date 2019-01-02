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

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;

import java.io.PrintStream;
import java.lang.reflect.Type;

public class TestOutputStream implements TestStream {
    private final PrintStream out;
    private final PrintStream err;

    private static final JsonSerializer<TestMessageItem> serializer = new JsonSerializer<TestMessageItem>() {
        @Override
        public JsonElement serialize(TestMessageItem item, Type typeOfSrc, JsonSerializationContext context) {
            final JsonObject jsonMsgItem = new JsonObject();
            jsonMsgItem.addProperty("name", item.name);
            if (item.attributes != null) {
                final JsonObject jsonAttributes = new JsonObject();
                for (final Pair pair : item.attributes) {
                    jsonAttributes.addProperty(pair.first, pair.second);
                }
                jsonMsgItem.add("attributes", jsonAttributes);
            }
            return jsonMsgItem;
        }
    };

    private TestOutputStream() {
        this.out = System.out;
        this.err = System.err;
    }

    private static class SingletonHelper {
        private static final TestOutputStream INSTANCE = new TestOutputStream();
    }

    public static TestOutputStream instance() {
        return SingletonHelper.INSTANCE;
    }

    @Override
    public void println(TestMessageItem item) {
        final String content = toJson(item);
        if (item.type == TestMessageType.Error) {
            this.err.println(content);
            this.err.println();
        } else {
            this.out.println(content);
            this.out.println();
        }
    }

    @Override
    public void flush() {
        this.out.flush();
        this.err.flush();
    }

    private static String toJson(TestMessageItem item) {
        final GsonBuilder gsonBuilder = new GsonBuilder();
        gsonBuilder.registerTypeAdapter(TestMessageItem.class, serializer);
        final Gson customGson = gsonBuilder.create();

        final StringBuilder builder = new StringBuilder("@@<TestRunner-");
        builder.append(customGson.toJson(item));
        builder.append("-TestRunner>");
        return builder.toString();
    }
}
