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

  /// The monthly goals gate stands in for the start until its day has come, then the start is back
  /// and the gate goes; the goals studied at once never pass on their own.
  func testTheMonthlyGoalsGateGivesTheStartBackOnItsDay() {
    let opens = Date(timeIntervalSince1970: 1_795_339_800)
    let monthly = GoalLimitReason.monthlyGoals(.usedUp(tier: .free, availableAt: opens))

    XCTAssertTrue(monthly.holdsStart(at: opens.addingTimeInterval(-60)))
    XCTAssertFalse(monthly.holdsStart(at: opens))
    XCTAssertTrue(GoalLimitReason.activeGoals.holdsStart(at: opens))
  }

  private func allowance(activeGoals used: Int) -> PlanAllowance {
    PlanAllowance(
      tier: .free, buddyMessagesToday: 0, buddyMessagesDailyLimit: nil,
      activeGoals: PlanAllowance.Cap(limit: 3, used: used))
  }
}
