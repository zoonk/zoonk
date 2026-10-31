import XCTest

@testable import Zoonk

final class SetupProgressTests: XCTestCase {
  func testTheTotalStaysWhenABeginnerSkipsPlacement() {
    let before = SetupProgress(
      current: .level, history: [.targetDate],
      steps: [.level, .buddy, .placement, .schedule, .plan])
    let after = SetupProgress(
      current: .buddy, history: [.targetDate, .level], steps: [.buddy, .schedule, .plan])

    XCTAssertEqual(before, SetupProgress(step: 2, total: 4))
    XCTAssertEqual(after, SetupProgress(step: 3, total: 4))
  }

  func testQuestionsAfterPlacementCountWithoutTheTest() {
    let progress = SetupProgress(
      current: .schedule, history: [.targetDate, .level, .buddy, .placement],
      steps: [.schedule, .plan])

    XCTAssertEqual(progress, SetupProgress(step: 4, total: 4))
  }

  func testPlacementAndThePlanHaveNoStep() {
    for current: Components.Schemas.OnboardingStep in [.placement, .plan] {
      XCTAssertNil(
        SetupProgress(current: current, history: [.level], steps: [current, .schedule, .plan]))
    }
  }
}
