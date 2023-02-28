package junit5;

import io.vertx.core.Vertx;
import io.vertx.junit5.VertxExtension;
import io.vertx.junit5.VertxTestContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

@ExtendWith(VertxExtension.class)
public class VertxTest {

    // test normal methods with multiple parameters
    @Test
    void test(Vertx vertx, VertxTestContext testContext) throws InterruptedException {
        testContext.completeNow();
    }

}
