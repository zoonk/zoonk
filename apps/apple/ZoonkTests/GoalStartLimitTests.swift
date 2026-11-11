import XCTest

@testable import Zoonk

final class GoalStartLimitTests: XCTestCase {
  func testAFreeLearnerWithRoomForAnotherGoalSeesNoNotice() {
    XCTAssertNil(allowance(activeGoals: 2).goalStartLimit)
  }

  func testAFreeLearnerAtTheActiveGoalCapIsToldToPauseOrGetPlus() {
    XCTAssertEqual(allowance(activeGoals: 3).goalStartLimit, .activeGoals)
  }

  func testTheActiveGoalCapIsSaidBeforeTheDailyOne() {
    var full = allowance(activeGoals: 3)
    full.newGoalsToday = PlanAllowance.Cap(limit: 3, used: 3)

    XCTAssertEqual(full.goalStartLimit, .activeGoals)
  }

  private func allowance(activeGoals used: Int) -> PlanAllowance {
    PlanAllowance(
      tier: .free, buddyMessagesToday: 0, buddyMessagesDailyLimit: nil,
      activeGoals: PlanAllowance.Cap(limit: 3, used: used))
  }
}
