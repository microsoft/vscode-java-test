package example;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;

public class GenericInheritanceBaseTest<T extends TestInfo> {
    @Test
    void generic(T info) {
    }
}
