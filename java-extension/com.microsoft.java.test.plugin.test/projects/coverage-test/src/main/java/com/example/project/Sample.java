package com.example.project;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public class Sample {

    void sample(boolean x) {
        Foo foo = getFoo();
        if (x) {
            foo = new Foo();     // <-- BOTH THIS LINE
        }
        Bar bar = new Bar();
        Baz baz = new Baz();
        baz.from(bar::bar)
            .as(Sample::toArray) // <-- AND THIS LINE
            .to(foo::foo);
    }

    static String[] toArray(List<String> s) {
        return s.toArray(String[]::new);
    }

    static Foo getFoo() {
        return new Foo();
    }

    static class Foo {
        void foo(String... foo) {
        }
    }

    static class Bar {
        List<String> bar() {
            return List.of("bar");
        }
    }

    static class Baz {
        Baz from(Supplier<List<String>> from) {
            return this;
        }

        Baz as(Function<List<String>, String[]> as) {
            return this;
        }

        Baz to(Consumer<String[]> to) {
            return this;
        }
    }
}
