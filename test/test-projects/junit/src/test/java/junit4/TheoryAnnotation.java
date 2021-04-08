package junit4;

import static org.junit.Assert.assertEquals;

import org.junit.experimental.theories.DataPoints;
import org.junit.experimental.theories.Theories;
import org.junit.experimental.theories.Theory;
import org.junit.runner.RunWith;
 
@RunWith(Theories.class)
public class TheoryAnnotation {
    @DataPoints
    public static int[] testIntegers() {
        return new int[]{ 1, 1 };
    }

    @DataPoints
    public static String[] testStrings() {
        return new String[]{ "1", "2" };
    }
   
    @Theory
    public void shouldPass(Integer a, Integer b) {
        assertEquals(a, b);
    }

    @Theory
    public void shouldFail(String a, String b) {
        assertEquals(a, b);
    }
}
