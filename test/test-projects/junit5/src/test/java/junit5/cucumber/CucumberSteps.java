package junit5.cucumber;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

public class CucumberSteps {

  @When("the client add {int} and {int}")
  public void addNumbers(Integer int1, Integer int2) {
  }

  @Then("the result should be {int}")
  public void checkSumValue(Integer value) {
    assertEquals(value + 1, 6);
  }
}
