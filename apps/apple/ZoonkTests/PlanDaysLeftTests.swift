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

  func testASetDateReadsAsShown() throws {
    let days = try XCTUnwrap(
      planDaysLeft(try goalPlanFixture(targetDate: "2027-03-05", today: "2027-01-04")))

    XCTAssertEqual(days.spoken, days.shown)
  }
}
