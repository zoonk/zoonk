import Foundation

enum CourseCategory: String, CaseIterable, Codable, Equatable, Sendable {
  case arts
  case business
  case communication
  case culture
  case economics
  case engineering
  case geography
  case health
  case history
  case languages
  case law
  case math
  case science
  case society
  case tech
}

struct CourseOrganization: Codable, Equatable, Identifiable, Sendable {
  let id: String
  let logoURL: URL?
  let name: String
  let slug: String
}

struct CourseSummary: Codable, Equatable, Identifiable, Sendable {
  let description: String?
  let id: String
  let imageURL: URL?
  let language: String
  let organization: CourseOrganization
  let slug: String
  let title: String
}

struct Course: Codable, Equatable, Identifiable, Sendable {
  let categories: [CourseCategory]
  let description: String?
  let id: String
  let imageURL: URL?
  let language: String
  let organization: CourseOrganization
  let slug: String
  let targetLanguage: String?
  let title: String
}

struct CourseChapter: Codable, Equatable, Identifiable, Sendable {
  let courseID: String
  let description: String
  let id: String
  let imageURL: URL?
  let language: String
  let lessonCount: Int?
  let position: Int
  let slug: String
  let title: String
}

enum LessonKind: String, CaseIterable, Codable, Equatable, Sendable {
  case alphabet
  case custom
  case explanation
  case grammar
  case listening
  case practice
  case quiz
  case reading
  case review
  case translation
  case tutorial
  case vocabulary
}

struct CourseLesson: Codable, Equatable, Identifiable, Sendable {
  let chapterID: String
  let courseID: String
  let description: String?
  let id: String
  let imageURL: URL?
  let kind: LessonKind
  let language: String
  let position: Int
  let slug: String
  let title: String?
}

struct CourseCatalogPage: Codable, Equatable, Sendable {
  let courses: [CourseSummary]
  let hasMore: Bool
  let nextCursor: String?

  var canLoadMore: Bool {
    hasMore && nextCursor != nil
  }
}

struct CatalogChapterContinuation: Codable, Equatable, Sendable {
  let canPrefetch: Bool
  let chapterID: String
  let chapterSlug: String
  let completed: Bool
  let courseID: String
  let courseSlug: String
  let hasStarted: Bool
  let organizationSlug: String
}

struct CatalogEmptyContinuation: Codable, Equatable, Sendable {
  let completed: Bool
  let hasStarted: Bool
}

struct CatalogLessonContinuation: Codable, Equatable, Sendable {
  let canPrefetch: Bool
  let chapterID: String
  let chapterSlug: String
  let completed: Bool
  let courseID: String
  let courseSlug: String
  let hasStarted: Bool
  let lessonID: String
  let lessonPosition: Int
  let lessonSlug: String
  let organizationSlug: String
}

enum CatalogContinuationTarget: Codable, Equatable, Sendable {
  case chapter(CatalogChapterContinuation)
  case empty(CatalogEmptyContinuation)
  case lesson(CatalogLessonContinuation)

  var completed: Bool {
    switch self {
    case .chapter(let target): target.completed
    case .empty(let target): target.completed
    case .lesson(let target): target.completed
    }
  }

  var hasStarted: Bool {
    switch self {
    case .chapter(let target): target.hasStarted
    case .empty(let target): target.hasStarted
    case .lesson(let target): target.hasStarted
    }
  }
}

struct CourseChapterProgress: Codable, Equatable, Sendable {
  let chapterID: String
  let completedLessons: Int
  let totalLessons: Int
}

struct CourseProgress: Codable, Equatable, Sendable {
  let chapters: [CourseChapterProgress]
  let percentComplete: Int?
}

struct ChapterLessonProgress: Codable, Equatable, Sendable {
  let isCompleted: Bool
  let lessonID: String
}

struct ChapterProgress: Codable, Equatable, Sendable {
  let lessons: [ChapterLessonProgress]
  let percentComplete: Int?
}

struct CourseDetail: Codable, Equatable, Sendable {
  let continuation: CatalogContinuationTarget?
  let course: Course
  let chapters: [CourseChapter]
  let progress: CourseProgress?

  init(
    continuation: CatalogContinuationTarget? = nil,
    course: Course,
    chapters: [CourseChapter],
    progress: CourseProgress? = nil
  ) {
    self.continuation = continuation
    self.course = course
    self.chapters = chapters
    self.progress = progress
  }
}

struct ChapterDetail: Codable, Equatable, Sendable {
  let chapter: CourseChapter?
  let continuation: CatalogContinuationTarget?
  let lessons: [CourseLesson]
  let progress: ChapterProgress?

  init(
    chapter: CourseChapter? = nil,
    continuation: CatalogContinuationTarget? = nil,
    lessons: [CourseLesson],
    progress: ChapterProgress? = nil
  ) {
    self.chapter = chapter
    self.continuation = continuation
    self.lessons = lessons
    self.progress = progress
  }
}

struct CatalogCourseSearchResult: Codable, Equatable, Identifiable, Sendable {
  let description: String?
  let id: String
  let imageURL: URL?
  let language: String
  let organizationSlug: String
  let slug: String
  let title: String
}

struct CatalogChapterSearchResult: Codable, Equatable, Identifiable, Sendable {
  let courseID: String
  let courseSlug: String
  let courseTitle: String
  let description: String
  let id: String
  let imageURL: URL?
  let language: String
  let organizationSlug: String
  let slug: String
  let title: String
}

struct CatalogSearchResults: Codable, Equatable, Sendable {
  let chapters: [CatalogChapterSearchResult]
  let courses: [CatalogCourseSearchResult]

  var isEmpty: Bool {
    chapters.isEmpty && courses.isEmpty
  }
}

enum CourseCatalogFailure: Error, Codable, Equatable, Sendable {
  case network
  case unavailable
  case notFound
}

enum CourseCatalogLoadState<Value: Codable & Equatable & Sendable>: Codable, Equatable, Sendable {
  case idle
  case loading
  case loaded(Value)
  case empty
  case failed(CourseCatalogFailure)
}

struct CourseCatalogQuery: Equatable, Sendable {
  let category: CourseCategory?
  let cursor: String?
  let language: String
  let limit: Int?

  init(
    category: CourseCategory? = nil,
    cursor: String? = nil,
    language: String,
    limit: Int? = nil
  ) {
    self.category = category
    self.cursor = cursor
    self.language = language
    self.limit = limit
  }
}

struct CatalogSearchQuery: Equatable, Sendable {
  let language: String
  let query: String
}
