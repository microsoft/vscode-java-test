package junit5;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Collections;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;

import junit.App;

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

    @ParameterizedTest
    @CsvSource({
        "1, 2",
        "1, 1"
    })
    public void equal(int first, int second) throws Exception {
        assertEquals(first, second);
    }

    @ParameterizedTest(name = "Test {0} is a Palindrome")
    @MethodSource("palindromeProvider")
    void canRunWithGenericTypedParameter(List<Integer> argument) {
    }

    static Stream<List<Integer>> palindromeProvider() {
        return Stream.of(Collections.singletonList(1), Collections.singletonList(1));
    }
}
