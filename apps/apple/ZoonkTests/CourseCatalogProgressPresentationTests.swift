import XCTest

@testable import Zoonk

final class CourseCatalogProgressPresentationTests: XCTestCase {
  func testPrimaryActionMatchesMainContinuationStates() {
    XCTAssertEqual(catalogPrimaryAction(for: nil), .start)
    XCTAssertEqual(
      catalogPrimaryAction(
        for: .empty(CatalogEmptyContinuation(completed: false, hasStarted: false))),
      .start)
    XCTAssertEqual(
      catalogPrimaryAction(for: continuation(hasStarted: true, completed: false)),
      .continueLearning)
    XCTAssertEqual(
      catalogPrimaryAction(for: continuation(hasStarted: true, completed: true)),
      .review)
  }

  func testChapterProgressUsesNotStartedPartialAndCompletedStates() {
    let chapter = CourseChapter.testFixture

    XCTAssertNil(catalogChapterProgress(chapter: chapter, progress: nil))
    XCTAssertEqual(
      catalogChapterProgress(
        chapter: chapter,
        progress: CourseProgress(chapters: [], percentComplete: 0)),
      .notStarted)
    XCTAssertEqual(
      catalogChapterProgress(
        chapter: chapter,
        progress: CourseProgress(
          chapters: [
            CourseChapterProgress(
              chapterID: chapter.id,
              completedLessons: 1,
              totalLessons: 2)
          ],
          percentComplete: 50)),
      .inProgress(completed: 1, total: 2))
    XCTAssertEqual(
      catalogChapterProgress(
        chapter: chapter,
        progress: CourseProgress(
          chapters: [
            CourseChapterProgress(
              chapterID: chapter.id,
              completedLessons: 2,
              totalLessons: 2)
          ],
          percentComplete: 100)),
      .completed)
  }

  func testLessonProgressUsesCompletionByLessonID() {
    let lesson = CourseLesson.testFixture

    XCTAssertNil(catalogLessonProgress(lesson: lesson, progress: nil))
    XCTAssertEqual(
      catalogLessonProgress(
        lesson: lesson,
        progress: ChapterProgress(lessons: [], percentComplete: 0)),
      .notStarted)
    XCTAssertEqual(
      catalogLessonProgress(
        lesson: lesson,
        progress: ChapterProgress(
          lessons: [ChapterLessonProgress(isCompleted: true, lessonID: lesson.id)],
          percentComplete: 100)),
      .completed)
  }

  func testCourseContinuationFallsBackToFirstChapterWithoutSupplementalData() {
    let detail = CourseDetail(course: .testFixture, chapters: [.testFixture])
    let expectedDestination = CourseDestination.chapter(
      ChapterReference((course: .testFixture, chapter: .testFixture)))

    XCTAssertEqual(courseContinuationDestination(detail), expectedDestination)
    XCTAssertEqual(
      courseContinuationDestination(
        CourseDetail(
          continuation: .empty(
            CatalogEmptyContinuation(completed: false, hasStarted: false)),
          course: .testFixture,
          chapters: [.testFixture])),
      expectedDestination)
  }

  func testChapterContinuationFallsBackToFirstLessonWithoutSupplementalData() {
    let chapter = ChapterReference((course: .testFixture, chapter: .testFixture))
    let detail = ChapterDetail(lessons: [.testFixture])

    XCTAssertEqual(
      chapterContinuationDestination(chapter: chapter, detail: detail),
      .lesson(LessonReference((chapter: chapter, lesson: .testFixture))))
  }

  func testLoadedChapterKeepsTheCourseItWasOpenedFrom() {
    let otherCourse = Course(
      categories: [],
      description: nil,
      generationStatus: .completed,
      id: CourseSummary.secondTestFixture.id,
      imageURL: nil,
      language: "en",
      organization: .testFixture,
      slug: CourseSummary.secondTestFixture.slug,
      targetLanguage: nil,
      title: CourseSummary.secondTestFixture.title)
    let sharedChapter = CourseChapter(
      courseID: otherCourse.id,
      description: CourseChapter.testFixture.description,
      generationStatus: .completed,
      id: CourseChapter.testFixture.id,
      language: "en",
      lessonCount: 2,
      level: .beginner,
      position: 3,
      slug: CourseChapter.testFixture.slug,
      title: CourseChapter.testFixture.title)
    let openedFromOtherCourse = ChapterReference((course: otherCourse, chapter: sharedChapter))

    let refreshed = ChapterReference(
      (reference: openedFromOtherCourse, chapter: .resourceTestFixture))

    XCTAssertEqual(refreshed.courseID, otherCourse.id)
    XCTAssertEqual(refreshed.courseTitle, otherCourse.title)
    XCTAssertEqual(refreshed.position, 3)
    XCTAssertEqual(
      refreshed.key,
      CatalogChapterKey(chapterID: CourseChapter.testFixture.id, courseID: otherCourse.id))
  }

  func testSearchedChapterUsesTheLoadedPositionOnlyInTheSameCourse() {
    let searchResult = CatalogSearchResults.testFixture.chapters[0]
    let otherCoursePlacement = CourseChapter(
      courseID: CourseSummary.secondTestFixture.id,
      description: CourseChapter.testFixture.description,
      generationStatus: .completed,
      id: CourseChapter.testFixture.id,
      language: "en",
      lessonCount: nil,
      level: .beginner,
      position: 5,
      slug: CourseChapter.testFixture.slug,
      title: CourseChapter.testFixture.title)

    XCTAssertEqual(
      ChapterReference((reference: ChapterReference(searchResult), chapter: .resourceTestFixture))
        .position,
      CourseChapter.resourceTestFixture.position)
    XCTAssertNil(
      ChapterReference((reference: ChapterReference(searchResult), chapter: otherCoursePlacement))
        .position)
  }

  func testChaptersGroupIntoLevelBandsInOutlineOrder() {
    let chapters = [
      makeChapter(id: "advanced", level: .advanced, position: 3),
      makeChapter(id: "overview", level: .overview, position: 0),
      makeChapter(id: "beginner-1", level: .beginner, position: 1),
      makeChapter(id: "beginner-2", level: .beginner, position: 2),
    ]

    let bands = courseLevelBands(chapters)

    XCTAssertEqual(bands.map(\.level), [.overview, .beginner, .advanced])
    XCTAssertEqual(bands[1].chapters.map(\.id), ["beginner-1", "beginner-2"])
  }

  private func makeChapter(id: String, level: CourseLevel, position: Int) -> CourseChapter {
    CourseChapter(
      courseID: Course.testFixture.id,
      description: "",
      generationStatus: .completed,
      id: id,
      language: "en",
      lessonCount: 1,
      level: level,
      position: position,
      slug: id,
      title: id)
  }

  private func continuation(
    hasStarted: Bool,
    completed: Bool
  ) -> CatalogContinuationTarget {
    .lesson(
      CatalogLessonContinuation(
        canPrefetch: true,
        chapterID: CourseChapter.testFixture.id,
        chapterSlug: CourseChapter.testFixture.slug,
        completed: completed,
        courseID: Course.testFixture.id,
        courseSlug: Course.testFixture.slug,
        hasStarted: hasStarted,
        lessonID: CourseLesson.testFixture.id,
        lessonPosition: CourseLesson.testFixture.position,
        lessonSlug: CourseLesson.testFixture.slug,
        organizationSlug: CourseOrganization.testFixture.slug))
  }
}
