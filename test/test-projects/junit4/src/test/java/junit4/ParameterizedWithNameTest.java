package junit4;

import static org.junit.Assert.assertEquals;

import java.util.Arrays;
import java.util.Collection;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameter;
import org.junit.runners.Parameterized.Parameters;

@RunWith(Parameterized.class)
public class ParameterizedWithNameTest {

    @Parameter
    public int expected;

    @Parameters(name = "{index}: expect={0}")
    public static Collection<Object> data() {
        // If using the name annotation param and one of the inputs has a rounded
        // bracket, e.g. @Parameters(name = "test({index})"), then the test name needs
        // to be properly handled.
        return Arrays.asList(1, 2, "normalString", "()", "(()");
    }

    @Test
    public void test() {
        assertEquals(expected, 1);
    }
}
