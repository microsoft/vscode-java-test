package junit5;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.function.Function;
import java.util.stream.Stream;

import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.function.ThrowingConsumer;

class TestFactoryTest {
    @TestFactory
    Stream<DynamicTest> testDynamicTest() {
        final Stream<Long> parameters = Stream.of(1L);
        final Function<Long, String> testNames = input -> "TestInput " + input;
        final ThrowingConsumer<Long> test = input -> {assertEquals(1L, input);};
        return DynamicTest.stream(parameters, testNames, test);
    }
}
