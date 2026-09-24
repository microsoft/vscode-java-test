package example;

import org.junit.jupiter.api.Test;

public class MiniTest {
    @Test
    void first() {
    }

    @Test
    void second() {
    }
}

enum HelperEnum {
    VALUE
}

record HelperRecord(int value) {
}

@interface HelperAnnotation {
}

class SiblingTest {
    @Test
    void siblingTest() {
    }
}
