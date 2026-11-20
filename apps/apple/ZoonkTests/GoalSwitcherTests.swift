import SwiftUI
import XCTest

@testable import Zoonk

/// The goal menu is the plain "New goal" row only when there's nothing in it to choose: one
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

  func testWaitingGoalsWithoutAFollowedOneNameTheMenuYourGoals() {
    XCTAssertEqual(
      GoalSwitcher.trigger(hasShownGoal: false, followed: 0, waiting: 2, explanations: 0),
      .yourGoals)
    XCTAssertEqual(
      GoalSwitcher.trigger(hasShownGoal: false, followed: 0, waiting: 1, explanations: 2),
      .yourGoals)
  }

  /// Main's switcher says "current goal" only when one is shown.
  func testTheMenuIsCalledTheCurrentGoalOnlyWithAGoal() async throws {
    let explanations = [
      goal(id: "a", kind: .explain, name: "Why the sky is blue"),
      goal(id: "b", kind: .explain, name: "How tides work"),
    ]

    let withoutGoal = try await hints(summary(goals: explanations))
    XCTAssertFalse(withoutGoal.contains { $0.contains("Current goal") }, "\(withoutGoal)")

    let withGoal = try await hints(summary(goals: [goal(id: "g", kind: .learn, name: "Biology")]))
    XCTAssertTrue(withGoal.contains { $0.contains("Current goal") }, "\(withGoal)")
  }

  private func hints(_ summary: LearnerSummary) async throws -> [String] {
    try await readsWhatVoiceOverReads()
    let window = try show(
      GoalSwitcher(summary: summary, isCompact: false, maxTitleWidth: 240)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .appDependencies(AppDependencies.hosted()).environment(AppRouter()).zoonkStyles())
    try await waitForLayout(in: window)
    return spokenHints(in: window)
  }

  private func goal(id: String, kind: LearnerGoal.Kind, name: String) -> LearnerGoal {
    LearnerGoal(
      dailyMinutes: 15, id: id, kind: kind, language: "en", status: .active, targetDate: nil,
      displayName: name, title: name)
  }

  private func summary(goals: [LearnerGoal]) -> LearnerSummary {
    LearnerSummary(
      activeGoalID: goals.first { $0.kind != .explain }?.id,
      analytics: LearnerAnalytics(
        disabled: false, goalKind: nil, plan: "free", planPhase: nil, usageDataSharing: nil,
        username: nil),
      buddy: BuddyLook(), buddyName: nil, goals: goals,
      identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: "learner"),
      level: nil, nextChangeAt: .distantFuture,
      places: LearnerPlaces(
        certificates: false, completedLessons: false, exam: false, mindMaps: false,
        readyMistakes: 0, speaking: false),
      readAt: .now, tier: .free, timeZone: "America/Sao_Paulo", todayBlocksLeft: nil)
  }
}
