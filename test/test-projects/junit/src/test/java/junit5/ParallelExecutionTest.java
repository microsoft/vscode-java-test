package junit5;

import java.util.concurrent.Semaphore;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;

/**
 * Test class with 3 test methods which are executed concurrently, so that the
 * correct result processing of overlapping test runs can be verified.
 */
@Execution(ExecutionMode.CONCURRENT)
class ParallelExecutionTest {

    private static final Semaphore s1 = new Semaphore(0);
    private static final Semaphore s2 = new Semaphore(0);
    private static final Semaphore s3 = new Semaphore(0);

    @Test
    void test1() {
        s1.release();
        s2.acquireUninterruptibly();
        assertComparison("expected1", "actual1");
    }

    @Test
    void test2() {
        s2.release();
        s3.acquireUninterruptibly();
        assertComparison("expected2", "actual2");
    }

    @Test
    void test3() {
        s3.release();
        s1.acquireUninterruptibly();
    }

    private void assertComparison(String expected, String actual) {
        Assertions.assertEquals(expected, actual);
    }

}
