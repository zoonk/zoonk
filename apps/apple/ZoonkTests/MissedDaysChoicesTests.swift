import XCTest

@testable import Zoonk

final class MissedDaysChoicesTests: XCTestCase {
  func testAnOrdinaryDayLeadsWithTimeAndKeepsTheRestInTheMenu() {
    let choices = MissedDaysChoices(canFocus: true, isReturn: false)

    XCTAssertEqual(choices.lead, .adjustTime)
    XCTAssertEqual(choices.others, [.focus, .studyEverything])
  }

  /// On a return after a break, nothing that asks for more hours leads.
  func testAReturnDayLeadsWithFocusOrWithNothing() {
    let focus = MissedDaysChoices(canFocus: true, isReturn: true)
    XCTAssertEqual(focus.lead, .focus)
    XCTAssertEqual(focus.others, [.adjustTime, .studyEverything])

    let none = MissedDaysChoices(canFocus: false, isReturn: true)
    XCTAssertNil(none.lead)
    XCTAssertEqual(none.others, [.adjustTime, .studyEverything])
  }

  /// Main opens the time for every goal, "Add time" or "Adjust plan" alike.
  func testEachChoiceOpensItsPlanEditorSection() {
    XCTAssertEqual(MissedDaysChoices.Option.adjustTime.section, .time)
    XCTAssertEqual(MissedDaysChoices.Option.focus.section, .focus)
    XCTAssertEqual(MissedDaysChoices.Option.studyEverything.section, .everything)
  }
}
