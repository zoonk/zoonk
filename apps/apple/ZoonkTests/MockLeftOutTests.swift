import Foundation
import XCTest

@testable import Zoonk

final class MockLeftOutTests: XCTestCase {
  func testOptionsReadATestLeftOutUntilItsChoiceIsPicked() throws {
    let options = try decodeOptions()

    XCTAssertEqual(
      options.options.first?.leftOut,
      [MockLeftOut(name: "Conhecimentos específicos (P3)", part: .choice)])
  }

  func testAFullDayWithAnUnpickedChoiceIsNamedWithoutIt() throws {
    let options = try decodeOptions().options

    XCTAssertEqual(
      MockLabels.optionName(options[0], severalDays: false),
      "An exam day without Conhecimentos específicos (P3)")
    XCTAssertEqual(
      MockLabels.optionName(options[0], severalDays: true),
      "Exam day 1 without Conhecimentos específicos (P3)")
    XCTAssertEqual(MockLabels.optionName(options[1], severalDays: false), "Half an exam day")
  }

  func testTheNoteSaysAnUnpickedChoiceWaitsForAPickInThePlan() {
    XCTAssertEqual(
      MockLabels.leftOut(MockLeftOut(name: "Conhecimentos específicos (P3)", part: .choice)),
      "Conhecimentos específicos (P3) is left out until you pick which one you take, in your plan."
    )
  }

  private func decodeOptions() throws -> MockOptions {
    let json = #"""
      {"access":"open","examDocument":"notice","examName":"CGU","lastMock":null,"placement":null,
       "running":null,
       "sizeSource":{"formats":null,"material":false,"pastEdition":null,"questions":"notice",
                     "subjects":null,"time":"notice"},
       "options":[
         {"area":null,"areas":["P1","P2"],"covers":null,"day":1,"estimatedMinutes":150,"kind":"full",
          "leftOut":[{"name":"Conhecimentos específicos (P3)","part":"choice"}],"minutes":180,
          "objectiveOnly":false,"questions":80,"written":[]},
         {"area":null,"areas":["P1"],"covers":null,"day":1,"estimatedMinutes":75,"kind":"half",
          "leftOut":[{"name":"Conhecimentos específicos (P3)","part":"choice"}],"minutes":90,
          "objectiveOnly":false,"questions":40,"written":[]}]}
      """#

    return try JSONDecoder().decode(MockOptions.self, from: Data(json.utf8))
  }
}
