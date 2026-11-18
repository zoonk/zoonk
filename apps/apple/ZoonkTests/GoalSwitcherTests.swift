import XCTest

@testable import Zoonk

/// The goal menu is the plain "Start a goal" row only when there's nothing in it to choose: one
/// quick explanation doesn't need a menu, two or more are listed in it.
@MainActor
final class GoalSwitcherTests: XCTestCase {
  func testNoGoalAndAtMostOneExplanationStartPlainly() {
    XCTAssertTrue(GoalSwitcher.startsPlainly(followed: 0, waiting: 0, explanations: 0))
    XCTAssertTrue(GoalSwitcher.startsPlainly(followed: 0, waiting: 0, explanations: 1))
  }

  /// Two or more are listed in the menu, which says so on its button.
  func testTwoExplanationsOpenAMenuNamedForThem() {
    XCTAssertFalse(GoalSwitcher.startsPlainly(followed: 0, waiting: 0, explanations: 2))
    XCTAssertEqual(
      GoalSwitcher.trigger(hasShownGoal: false, followed: 0, waiting: 0, explanations: 2),
      .explanations)
    XCTAssertEqual(
      GoalSwitcher.trigger(hasShownGoal: true, followed: 1, waiting: 0, explanations: 2), .goal)
  }

  func testWaitingGoalsAreListedWithoutAFollowedOne() {
    XCTAssertTrue(GoalSwitcher.listsGoals(followed: 0, waiting: 1))
    XCTAssertFalse(GoalSwitcher.listsGoals(followed: 0, waiting: 0))
  }

  func testAGoalToFollowOrStartOpensTheMenu() {
    XCTAssertFalse(GoalSwitcher.startsPlainly(followed: 1, waiting: 0, explanations: 0))
    XCTAssertFalse(GoalSwitcher.startsPlainly(followed: 0, waiting: 1, explanations: 0))
  }
}
