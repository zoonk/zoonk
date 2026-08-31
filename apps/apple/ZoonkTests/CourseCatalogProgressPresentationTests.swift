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
