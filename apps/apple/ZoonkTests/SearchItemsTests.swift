import XCTest

@testable import Zoonk

@MainActor
final class SearchItemsTests: XCTestCase {
  func testVisitorGetsTheWaysIn() {
    let groups = searchGroups(summary: nil, isSignedIn: false)

    XCTAssertEqual(
      groups.first?.items.map(\.action), [.open(.catalog), .select(.today), .present(.signIn)])
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

    XCTAssertEqual(fallback.items.map(\.action), [.open(.startGoal(goal: "black holes"))])
    XCTAssertFalse(
      searchGroups(summary: summary, isSignedIn: true).contains { group in
        group.items.contains { $0.action == .select(.buddy) && $0.id == "ask-buddy" }
      })
  }

  func testALearnerAsksTheBuddyFirst() {
    let fallback = searchFallback(question: "black holes", summary: .searchFixture())

    XCTAssertEqual(
      fallback.items.map(\.action), [.ask("black holes"), .open(.startGoal(goal: "black holes"))])
  }
  func testTheBuddyGoesByItsNameAndIsFoundByItsRole() {
    let summary = LearnerSummary.searchFixture()
    let buddy = searchGroups(summary: summary, isSignedIn: true)
      .flatMap(\.items).first { $0.id == "buddy" }

    XCTAssertEqual(buddy?.title, summary.buddyDisplayName, "The default buddy is named, as its tab")
    XCTAssertEqual(buddy?.matches("buddy"), true)
  }

  func testThePlansSubjectsAndChaptersOpenTheirPages() throws {
    let groups = searchGroups(
      summary: .searchFixture(), isSignedIn: true, syllabus: try .searchFixture(kind: "exam"))

    XCTAssertEqual(
      groups.first { $0.id == "plan" }?.items.map(\.action),
      [
        .open(.subject(subjectKey: "math")), .open(.subject(subjectKey: "physics")),
        .open(.chapter(chapterId: "fractions")),
      ],
      "Subjects with their own page, then chapters that exist; a far topic has no page yet")
  }

  func testALanguageGoalsChaptersOpenAsUnits() throws {
    let groups = searchGroups(
      summary: .searchFixture(), isSignedIn: true, syllabus: try .searchFixture(kind: "language"))

    XCTAssertEqual(
      groups.first { $0.id == "plan" }?.items.map(\.action),
      [
        .open(.subject(subjectKey: "math")), .open(.subject(subjectKey: "physics")),
        .open(.languageUnit(chapterId: "fractions")),
      ])
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
      buddy: BuddyLook(),
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

extension GoalSyllabus {
  /// Two subjects, the first with a chapter that exists and a far topic without a page yet.
  fileprivate static func searchFixture(kind: String) throws -> GoalSyllabus {
    try JSONDecoder().decode(
      GoalSyllabus.self,
      from: Data(
        #"""
        {
          "fromMaterial": false,
          "goal": { "kind": "\#(kind)" },
          "kind": "notice",
          "lessons": { "done": 0, "known": 0, "total": 2 },
          "subjects": [
            {
              "chapters": [
                {
                  "chapterId": "fractions", "far": false, "known": false, "lessonsDone": 0,
                  "lessonsTotal": 2, "nextDate": null, "position": 0, "skillId": null,
                  "state": "upcoming", "title": "Fractions", "writing": false
                },
                {
                  "chapterId": null, "far": true, "known": false, "lessonsDone": 0,
                  "lessonsTotal": 0, "nextDate": null, "position": 1, "skillId": "ratios",
                  "state": "upcoming", "title": "Ratios", "writing": false
                }
              ],
              "key": "math", "lessonsDone": 0, "lessonsKnown": 0, "lessonsTotal": 2,
              "name": "Math", "nextDate": null, "notPlannedReason": null, "preparation": null,
              "questions": null, "source": "notice", "topics": []
            },
            {
              "chapters": [], "key": "physics", "lessonsDone": 0, "lessonsKnown": 0,
              "lessonsTotal": 0, "name": "Physics", "nextDate": null, "notPlannedReason": null,
              "preparation": null, "questions": null, "source": "notice", "topics": []
            }
          ],
          "topicCount": 2
        }
        """#.utf8))
  }
}
