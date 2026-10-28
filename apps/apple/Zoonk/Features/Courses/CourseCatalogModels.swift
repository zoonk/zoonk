import Foundation

enum CourseCategory: String, CaseIterable, Codable, Equatable, Sendable {
  case arts
  case business
  case communication
  case culture
  case economics
  case engineering
  case exams
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

/// Where the server is in writing a course's chapter outline or a chapter's lesson outline. After a
/// content reset, a course can be listed before its chapters exist, and a chapter before its
/// lessons. Pending outlines are written when the first learner starts them.
enum CatalogGenerationStatus: String, Codable, Equatable, Sendable {
  case completed
  case failed
  case pending
  case running
}

/// The level band a course places a chapter in, from overview to advanced.
enum CourseLevel: String, CaseIterable, Codable, Equatable, Sendable {
  case overview
  case beginner
  case intermediate
  case advanced
}

struct CourseOrganization: Codable, Equatable, Identifiable, Sendable {
  let id: String
  let logoURL: URL?
  let name: String
  let slug: String
}

/// A course in the catalog's list: what its cell shows, its mark, subject, words and numbers.
struct CourseSummary: Codable, Equatable, Identifiable, Sendable {
  let description: String?
  /// Every lesson of its outline added up, as its page states its length.
  let estimatedMinutes: Int
  let id: String
  let imageURL: URL?
  let language: String
  let languageFlag: String?
  /// 0 while its lessons aren't written yet.
  let lessonCount: Int
  let organization: CourseOrganization
  let slug: String
  let subject: CourseCategory?
  let targetLanguage: String?
  let title: String
}

/// A course's details. A learner's own private course has no organization and is only readable with
/// their session.
struct Course: Codable, Equatable, Identifiable, Sendable {
  /// Oldest first: the first is the course's subject.
  let categories: [CourseCategory]
  let description: String?
  /// The course's published editions in every language, itself included.
  let editions: [CourseEdition]
  /// The page's example plan; nil for a learner's private course.
  let examplePlan: CoursePlanExample?
  let generationStatus: CatalogGenerationStatus
  let id: String
  let imageURL: URL?
  let isExam: Bool
  /// The page's copy; nil until the course's details are written.
  let landingPage: CourseLandingPage?
  let language: String
  let languageFlag: String?
  let organization: CourseOrganization?
  let slug: String
  let targetLanguage: String?
  let title: String

  var subject: CourseCategory? { categories.first }
}

/// The same course written in one language.
struct CourseEdition: Codable, Equatable, Identifiable, Sendable {
  let id: String
  let language: String
  let title: String
}

/// A course page's own words: its promise, who it's for and what it makes them able to do.
struct CourseLandingPage: Codable, Equatable, Sendable {
  let audience: [String]
  let outcomes: [String]
  let valueProposition: String
}

/// A chapter as one course places it. Chapters can be shared by several courses, so `courseID`,
/// `level` and `position` describe the course the chapter was listed or fetched in, not its only
/// parent. `position` counts from 0 across the course's whole outline.
struct CourseChapter: Codable, Equatable, Identifiable, Sendable {
  let courseID: String
  let description: String
  let generationStatus: CatalogGenerationStatus
  let id: String
  let language: String
  let lessonCount: Int?
  /// The chapter's lessons as its course's outline lists them; empty when read on its own.
  let lessons: [CourseOutlineLesson]
  let level: CourseLevel
  /// What the chapter teaches, one line each.
  let objectives: [String]
  let position: Int
  let slug: String
  let title: String
}

/// A lesson in a course's outline: its title and how long it takes.
struct CourseOutlineLesson: Codable, Equatable, Identifiable, Sendable {
  let estimatedMinutes: Int
  let id: String
  let title: String
}

/// A lesson as one chapter lists it. Lessons can be shared by several chapters, so `chapterID`,
/// `courseID` and `position` describe the listing, not the lesson's only parent.
struct CourseLesson: Codable, Equatable, Identifiable, Sendable {
  let chapterID: String
  let courseID: String
  let description: String?
  let estimatedMinutes: Int
  let generationStatus: CatalogGenerationStatus
  let id: String
  let language: String
  let position: Int
  let slug: String
  let title: String?

  /// An unwritten lesson is written when someone opens it.
  var isWritten: Bool {
    generationStatus == .completed
  }
}

/// Identifies a chapter page by the course it was opened from, since a shared chapter shows a
/// different position and course in each course.
struct CatalogChapterKey: Hashable, Sendable {
  let chapterID: String
  let courseID: String
}

/// How many listed courses the catalog has in all and in each category, in one language.
struct CourseCategoryCounts: Equatable, Sendable {
  let counts: [CourseCategory: Int]
  let total: Int
}

struct CourseCatalogPage: Codable, Equatable, Sendable {
  let courses: [CourseSummary]
  let hasMore: Bool
  let nextCursor: String?

  var canLoadMore: Bool {
    hasMore && nextCursor != nil
  }
}

/// A course page: the course and its chapters, with the lesson "Try a lesson" opens, the first
/// written one of its first chapter, when there's one.
struct CourseDetail: Codable, Equatable, Sendable {
  let course: Course
  let chapters: [CourseChapter]
  var tryLessonID: String? = nil
}

struct ChapterDetail: Codable, Equatable, Sendable {
  let chapter: CourseChapter?
  let lessons: [CourseLesson]

  /// The chapter's first written lesson, which "Try a lesson" opens.
  var tryLessonID: String? {
    firstWrittenLessonID(lessons)
  }
}

/// The first lesson whose content is written: trying it costs nothing and opens at once.
func firstWrittenLessonID(_ lessons: [CourseLesson]) -> String? {
  lessons.first(where: \.isWritten)?.id
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
