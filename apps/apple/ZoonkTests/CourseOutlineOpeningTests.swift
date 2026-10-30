import XCTest

@testable import Zoonk

final class CourseOutlineOpeningTests: XCTestCase {
  func testOpensTheLearnersLevelOnceTheirSummaryAnswersAndTheFirstForVisitors() {
    let follows = summary(courseLevel: .intermediate)

    XCTAssertEqual(OutlineOpening(signedIn: false, summary: .idle, courseID: "course"), .first)
    XCTAssertEqual(OutlineOpening(signedIn: true, summary: .idle, courseID: "course"), .waiting)
    XCTAssertEqual(OutlineOpening(signedIn: true, summary: .loading, courseID: "course"), .waiting)
    XCTAssertEqual(
      OutlineOpening(signedIn: true, summary: .loaded(follows), courseID: "course"),
      .level(.intermediate))
    XCTAssertEqual(
      OutlineOpening(signedIn: true, summary: .loaded(follows), courseID: "other"), .first)
    XCTAssertEqual(
      OutlineOpening(
        signedIn: true, summary: .loaded(summary(courseLevel: nil)), courseID: "course"),
      .first)
    XCTAssertEqual(
      OutlineOpening(signedIn: true, summary: .failed(.network), courseID: "course"), .first)
  }

  func testOpensOnlyItsLevelAndNoneWhileWaiting() {
    XCTAssertFalse(OutlineOpening.waiting.opens(.beginner, isFirst: true))
    XCTAssertTrue(OutlineOpening.first.opens(.beginner, isFirst: true))
    XCTAssertFalse(OutlineOpening.first.opens(.intermediate, isFirst: false))
    XCTAssertFalse(OutlineOpening.level(.intermediate).opens(.beginner, isFirst: true))
    XCTAssertTrue(OutlineOpening.level(.intermediate).opens(.intermediate, isFirst: false))
  }

  private func summary(courseLevel: CourseLevel?) -> LearnerSummary {
    LearnerSummary(
      activeGoalID: "goal",
      buddy: BuddyLook(),
      buddyName: nil,
      goals: [
        LearnerGoal(
          courseID: "course", courseLevel: courseLevel, dailyMinutes: 20, id: "goal",
          kind: .learn, status: .active, targetDate: nil, title: "Statistics")
      ],
      identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: "learner"),
      level: nil,
      nextChangeAt: .distantFuture,
      places: LearnerPlaces(exam: false, mindMaps: false, readyMistakes: 0, speaking: false),
      readAt: .now,
      tier: .free,
      timeZone: nil,
      todayBlocksLeft: nil)
  }
}
