package junit5;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

class TestWithExtractedEqualityAssertion {

    @Test
    void test() {
        extracted1();
    }

    private void extracted1() {
        extracted2();
    }

    private void extracted2() {
        Assertions.assertEquals(1, 2);
    }

}
