package junit4;

import org.junit.Test;

import static org.junit.Assume.assumeTrue;

public class AssumeTest {
    @Test
    public void shouldSkip() {
        assumeTrue(false);
    }
}
