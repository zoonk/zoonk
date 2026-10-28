import SwiftUI

enum CourseDestination: Hashable {
  case course(CourseReference)
  case chapter(ChapterReference)

  var title: String {
    switch self {
    case .course(let course): course.title
    case .chapter(let chapter): chapter.title
    }
  }
}

struct CourseReference: Hashable {
  let description: String?
  let id: String
  let imageURL: URL?
  let title: String

  init(_ course: CourseSummary) {
    description = course.description
    id = course.id
    imageURL = course.imageURL
    title = course.title
  }

  init(_ course: Course) {
    description = course.description
    id = course.id
    imageURL = course.imageURL
    title = course.title
  }

  /// A course known only by its id and title, such as the one a plan is built from; its page
  /// reads the rest.
  init(id: String, title: String) {
    description = nil
    self.id = id
    imageURL = nil
    self.title = title
  }

  init(_ result: CatalogCourseSearchResult) {
    description = result.description
    id = result.id
    imageURL = result.imageURL
    title = result.title
  }
}

/// A chapter opened from one course. The course context comes from where the learner came from,
/// because a shared chapter belongs to several courses and has a position in each. Chapters have no
/// artwork of their own, so the course's icon stands in when the course is known.
struct ChapterReference: Hashable {
  let courseID: String
  let courseTitle: String
  let description: String
  let id: String
  let imageURL: URL?
  /// Null for a chapter opened from a learner's private course.
  let organizationSlug: String?
  let position: Int?
  let title: String

  var key: CatalogChapterKey {
    CatalogChapterKey(chapterID: id, courseID: courseID)
  }

  init(_ source: (course: Course, chapter: CourseChapter)) {
    courseID = source.course.id
    courseTitle = source.course.title
    description = source.chapter.description
    id = source.chapter.id
    imageURL = source.course.imageURL
    organizationSlug = source.course.organization?.slug
    position = source.chapter.position
    title = source.chapter.title
  }

  init(_ result: CatalogChapterSearchResult) {
    courseID = result.courseID
    courseTitle = result.courseTitle
    description = result.description
    id = result.id
    imageURL = nil
    organizationSlug = result.organizationSlug
    position = nil
    title = result.title
  }

  /// Refreshes the chapter's own details while keeping the course it was opened from. The loaded
  /// position only applies when the chapter was loaded in that same course.
  init(_ source: (reference: ChapterReference, chapter: CourseChapter)) {
    courseID = source.reference.courseID
    courseTitle = source.reference.courseTitle
    description = source.chapter.description
    id = source.chapter.id
    imageURL = source.reference.imageURL
    organizationSlug = source.reference.organizationSlug
    position =
      source.reference.position
      ?? (source.chapter.courseID == source.reference.courseID ? source.chapter.position : nil)
    title = source.chapter.title
  }
}

extension View {
  /// The catalog's course and chapter pages, pushed on the stack that shows them.
  func catalogDestinations() -> some View {
    navigationDestination(for: CourseDestination.self) { destination in
      Group {
        switch destination {
        case .course(let course):
          CourseView(course: course)
        case .chapter(let chapter):
          ChapterView(chapter: chapter)
        }
      }
      .navigationTitle(destination.title)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar(removing: .title)
    }
  }
}
