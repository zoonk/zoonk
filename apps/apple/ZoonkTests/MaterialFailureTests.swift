import Foundation
import XCTest

@testable import Zoonk

/// An upload's or a material question's monthly cap is the shared notice; a day's cap or any other
/// failure stays one line.
@MainActor
final class MaterialFailureTests: XCTestCase {
  private let line = LocalizedStringResource(stringLiteral: "line")

  func testAMonthlyCapIsTheNotice() {
    let monthly = OnboardingLimit(
      period: "rolling30Days", resource: "upload", tier: "free",
      availableAt: "2026-12-20T12:00:00.000Z")
    let daily = OnboardingLimit(period: "day", resource: "upload", tier: "free")

    XCTAssertEqual(
      MaterialFailure(OnboardingError.limit(monthly)) { _ in self.line },
      .notice(monthly.help))
    XCTAssertEqual(MaterialFailure(OnboardingError.limit(daily)) { _ in self.line }, .line(line))
    XCTAssertEqual(MaterialFailure(OnboardingError.slowDown) { _ in self.line }, .line(line))
  }
}
