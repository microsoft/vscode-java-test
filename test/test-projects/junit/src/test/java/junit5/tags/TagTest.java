package junit5.tags;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
interface IBase {}

@Tag("integration")
class Base {}

public class TagTest extends Base implements IBase {

    @Test
    @Tag("fast")
    void fastTest() {
    }

    @Test
    @Tag("slow")
    void slowTest() throws InterruptedException {
        Thread.sleep(2000);
    }
}
