package junit5;

import net.jqwik.api.ForAll;
import net.jqwik.api.Property;

public class PropertyTest {
    @Property
    boolean absoluteValueOfIntegerAlwaysPositive(@ForAll int anInteger) {
        return Math.abs(anInteger) >= 0;
    }
}