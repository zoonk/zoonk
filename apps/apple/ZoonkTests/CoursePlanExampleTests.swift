import XCTest

@testable import Zoonk

final class CoursePlanExampleTests: XCTestCase {
  /// 2026-11-07 23:30 in São Paulo, already the 8th in UTC.
  private let saturdayNightInBrazil = Date(timeIntervalSince1970: 1_794_105_000)

  func testUpcomingExamCountsDaysInTheExamsOwnTimeZone() throws {
    let course = Course.exam(days: ["2026-11-01", "2026-11-08", "2026-11-15"])

    let exam = try XCTUnwrap(UpcomingExam(course: course, now: saturdayNightInBrazil))

    XCTAssertEqual(exam.days, ["2026-11-08", "2026-11-15"])
    XCTAssertEqual(exam.daysLeft, 1)
    XCTAssertFalse(exam.estimated)
  }

  func testUpcomingExamIsNilOnceEverySittingIsPast() {
    let course = Course.exam(days: ["2026-11-01"])

    XCTAssertNil(UpcomingExam(course: course, now: saturdayNightInBrazil))
    XCTAssertNil(UpcomingExam(course: .testFixture, now: saturdayNightInBrazil))
  }

  func testExampleAsksForAQuarterHourToTheEndOrHalfAnHourToTheExam() throws {
    let undated = try XCTUnwrap(
      CoursePlanExampleQuery(course: .testFixture, exam: nil, now: saturdayNightInBrazil))
    XCTAssertEqual(undated.dailyMinutes, 15)
    XCTAssertNil(undated.targetDate)

    let course = Course.exam(days: ["2026-11-15"])
    let exam = UpcomingExam(course: course, now: saturdayNightInBrazil)
    let dated = try XCTUnwrap(
      CoursePlanExampleQuery(course: course, exam: exam, now: saturdayNightInBrazil))
    XCTAssertEqual(dated.dailyMinutes, 30)
    XCTAssertEqual(dated.targetDate, "2026-11-15")
  }

  /// The estimate's calendar starts on the UTC day, so an exam that's still tomorrow in Brazil but
  /// today in UTC has no study day left to plan.
  func testExampleIsNilWhenTheExamIsTodayInUTC() {
    let course = Course.exam(days: ["2026-11-08"])
    let exam = UpcomingExam(course: course, now: saturdayNightInBrazil)

    XCTAssertEqual(exam?.daysLeft, 1)
    XCTAssertNil(CoursePlanExampleQuery(course: course, exam: exam, now: saturdayNightInBrazil))
  }

  func testOnlyAPlanWithStudyHasSomethingToShow() {
    XCTAssertTrue(
      CoursePlanEstimate.make(reach: .toEnd(weeks: 3, endDate: nil, firstDay: [])).hasStudyToShow)
    XCTAssertFalse(
      CoursePlanEstimate.make(reach: .toEnd(weeks: 0, endDate: nil, firstDay: [])).hasStudyToShow)
    XCTAssertFalse(
      CoursePlanEstimate.make(
        reach: .byDate(fittingLessons: 0, publishedLessons: 4, areas: [.make(plannedMinutes: 0.2)])
      ).hasStudyToShow)
    XCTAssertTrue(
      CoursePlanEstimate.make(
        reach: .byDate(fittingLessons: 0, publishedLessons: 4, areas: [.make(plannedMinutes: 12)])
      ).hasStudyToShow)
  }

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
}

extension Course {
  fileprivate static func exam(days: [String]) -> Course {
    Course(
      categories: [.exams], description: nil,
      exam: CourseExamDays(days: days, estimated: false, timeZone: "America/Sao_Paulo"),
      generationStatus: .completed, id: "exam-course", imageURL: nil, isExam: true,
      landingPage: nil, language: "pt", languageFlag: nil, organization: .testFixture,
      slug: "enem", targetLanguage: nil, title: "ENEM")
  }
}

extension CoursePlanEstimate {
  fileprivate static func make(reach: Reach) -> CoursePlanEstimate {
    CoursePlanEstimate(
      reach: reach, chapters: [], afterDeadlineMinutes: nil, beforeDeadlineMinutes: nil,
      coverage: nil, fromDate: "2026-11-08", scheduledMinutes: 0, unwrittenLessonMinutes: 0,
      workload: Workload(
        checkpointMinutes: 0, lessonMinutes: 0, practiceMinutes: 0, unwrittenLessonMinutes: 0))
  }
}

extension CoursePlanEstimate.Area {
  fileprivate static func make(plannedMinutes: Double) -> CoursePlanEstimate.Area {
    CoursePlanEstimate.Area(
      fitting: 0, name: "Math", plannedMinutes: plannedMinutes, quickLessons: 0, total: 4,
      unwrittenMinutes: 0)
  }
}
