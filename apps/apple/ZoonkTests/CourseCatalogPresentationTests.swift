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

  func testOnlyAnActiveGoalOnTheCourseFollowsIt() {
    let course = "course"

    XCTAssertTrue(summary(goals: [goal(courseID: course)]).followsCourse(course))
    XCTAssertFalse(summary(goals: [goal(courseID: "another")]).followsCourse(course))
    XCTAssertFalse(summary(goals: [goal(courseID: course, status: .paused)]).followsCourse(course))
    XCTAssertFalse(summary(goals: [goal(courseID: course, kind: .explain)]).followsCourse(course))
  }

  func testOnlyACourseInAnotherLanguagePointsToTheReadersEdition() {
    XCTAssertEqual(Course.testFixture.edition(in: "pt")?.title, "Astronomia")
    XCTAssertNil(Course.testFixture.edition(in: "en"))
    XCTAssertNil(Course.testFixture.edition(in: "de"))
  }

  func testOnlyAnExamPlanWithEveryChapterInAnAreaPlacesChaptersByArea() {
    XCTAssertEqual(
      example(
        reach: .byDate(fittingLessons: 1, publishedLessons: 2, areas: []),
        areas: ["Math", "Writing"]
      )
      .chapterAreas,
      ["a": "Math", "b": "Writing"])
    XCTAssertNil(
      example(
        reach: .byDate(fittingLessons: 1, publishedLessons: 2, areas: []), areas: ["Math", nil]
      )
      .chapterAreas)
    XCTAssertNil(
      example(reach: .toEnd(weeks: 3, endDate: nil, firstDay: []), areas: ["Math", "Writing"])
        .chapterAreas)
  }

  private func example(reach: CoursePlanEstimate.Reach, areas: [String?]) -> CoursePlanExample {
    CoursePlanExample(
      exam: nil,
      pace: CoursePlanExample.Pace(
        estimate: CoursePlanEstimate(
          reach: reach,
          chapters: zip(["a", "b"], areas).map { id, area in
            CoursePlanEstimate.ChapterPlace(
              area: area, chapterID: id, endWeek: nil, lessonsInPlan: 1, studyOrder: 1, week: 1,
              workKinds: [.original])
          },
          afterDeadlineMinutes: nil, beforeDeadlineMinutes: nil, coverage: nil,
          fromDate: "2026-11-09", scheduledMinutes: 30, unwrittenLessonMinutes: 0,
          workload: CoursePlanEstimate.Workload(
            checkpointMinutes: 0, lessonMinutes: 30, practiceMinutes: 0, unwrittenLessonMinutes: 0)),
        minutes: 30))
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
