package test.project;

import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;

/**
 * Unit test for simple App.
 */
public class AppTest {
    @DataProvider(name = "test1")
    public Object[][] createData1() {
        return new Object[][] {
                { "Cedric", "" },
                { "Anne", "" },
        };
    }

    @Test(dataProvider = "test1")
    public void test(String foo, String bar) {
        System.out.println(foo + " " + bar);
    }
}
