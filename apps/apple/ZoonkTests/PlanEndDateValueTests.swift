import XCTest

@testable import Zoonk

final class PlanEndDateValueTests: XCTestCase {
  func testACompletionDateAppearsOnItsOwnEvenWithoutASetDate() {
    let value = PlanEndDateValue(
      targetDate: nil, isExam: false,
      finish: ("2027-02-05", false, false), today: "2027-01-04")
    XCTAssertEqual(value.shown, "Feb 5")
    XCTAssertEqual(value.spoken, "Feb 5")
  }

  func testAnUnknownCompletionLeavesTheEndDateUnset() {
    let value = PlanEndDateValue(
      targetDate: "2027-11-14", isExam: false, finish: nil, today: "2027-01-04")
    XCTAssertEqual(value.shown, "None set")
  }

  func testNoDateWithAnEstimateNamesBoth() {
    let value = PlanEndDateValue(
      targetDate: nil, isExam: false,
      finish: ("2027-07-01", true, true), today: "2026-11-16")
    XCTAssertEqual(value.shown, "None set · ~Jul 2027")
    XCTAssertEqual(value.spoken, "None set · About Jul 2027")
  }

  func testNoDateWithoutAnEstimateSaysNoneSet() {
    let value = PlanEndDateValue(
      targetDate: nil, isExam: false, finish: nil, today: "2026-11-16")
    XCTAssertEqual(value.shown, "None set")
  }

  func testAnUnknownExamDateStaysUnconfirmed() {
    let value = PlanEndDateValue(
      targetDate: nil, isExam: true, finish: nil, today: "2026-11-16")
    XCTAssertEqual(value.shown, "To be confirmed")
  }
}
