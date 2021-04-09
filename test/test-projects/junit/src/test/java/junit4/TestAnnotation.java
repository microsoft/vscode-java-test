package junit4;

import org.junit.Test;

import static org.junit.Assert.assertTrue;

public class TestAnnotation {
    @Test
    public void shouldPass() {
        assertTrue(true);
    }

    @Test
    public void shouldFail() {
        assertTrue(false);
    }
}
