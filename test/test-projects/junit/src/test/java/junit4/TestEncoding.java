package junit4;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

import java.nio.charset.Charset;

/**
 * The test case in this class will fail unless you set `java.test.config : encoding` to ISO-8859-1
 */
public class TestEncoding {
  @Test
  public void latin1IsSet() {
    assertEquals(
      "ISO-8859-1",
      Charset.defaultCharset().name()
    );
  }
}
