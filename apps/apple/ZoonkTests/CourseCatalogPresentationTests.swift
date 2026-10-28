import XCTest

@testable import Zoonk

final class CourseCatalogPresentationTests: XCTestCase {
  func testCatalogListsOnlyCategoriesWithCoursesAndTheOpenOne() {
    let counts = CourseCategoryCounts(counts: [.science: 2, .math: 0, .arts: 1], total: 3)

    XCTAssertEqual(
      populatedCategories(counts: counts, open: nil, locale: Locale(identifier: "en_US")),
      [.arts, .science])
    XCTAssertEqual(
      populatedCategories(counts: counts, open: .tech, locale: Locale(identifier: "en_US")),
      [.arts, .science, .tech])
  }

  func testFlagsComeFromCountryAndNationCodes() {
    XCTAssertEqual(flagEmoji("br"), "🇧🇷")
    XCTAssertEqual(flagEmoji("gb-wls"), "🏴󠁧󠁢󠁷󠁬󠁳󠁿")
    XCTAssertNil(flagEmoji("es-ct"))
    XCTAssertNil(flagEmoji("arab"))
  }

  /// Only an active goal that isn't a quick explanation follows a course, as main's course page
  /// reads it.
  func testOnlyAnActiveGoalOnTheCourseFollowsIt() {
    let course = "course"

    XCTAssertTrue(summary(goals: [goal(courseID: course)]).followsCourse(course))
    XCTAssertFalse(summary(goals: [goal(courseID: "another")]).followsCourse(course))
    XCTAssertFalse(summary(goals: [goal(courseID: course, status: .paused)]).followsCourse(course))
    XCTAssertFalse(summary(goals: [goal(courseID: course, kind: .explain)]).followsCourse(course))
  }

  private func goal(
    courseID: String, kind: LearnerGoal.Kind = .learn, status: LearnerGoal.Status = .active
  ) -> LearnerGoal {
    LearnerGoal(
      courseID: courseID, dailyMinutes: 15, id: UUID().uuidString, kind: kind, status: status,
      targetDate: nil, title: "A goal")
  }

  private func summary(goals: [LearnerGoal]) -> LearnerSummary {
    LearnerSummary(
      activeGoalID: goals.first?.id, buddy: BuddyLook(), buddyName: nil, goals: goals,
      identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: "learner"),
      level: nil, nextChangeAt: .distantFuture,
      places: LearnerPlaces(exam: false, mindMaps: false, readyMistakes: 0, speaking: false),
      readAt: .now, tier: .free, timeZone: nil, todayBlocksLeft: nil)
  }
}
