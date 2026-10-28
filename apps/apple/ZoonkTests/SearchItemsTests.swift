import XCTest

@testable import Zoonk

@MainActor
final class SearchItemsTests: XCTestCase {
  func testVisitorGetsTheWaysIn() {
    let groups = searchGroups(summary: nil, isSignedIn: false)

    XCTAssertEqual(
      groups.first?.items.map(\.action), [.open(.catalog), .select(.today), .present(.account)])
  }

  func testLearnerActionsFollowTheirPlaces() {
    let summary = LearnerSummary.searchFixture(
      places: LearnerPlaces(exam: true, mindMaps: false, readyMistakes: 3, speaking: false),
      todayBlocksLeft: 2)

    let actions = searchGroups(summary: summary, isSignedIn: true).first { $0.id == "actions" }

    XCTAssertEqual(
      actions?.items.map(\.action),
      [.open(.session), .open(.mockChooser), .open(.mistakePractice()), .select(.buddy)])
    XCTAssertEqual(actions?.items.first { $0.id == "practice-mistakes" }?.badge, 3)
  }

  func testOtherGoalsLeaveOutTheShownOneAndExplanations() {
    let summary = LearnerSummary.searchFixture(
      goals: [
        .searchFixture(id: "physics"), .searchFixture(id: "chess"),
        .searchFixture(id: "why", kind: .explain),
      ])

    let goals = searchGroups(summary: summary, isSignedIn: true).first { $0.id == "goals" }

    XCTAssertEqual(goals?.items.map(\.action), [.switchGoal("chess")])
  }

  func testAGuestStartsAGoalButCannotAskTheBuddy() {
    let summary = LearnerSummary.searchFixture(isAnonymous: true)

    let fallback = searchFallback(question: "black holes", summary: summary)

    XCTAssertEqual(fallback.items.map(\.action), [.open(.startGoal)])
    XCTAssertFalse(
      searchGroups(summary: summary, isSignedIn: true).contains { group in
        group.items.contains { $0.action == .select(.buddy) && $0.id == "ask-buddy" }
      })
  }

  func testALearnerAsksTheBuddyFirst() {
    let fallback = searchFallback(question: "black holes", summary: .searchFixture())

    XCTAssertEqual(fallback.items.map(\.action), [.select(.buddy), .open(.startGoal)])
  }
}

extension LearnerSummary {
  fileprivate static func searchFixture(
    goals: [LearnerGoal] = [.searchFixture(id: "physics")],
    isAnonymous: Bool = false,
    places: LearnerPlaces = LearnerPlaces(
      exam: false, mindMaps: false, readyMistakes: 0, speaking: false),
    todayBlocksLeft: Int? = nil
  ) -> LearnerSummary {
    LearnerSummary(
      activeGoalID: goals.first?.id,
      buddyKind: .zu,
      buddyName: nil,
      goals: goals,
      identity: LearnerIdentity(isAnonymous: isAnonymous, signedInAt: .now, userID: "learner"),
      level: nil,
      nextChangeAt: .distantFuture,
      places: places,
      readAt: .now,
      tier: .free,
      timeZone: nil,
      todayBlocksLeft: todayBlocksLeft)
  }
}

extension LearnerGoal {
  fileprivate static func searchFixture(id: String, kind: Kind = .learn) -> LearnerGoal {
    LearnerGoal(
      dailyMinutes: 20, id: id, kind: kind, status: .active, targetDate: nil, title: id.capitalized)
  }
}
