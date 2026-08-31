import Foundation
import XCTest

@testable import Zoonk

final class CourseCatalogSearchTests: XCTestCase {
  func testChapterSearchIgnoresCaseAndDiacriticsWhilePreservingCourseOrder() {
    let chapters = [
      makeChapter(id: "third", description: "Advanced work", position: 2, title: "Canopy"),
      makeChapter(id: "first", description: "Meet the café garden", position: 0, title: "Roots"),
      makeChapter(id: "second", description: "Water and light", position: 1, title: "Leaves"),
    ]

    let matches = filterCourseChapters(
      CatalogSearchRequest(items: chapters, query: "CAFE", locale: Locale(identifier: "en_US")))

    XCTAssertEqual(matches.map(\.id), ["first"])
  }

  func testBlankChapterSearchReturnsTheCurriculumInPositionOrder() {
    let chapters = [
      makeChapter(id: "second", description: "", position: 1, title: "Leaves"),
      makeChapter(id: "first", description: "", position: 0, title: "Roots"),
    ]

    let matches = filterCourseChapters(
      CatalogSearchRequest(items: chapters, query: "  \n", locale: Locale(identifier: "en_US")))

    XCTAssertEqual(matches.map(\.id), ["first", "second"])
  }

  func testLessonSearchMatchesStoredDescriptionsAndPreservesLessonOrder() {
    let lessons = [
      makeLesson(id: "second", description: "Practice conversation", position: 1),
      makeLesson(id: "first", description: "Listen at a café", position: 0),
    ]

    let matches = filterCourseLessons(
      CatalogSearchRequest(items: lessons, query: "cafe", locale: Locale(identifier: "en_US")))

    XCTAssertEqual(matches.map(\.id), ["first"])
  }

  func testBlankLessonContentUsesSearchableLocalizedKindFallbacks() {
    let lesson = CourseLesson(
      chapterID: "chapter",
      courseID: "course",
      description: " \n",
      id: "listening",
      imageURL: nil,
      kind: .listening,
      language: "en",
      position: 0,
      slug: "listening",
      title: " ")
    let fallbackTitle = String(localized: LessonKind.listening.localizedTitle)
    let fallbackDescription = String(localized: LessonKind.listening.localizedDescription)

    XCTAssertEqual(lesson.displayTitle(), fallbackTitle)
    XCTAssertEqual(lesson.displayDescription(), fallbackDescription)

    let matches = filterCourseLessons(
      CatalogSearchRequest(
        items: [lesson],
        query: fallbackTitle,
        locale: Locale(identifier: "en_US")))

    XCTAssertEqual(matches.map(\.id), [lesson.id])
  }

  private func makeChapter(
    id: String,
    description: String,
    position: Int,
    title: String
  ) -> CourseChapter {
    CourseChapter(
      courseID: "course",
      description: description,
      id: id,
      imageURL: nil,
      language: "en",
      lessonCount: 2,
      position: position,
      slug: id,
      title: title)
  }

  private func makeLesson(
    id: String,
    description: String,
    position: Int
  ) -> CourseLesson {
    CourseLesson(
      chapterID: "chapter",
      courseID: "course",
      description: description,
      id: id,
      imageURL: nil,
      kind: .listening,
      language: "en",
      position: position,
      slug: id,
      title: nil)
  }
}
