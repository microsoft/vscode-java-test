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
public class ParameterizedTest {

    @Parameter
    public int expected;

    @Parameters
    public static Collection<Integer> data(){
        return Arrays.asList(1, 2);
    }

    @Test
    public void test() {
        assertEquals(expected, 1);
    }
}
