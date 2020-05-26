package junit5;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

public class ParameterizedAnnotationTest {

    // this is a comment
    @ParameterizedTest
    @CsvSource({
        "Hello world.,true",
        "Good morining,false"
    })
    public void canRunWithComment(String str, Boolean bool) throws Exception {
        App classUnderTest = new App();
        assertEquals(classUnderTest.getGreeting().equals(str), bool);
    }
}
