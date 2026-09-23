package example;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

public class NestedOnlyTest {
    @Nested
    class Child {
        @Test
        void nestedTest() {
        }
    }
}
