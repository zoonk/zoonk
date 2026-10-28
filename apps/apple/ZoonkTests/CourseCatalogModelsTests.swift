import XCTest

@testable import Zoonk

final class CourseCatalogModelsTests: XCTestCase {
  func testCatalogEnumsPreservePublicAPIRawValues() {
    XCTAssertEqual(
      CourseCategory.allCases.map(\.rawValue),
      [
        "arts", "business", "communication", "culture", "economics", "engineering", "exams",
        "geography", "health", "history", "languages", "law", "math", "science", "society",
        "tech",
      ])
    XCTAssertEqual(
      CourseLevel.allCases.map(\.rawValue),
      ["overview", "beginner", "intermediate", "advanced"])
  }

  func testCatalogPageCanLoadMoreOnlyWithAnOpaqueCursor() {
    let course = CourseSummary.testFixture

    XCTAssertTrue(
      CourseCatalogPage(courses: [course], hasMore: true, nextCursor: "opaque-cursor")
        .canLoadMore)
    XCTAssertFalse(
      CourseCatalogPage(courses: [course], hasMore: true, nextCursor: nil).canLoadMore)
    XCTAssertFalse(
      CourseCatalogPage(courses: [course], hasMore: false, nextCursor: "stale-cursor")
        .canLoadMore)
  }

  func testCatalogSupplementalDetailsRoundTripThroughCodable() throws {
    let courseDetail = CourseDetail(
      course: .testFixture,
      chapters: [.testFixture],
      tryLessonID: CourseLesson.testFixture.id)
    let chapterDetail = ChapterDetail(chapter: .resourceTestFixture, lessons: [.testFixture])

    let courseData = try JSONEncoder().encode(courseDetail)
    let chapterData = try JSONEncoder().encode(chapterDetail)

    XCTAssertEqual(try JSONDecoder().decode(CourseDetail.self, from: courseData), courseDetail)
    XCTAssertEqual(try JSONDecoder().decode(ChapterDetail.self, from: chapterData), chapterDetail)
  }
}

extension CourseOrganization {
  static let testFixture = CourseOrganization(
    id: "00000000-0000-7000-8000-000000000001",
    logoURL: URL(string: "https://cdn.zoonk.test/organization.png"),
    name: "Zoonk",
    slug: "zoonk")
}

extension CourseSummary {
  static let testFixture = CourseSummary(
    description: "Understand the night sky.",
    estimatedMinutes: 45,
    id: "00000000-0000-7000-8000-000000000002",
    imageURL: URL(string: "https://cdn.zoonk.test/course.png"),
    language: "en",
    languageFlag: nil,
    lessonCount: 3,
    organization: .testFixture,
    slug: "astronomy",
    subject: .science,
    targetLanguage: nil,
    title: "Astronomy")

  static let secondTestFixture = CourseSummary(
    description: "Learn how computers work.",
    estimatedMinutes: 0,
    id: "00000000-0000-7000-8000-000000000003",
    imageURL: nil,
    language: "en",
    languageFlag: nil,
    lessonCount: 0,
    organization: .testFixture,
    slug: "computer-science",
    subject: .tech,
    targetLanguage: nil,
    title: "Computer Science")
}

extension Course {
  static let testFixture = Course(
    categories: [.science],
    description: "Understand the night sky.",
    examplePlan: CoursePlanExample(
      exam: nil,
      pace: CoursePlanExample.Pace(
        estimate: CoursePlanEstimate(
          reach: .toEnd(
            weeks: 14, endDate: "2027-02-01",
            firstDay: [
              CoursePlanEstimate.FirstDayLesson(
                chapterID: "00000000-0000-7000-8000-000000000004", dayMinutes: 12.5,
                id: "00000000-0000-7000-8000-000000000005", title: "The Sun")
            ]),
          chapters: [
            CoursePlanEstimate.ChapterPlace(
              area: nil, chapterID: "00000000-0000-7000-8000-000000000004", endWeek: 2,
              lessonsInPlan: nil, studyOrder: nil, week: 1, workKinds: [.original])
          ],
          afterDeadlineMinutes: nil, beforeDeadlineMinutes: nil, coverage: nil,
          fromDate: "2026-11-09", scheduledMinutes: 95, unwrittenLessonMinutes: 0,
          workload: CoursePlanEstimate.Workload(
            checkpointMinutes: 20, lessonMinutes: 45, practiceMinutes: 30,
            unwrittenLessonMinutes: 0)),
        minutes: 15)),
    generationStatus: .completed,
    id: CourseSummary.testFixture.id,
    imageURL: CourseSummary.testFixture.imageURL,
    isExam: false,
    landingPage: CourseLandingPage(
      audience: ["Anyone who looks up at night"], outcomes: ["Find the planets"],
      valueProposition: "Find your way around the night sky."),
    language: "en",
    languageFlag: nil,
    organization: .testFixture,
    slug: "astronomy",
    targetLanguage: nil,
    title: "Astronomy")
}

extension CourseChapter {
  static let testFixture = CourseChapter(
    courseID: Course.testFixture.id,
    description: "Meet our cosmic neighborhood.",
    generationStatus: .completed,
    id: "00000000-0000-7000-8000-000000000004",
    language: "en",
    lessonCount: 2,
    lessons: [
      CourseOutlineLesson(
        estimatedMinutes: 6, id: "00000000-0000-7000-8000-000000000005", title: "The Sun")
    ],
    level: .beginner,
    objectives: ["Name the planets"],
    position: 0,
    slug: "solar-system",
    title: "The Solar System")

  static let resourceTestFixture = CourseChapter(
    courseID: Course.testFixture.id,
    description: "Meet our cosmic neighborhood.",
    generationStatus: .completed,
    id: "00000000-0000-7000-8000-000000000004",
    language: "en",
    lessonCount: nil,
    lessons: [],
    level: .beginner,
    objectives: ["Name the planets"],
    position: 0,
    slug: "solar-system",
    title: "The Solar System")
}

extension CatalogChapterKey {
  static let testFixture = CatalogChapterKey(
    chapterID: CourseChapter.testFixture.id,
    courseID: Course.testFixture.id)
}

extension CourseLesson {
  static let testFixture = CourseLesson(
    chapterID: CourseChapter.testFixture.id,
    courseID: Course.testFixture.id,
    description: "A first look at our star.",
    estimatedMinutes: 6,
    generationStatus: .completed,
    id: "00000000-0000-7000-8000-000000000005",
    language: "en",
    position: 0,
    slug: "the-sun",
    title: "The Sun")
}

extension CourseLesson {
  func with(id: String, status: CatalogGenerationStatus) -> CourseLesson {
    CourseLesson(
      chapterID: chapterID, courseID: courseID, description: description,
      estimatedMinutes: estimatedMinutes, generationStatus: status, id: id, language: language,
      position: position, slug: slug,
      title: title)
  }
}

extension CatalogSearchResults {
  static let testFixture = CatalogSearchResults(
    chapters: [
      CatalogChapterSearchResult(
        courseID: Course.testFixture.id,
        courseSlug: Course.testFixture.slug,
        courseTitle: Course.testFixture.title,
        description: CourseChapter.testFixture.description,
        id: CourseChapter.testFixture.id,
        language: "en",
        organizationSlug: CourseOrganization.testFixture.slug,
        slug: CourseChapter.testFixture.slug,
        title: CourseChapter.testFixture.title)
    ],
    courses: [
      CatalogCourseSearchResult(
        description: Course.testFixture.description,
        id: Course.testFixture.id,
        imageURL: Course.testFixture.imageURL,
        language: Course.testFixture.language,
        organizationSlug: CourseOrganization.testFixture.slug,
        slug: Course.testFixture.slug,
        title: Course.testFixture.title)
    ])
}
