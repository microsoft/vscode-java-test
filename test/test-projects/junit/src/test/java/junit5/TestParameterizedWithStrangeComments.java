package junit5;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class TestParameterizedWithStrangeComments {
     //FORMER_TEST_PARAMS
    //@CsvSource(
    //    {",must not be null",
    //     "0L,size must be between 1 and 999999999"})
    //@ParameterizedTest

    /**
     * [RequestContext.sessionId]
     * Tests all invalid scenarios for requestContext.logonId.
     */
    @CsvSource(delimiter = '|', textBlock = """
        -1          | size must be between 1 and 999999999
         """)
    @ParameterizedTest
    void whenInvalidReqCtxSessionId(Long __INPUT, String __EXPECTED) throws Exception {
        assert(true);
    }
}
