package example;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;

public class InheritanceBinaryBaseTest<T extends TestInfo> {
    @Test
    void base(T info) {
    }
}