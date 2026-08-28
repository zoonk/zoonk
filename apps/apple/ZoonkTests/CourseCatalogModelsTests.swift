import XCTest

@testable import Zoonk

final class CourseCatalogModelsTests: XCTestCase {
  func testCatalogDetailRoundTripsThroughCodable() throws {
    let organization = CourseOrganization(
      id: "00000000-0000-7000-8000-000000000001",
      logoURL: URL(string: "https://cdn.zoonk.test/organization.png"),
      name: "Zoonk",
      slug: "zoonk")
    let course = Course(
      categories: [.science, .tech],
      description: "Understand the night sky.",
      id: "00000000-0000-7000-8000-000000000002",
      imageURL: URL(string: "https://cdn.zoonk.test/course.png"),
      language: "en",
      organization: organization,
      slug: "astronomy",
      targetLanguage: nil,
      title: "Astronomy")
    let chapter = CourseChapter(
      courseID: course.id,
      description: "Meet our cosmic neighborhood.",
      id: "00000000-0000-7000-8000-000000000003",
      imageURL: nil,
      language: "en",
      lessonCount: 4,
      position: 1,
      slug: "solar-system",
      title: "The Solar System")
    let detail = CourseDetail(course: course, chapters: [chapter])

    let encoded = try JSONEncoder().encode(detail)
    let decoded = try JSONDecoder().decode(CourseDetail.self, from: encoded)

    XCTAssertEqual(decoded, detail)
  }

  func testCatalogEnumsPreservePublicAPIRawValues() {
    XCTAssertEqual(
      CourseCategory.allCases.map(\.rawValue),
      [
        "arts", "business", "communication", "culture", "economics", "engineering",
        "geography", "health", "history", "languages", "law", "math", "science", "society",
        "tech",
      ])
    XCTAssertEqual(
      LessonKind.allCases.map(\.rawValue),
      [
        "alphabet", "custom", "explanation", "grammar", "listening", "practice", "quiz",
        "reading", "review", "translation", "tutorial", "vocabulary",
      ])
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
      continuation: .testLessonFixture,
      course: .testFixture,
      chapters: [.testFixture],
      progress: .testFixture)
    let chapterDetail = ChapterDetail(
      chapter: .resourceTestFixture,
      continuation: .testLessonFixture,
      lessons: [.testFixture],
      progress: .testFixture)

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
    id: "00000000-0000-7000-8000-000000000002",
    imageURL: URL(string: "https://cdn.zoonk.test/course.png"),
    language: "en",
    organization: .testFixture,
    slug: "astronomy",
    title: "Astronomy")

  static let secondTestFixture = CourseSummary(
    description: "Learn how computers work.",
    id: "00000000-0000-7000-8000-000000000003",
    imageURL: nil,
    language: "en",
    organization: .testFixture,
    slug: "computer-science",
    title: "Computer Science")
}

extension Course {
  static let testFixture = Course(
    categories: [.science],
    description: "Understand the night sky.",
    id: CourseSummary.testFixture.id,
    imageURL: CourseSummary.testFixture.imageURL,
    language: "en",
    organization: .testFixture,
    slug: "astronomy",
    targetLanguage: nil,
    title: "Astronomy")
}

extension CourseChapter {
  static let testFixture = CourseChapter(
    courseID: Course.testFixture.id,
    description: "Meet our cosmic neighborhood.",
    id: "00000000-0000-7000-8000-000000000004",
    imageURL: nil,
    language: "en",
    lessonCount: 2,
    position: 0,
    slug: "solar-system",
    title: "The Solar System")

  static let resourceTestFixture = CourseChapter(
    courseID: Course.testFixture.id,
    description: "Meet our cosmic neighborhood.",
    id: "00000000-0000-7000-8000-000000000004",
    imageURL: nil,
    language: "en",
    lessonCount: nil,
    position: 0,
    slug: "solar-system",
    title: "The Solar System")
}

extension CourseLesson {
  static let testFixture = CourseLesson(
    chapterID: CourseChapter.testFixture.id,
    courseID: Course.testFixture.id,
    description: "A first look at our star.",
    id: "00000000-0000-7000-8000-000000000005",
    imageURL: nil,
    kind: .explanation,
    language: "en",
    position: 0,
    slug: "the-sun",
    title: "The Sun")
}

extension CatalogContinuationTarget {
  static let testChapterFixture = CatalogContinuationTarget.chapter(
    CatalogChapterContinuation(
      canPrefetch: false,
      chapterID: CourseChapter.testFixture.id,
      chapterSlug: CourseChapter.testFixture.slug,
      completed: false,
      courseID: Course.testFixture.id,
      courseSlug: Course.testFixture.slug,
      hasStarted: false,
      organizationSlug: CourseOrganization.testFixture.slug))

  static let testLessonFixture = CatalogContinuationTarget.lesson(
    CatalogLessonContinuation(
      canPrefetch: true,
      chapterID: CourseChapter.testFixture.id,
      chapterSlug: CourseChapter.testFixture.slug,
      completed: false,
      courseID: Course.testFixture.id,
      courseSlug: Course.testFixture.slug,
      hasStarted: true,
      lessonID: CourseLesson.testFixture.id,
      lessonPosition: CourseLesson.testFixture.position,
      lessonSlug: CourseLesson.testFixture.slug,
      organizationSlug: CourseOrganization.testFixture.slug))
}

extension CourseProgress {
  static let testFixture = CourseProgress(
    chapters: [
      CourseChapterProgress(
        chapterID: CourseChapter.testFixture.id,
        completedLessons: 1,
        totalLessons: 2)
    ],
    percentComplete: 50)
}

extension ChapterProgress {
  static let testFixture = ChapterProgress(
    lessons: [
      ChapterLessonProgress(
        isCompleted: true,
        lessonID: CourseLesson.testFixture.id)
    ],
    percentComplete: 50)
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
        imageURL: URL(string: "https://cdn.zoonk.test/chapter.png"),
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
