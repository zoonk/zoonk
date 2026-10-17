import Foundation

enum CourseDestination: Hashable {
  case course(CourseReference)
  case chapter(ChapterReference)
  case lesson(LessonReference)

  var title: String {
    switch self {
    case .course(let course): course.title
    case .chapter(let chapter): chapter.title
    case .lesson(let lesson): lesson.title
    }
  }

  var showsCompactHeader: Bool {
    switch self {
    case .course, .chapter:
      true
    case .lesson:
      false
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

  /// Private courses open too: the course page reads them with the owner's session.
  init(_ course: UserCourseSummary) {
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

  init(_ source: (course: Course, target: CatalogChapterContinuation)) {
    courseID = source.target.courseID
    courseTitle = source.course.title
    description = ""
    id = source.target.chapterID
    imageURL = source.course.imageURL
    organizationSlug = source.target.organizationSlug
    position = nil
    title = String(
      localized: LocalizedStringResource(
        "Chapter",
        table: "Courses",
        comment: "Fallback title for a chapter continuation target."))
  }

  init(_ source: (course: Course, target: CatalogLessonContinuation)) {
    courseID = source.target.courseID
    courseTitle = source.course.title
    description = ""
    id = source.target.chapterID
    imageURL = source.course.imageURL
    organizationSlug = source.target.organizationSlug
    position = nil
    title = String(
      localized: LocalizedStringResource(
        "Chapter",
        table: "Courses",
        comment: "Fallback title for the chapter containing a continuation lesson."))
  }
}

struct LessonReference: Hashable {
  let chapterTitle: String
  let courseTitle: String
  let id: String
  let title: String

  init(_ source: (chapter: ChapterReference, lesson: CourseLesson)) {
    chapterTitle = source.chapter.title
    courseTitle = source.chapter.courseTitle
    id = source.lesson.id
    title = source.lesson.displayTitle()
  }

  init(_ source: (chapter: ChapterReference, target: CatalogLessonContinuation)) {
    chapterTitle = source.chapter.title
    courseTitle = source.chapter.courseTitle
    id = source.target.lessonID
    title = String(
      localized: LocalizedStringResource(
        "Lesson",
        table: "Courses",
        comment: "Fallback title while the native lesson player is unavailable."))
  }
}

func courseContinuationDestination(_ detail: CourseDetail) -> CourseDestination? {
  guard let continuation = detail.continuation else {
    return firstChapterDestination(detail)
  }

  switch continuation {
  case .empty:
    return firstChapterDestination(detail)
  case .chapter(let target):
    if let chapter = detail.chapters.first(where: { $0.id == target.chapterID }) {
      return .chapter(ChapterReference((course: detail.course, chapter: chapter)))
    }

    return .chapter(ChapterReference((course: detail.course, target: target)))
  case .lesson(let target):
    let chapter = detail.chapters.first(where: { $0.id == target.chapterID })
    let chapterReference =
      chapter.map {
        ChapterReference((course: detail.course, chapter: $0))
      } ?? ChapterReference((course: detail.course, target: target))
    return .lesson(LessonReference((chapter: chapterReference, target: target)))
  }
}

private func firstChapterDestination(_ detail: CourseDetail) -> CourseDestination? {
  guard let chapter = detail.chapters.first else {
    return nil
  }

  return .chapter(ChapterReference((course: detail.course, chapter: chapter)))
}

func chapterContinuationDestination(
  chapter: ChapterReference,
  detail: ChapterDetail
) -> CourseDestination? {
  guard let continuation = detail.continuation else {
    return firstLessonDestination((chapter: chapter, detail: detail))
  }

  switch continuation {
  case .empty:
    return firstLessonDestination((chapter: chapter, detail: detail))
  case .chapter:
    return .chapter(chapter)
  case .lesson(let target):
    if let lesson = detail.lessons.first(where: { $0.id == target.lessonID }) {
      return .lesson(LessonReference((chapter: chapter, lesson: lesson)))
    }

    return .lesson(LessonReference((chapter: chapter, target: target)))
  }
}

private func firstLessonDestination(
  _ source: (chapter: ChapterReference, detail: ChapterDetail)
) -> CourseDestination? {
  guard let lesson = source.detail.lessons.first else {
    return nil
  }

  return .lesson(LessonReference((chapter: source.chapter, lesson: lesson)))
}
