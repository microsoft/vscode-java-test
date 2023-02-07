package junit5;

import static org.junit.jupiter.api.Assertions.fail;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

public class AppTest {
    @Test
    void testGetGreeting() {

    }

    @ParameterizedTest
    @CsvSource({
            "1, 2",
            "1, 1"
    })
    public void testGetGreeting(int first, int second) throws Exception {
        if (second == 2) {
            fail("second should not be 2");
        }
    }
}
