import XCTest

@testable import Zoonk

final class PlanDaysLeftTests: XCTestCase {
  func testAnEstimatedDateReadsTheDaysLeftAsAbout() throws {
    let days = try XCTUnwrap(
      planDaysLeft(
        try goalPlanFixture(
          targetDate: "2027-03-05", targetDateEstimated: true, today: "2027-01-04")))

    XCTAssertEqual(days.shown, "~60 days left")
    XCTAssertEqual(days.spoken, "About 60 days left")
  }

  func testAnEstimatedCountIsMarkedAndReadAsAbout() {
    let estimated = daysLeftText(364, estimated: true)
    XCTAssertEqual(estimated.shown, "~364 days left")
    XCTAssertEqual(estimated.spoken, "About 364 days left")

    let set = daysLeftText(364, estimated: false)
    XCTAssertEqual(set.shown, "364 days left")
    XCTAssertEqual(set.spoken, set.shown)
  }

  func testASetDateReadsAsShown() throws {
    let days = try XCTUnwrap(
      planDaysLeft(try goalPlanFixture(targetDate: "2027-03-05", today: "2027-01-04")))

    XCTAssertEqual(days.spoken, days.shown)
  }
}
