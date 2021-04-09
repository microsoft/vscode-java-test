package junit4;

import org.junit.BeforeClass;
import org.junit.Test;

/**
 * ExceptionInBefore
 */
public class ExceptionInBefore {

    @BeforeClass  
    public static void beforeClass() throws Exception {
        throw new Exception("Exception in @BeforeClass");
    };

    @Test
    public void test() {
        
    }
}