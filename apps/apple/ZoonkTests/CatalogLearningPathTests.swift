import XCTest

@testable import Zoonk

final class CatalogLearningPathTests: XCTestCase {
  func testChapterTeachingNeverIncludesOptionalSources() {
    let teaching = CourseLesson.testFixture
    let optional = CourseLesson(
      chapterID: teaching.chapterID, courseID: teaching.courseID, description: nil, id: "optional",
      imageURL: nil, kind: .quiz, language: "en", position: 1, slug: "quiz", title: nil,
      sourceLessonID: teaching.id)
    let hidden = CourseLesson(
      chapterID: teaching.chapterID, courseID: teaching.courseID, description: nil, id: "hidden",
      imageURL: nil, kind: .listening, language: "en", position: 2, slug: "listening", title: nil)
    let lessons = [teaching, optional, hidden]
    XCTAssertEqual(ChapterDetail(lessons: lessons).primaryLessons, [teaching, hidden])
  }
  func testSelectedLevelAndFocusedOrderComeFromTheSavedPath() {
    let basic = chapter("a1", level: "a1", position: 0)
    let advanced = chapter("b1", level: "b1", position: 1)
    let later = chapter("b2", level: "b2", position: 2)
    let path = CatalogLearningPath(
      chapterIDs: [advanced.id, later.id], chapterProgress: [], depth: "complete", hasPlan: true,
      needsCurriculumUpdate: false, needsPlan: false, nextChapterID: advanced.id, summary: nil)
    let detail = CourseDetail(
      course: .testFixture, chapters: [basic, advanced, later], learningPath: path)
    XCTAssertEqual(detail.selectedChapters.map(\.id), [advanced.id])
    XCTAssertEqual(detail.availableLevels, ["a1", "b1", "b2"])
    let focused = CatalogLearningPath(
      chapterIDs: [later.id, advanced.id], chapterProgress: [], depth: "focused", hasPlan: true,
      needsCurriculumUpdate: false, needsPlan: false, nextChapterID: later.id, summary: nil)
    XCTAssertEqual(
      CourseDetail(course: .testFixture, chapters: detail.chapters, learningPath: focused)
        .selectedChapters.map(\.id), [later.id, advanced.id])
  }

  func testStaleFocusedPathHasNoFallbackContinuation() {
    let path = CatalogLearningPath(
      chapterIDs: [], chapterProgress: [], depth: "focused", hasPlan: true,
      needsCurriculumUpdate: false, needsPlan: true, nextChapterID: nil, summary: nil)
    let detail = CourseDetail(
      continuation: .testLessonFixture, course: .testFixture, chapters: [.testFixture],
      learningPath: path)
    XCTAssertNil(courseContinuationDestination(detail))
  }

  func testUnknownLessonTotalsDoNotDisplayAnInventedPercentage() {
    let path = CatalogLearningPath(
      chapterIDs: ["first", "pending"],
      chapterProgress: [
        .init(chapterID: "first", completedLessons: 1, totalLessons: 1),
        .init(chapterID: "pending", completedLessons: 0, totalLessons: 0),
      ], depth: "complete", hasPlan: true, needsCurriculumUpdate: false, needsPlan: false,
      nextChapterID: "pending", summary: nil)
    XCTAssertNil(
      CourseDetail(course: .testFixture, chapters: [], learningPath: path).pathProgress?
        .percentComplete)
  }

  func testOwnerPrivateCourseHasARealLibraryDestination() {
    let reference = CourseReference(UserCourseSummary.personalMyCoursesTestFixture)
    XCTAssertEqual(reference.organizationSlug, "me")
    XCTAssertEqual(reference.id, UserCourseSummary.personalMyCoursesTestFixture.id)
  }

  private func chapter(_ id: String, level: String, position: Int) -> CourseChapter {
    CourseChapter(
      courseID: Course.testFixture.id, description: "A focused chapter", id: id, imageURL: nil,
      language: "en", lessonCount: 1, position: position, slug: id, title: id, level: level)
  }
}
