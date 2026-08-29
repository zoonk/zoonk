import Foundation
import SwiftUI

struct CatalogSearchRequest<Item> {
  let items: [Item]
  let locale: Locale
  let query: String

  init(items: [Item], query: String, locale: Locale = .current) {
    self.items = items
    self.locale = locale
    self.query = query
  }
}

func filterCourseChapters(
  _ request: CatalogSearchRequest<CourseChapter>
) -> [CourseChapter] {
  let orderedChapters = request.items.sorted(by: CatalogOrder.chapters)
  let searchTerm = CatalogSearchTerm(query: request.query, locale: request.locale)

  guard !searchTerm.isEmpty else {
    return orderedChapters
  }

  return orderedChapters.filter { searchTerm.matches($0) }
}

func filterCourseLessons(
  _ request: CatalogSearchRequest<CourseLesson>
) -> [CourseLesson] {
  let orderedLessons = request.items.sorted(by: CatalogOrder.lessons)
  let searchTerm = CatalogSearchTerm(query: request.query, locale: request.locale)

  guard !searchTerm.isEmpty else {
    return orderedLessons
  }

  return orderedLessons.filter { searchTerm.matches($0) }
}

func localizedCourseCategories(locale: Locale = .current) -> [CourseCategory] {
  CourseCategory.allCases.sorted {
    String(localized: $0.localizedTitle).compare(
      String(localized: $1.localizedTitle),
      options: [.caseInsensitive, .diacriticInsensitive],
      range: nil,
      locale: locale) == .orderedAscending
  }
}

func catalogText(_ value: String?) -> String? {
  let normalizedValue = value?.trimmingCharacters(in: .whitespacesAndNewlines)
  return normalizedValue?.isEmpty == false ? normalizedValue : nil
}

extension CourseCategory {
  var localizedTitle: LocalizedStringResource {
    switch self {
    case .arts:
      LocalizedStringResource("Arts", table: "Courses", comment: "Course category for the arts.")
    case .business:
      LocalizedStringResource(
        "Business", table: "Courses", comment: "Course category for business.")
    case .communication:
      LocalizedStringResource(
        "Communication", table: "Courses", comment: "Course category for communication.")
    case .culture:
      LocalizedStringResource(
        "Culture", table: "Courses", comment: "Course category for culture.")
    case .economics:
      LocalizedStringResource(
        "Economics", table: "Courses", comment: "Course category for economics.")
    case .engineering:
      LocalizedStringResource(
        "Engineering", table: "Courses", comment: "Course category for engineering.")
    case .geography:
      LocalizedStringResource(
        "Geography", table: "Courses", comment: "Course category for geography.")
    case .health:
      LocalizedStringResource(
        "Health", table: "Courses", comment: "Course category for health.")
    case .history:
      LocalizedStringResource(
        "History", table: "Courses", comment: "Course category for history.")
    case .languages:
      LocalizedStringResource(
        "Languages", table: "Courses", comment: "Course category for languages.")
    case .law:
      LocalizedStringResource("Law", table: "Courses", comment: "Course category for law.")
    case .math:
      LocalizedStringResource(
        "Math", table: "Courses", comment: "Course category for mathematics.")
    case .science:
      LocalizedStringResource(
        "Science", table: "Courses", comment: "Course category for science.")
    case .society:
      LocalizedStringResource(
        "Society", table: "Courses", comment: "Course category for society.")
    case .tech:
      LocalizedStringResource(
        "Technology", table: "Courses", comment: "Course category for technology.")
    }
  }

  var systemImage: String {
    switch self {
    case .arts: "paintpalette"
    case .business: "briefcase"
    case .communication: "bubble.left.and.bubble.right"
    case .culture: "globe"
    case .economics: "chart.line.uptrend.xyaxis"
    case .engineering: "wrench.and.screwdriver"
    case .geography: "map"
    case .health: "heart"
    case .history: "clock.arrow.circlepath"
    case .languages: "character.bubble"
    case .law: "scale.3d"
    case .math: "function"
    case .science: "flask"
    case .society: "person.3"
    case .tech: "cpu"
    }
  }
}

extension LessonKind {
  var localizedTitle: LocalizedStringResource {
    switch self {
    case .alphabet:
      LocalizedStringResource(
        "Alphabet", table: "Courses", comment: "Fallback title for an alphabet lesson.")
    case .custom:
      LocalizedStringResource(
        "Custom lesson", table: "Courses", comment: "Fallback title for a custom lesson.")
    case .explanation:
      LocalizedStringResource(
        "Explanation", table: "Courses", comment: "Fallback title for an explanation lesson.")
    case .grammar:
      LocalizedStringResource(
        "Grammar", table: "Courses", comment: "Fallback title for a grammar lesson.")
    case .listening:
      LocalizedStringResource(
        "Listening", table: "Courses", comment: "Fallback title for a listening lesson.")
    case .practice:
      LocalizedStringResource(
        "Practice", table: "Courses", comment: "Fallback title for a practice lesson.")
    case .quiz:
      LocalizedStringResource(
        "Quiz", table: "Courses", comment: "Fallback title for a quiz lesson.")
    case .reading:
      LocalizedStringResource(
        "Reading", table: "Courses", comment: "Fallback title for a reading lesson.")
    case .review:
      LocalizedStringResource(
        "Review", table: "Courses", comment: "Fallback title for a review lesson.")
    case .translation:
      LocalizedStringResource(
        "Translation", table: "Courses", comment: "Fallback title for a translation lesson.")
    case .tutorial:
      LocalizedStringResource(
        "Tutorial", table: "Courses", comment: "Fallback title for a tutorial lesson.")
    case .vocabulary:
      LocalizedStringResource(
        "Vocabulary", table: "Courses", comment: "Fallback title for a vocabulary lesson.")
    }
  }

  var localizedDescription: LocalizedStringResource {
    switch self {
    case .alphabet:
      LocalizedStringResource(
        "Learn how letters and sounds work in this writing system.",
        table: "Courses",
        comment: "Fallback description for an alphabet lesson.")
    case .custom:
      LocalizedStringResource(
        "Work through a lesson created for your goal.",
        table: "Courses",
        comment: "Fallback description for a custom lesson.")
    case .explanation:
      LocalizedStringResource(
        "Understand the key ideas using everyday language and practical examples.",
        table: "Courses",
        comment: "Fallback description for an explanation lesson.")
    case .grammar:
      LocalizedStringResource(
        "Practice grammar patterns with examples and exercises.",
        table: "Courses",
        comment: "Fallback description for a grammar lesson.")
    case .listening:
      LocalizedStringResource(
        "Listen to sentences using words you recently learned.",
        table: "Courses",
        comment: "Fallback description for a listening lesson.")
    case .practice:
      LocalizedStringResource(
        "Use what you learned in the previous lesson to solve real-world problems.",
        table: "Courses",
        comment: "Fallback description for a practice lesson.")
    case .quiz:
      LocalizedStringResource(
        "Check what you understood with a short quiz.",
        table: "Courses",
        comment: "Fallback description for a quiz lesson.")
    case .reading:
      LocalizedStringResource(
        "Read sentences using words you recently learned.",
        table: "Courses",
        comment: "Fallback description for a reading lesson.")
    case .review:
      LocalizedStringResource(
        "Review this chapter with practice based on your mistakes.",
        table: "Courses",
        comment: "Fallback description for a review lesson.")
    case .translation:
      LocalizedStringResource(
        "Translate words from your previous vocabulary lesson.",
        table: "Courses",
        comment: "Fallback description for a translation lesson.")
    case .tutorial:
      LocalizedStringResource(
        "Follow a guided step-by-step tutorial.",
        table: "Courses",
        comment: "Fallback description for a tutorial lesson.")
    case .vocabulary:
      LocalizedStringResource(
        "Learn new words and practice using them.",
        table: "Courses",
        comment: "Fallback description for a vocabulary lesson.")
    }
  }

  var systemImage: String {
    switch self {
    case .alphabet: "character.book.closed"
    case .custom: "sparkles"
    case .explanation: "lightbulb"
    case .grammar: "textformat"
    case .listening: "headphones"
    case .practice: "pencil.and.scribble"
    case .quiz: "checkmark.circle"
    case .reading: "book.closed"
    case .review: "arrow.clockwise"
    case .translation: "character.bubble"
    case .tutorial: "list.number"
    case .vocabulary: "text.book.closed"
    }
  }

  var symbolTint: Color {
    switch self {
    case .alphabet: .blue
    case .custom: Color(uiColor: .secondaryLabel)
    case .explanation: .blue
    case .grammar: .purple
    case .listening: .red
    case .practice: .green
    case .quiz: .yellow
    case .reading: .yellow
    case .review: .brown
    case .translation: .orange
    case .tutorial: .purple
    case .vocabulary: .green
    }
  }
}

extension CourseLesson {
  func displayTitle() -> String {
    catalogText(title) ?? String(localized: kind.localizedTitle)
  }

  func displayDescription() -> String {
    catalogText(description) ?? String(localized: kind.localizedDescription)
  }
}

private struct CatalogSearchTerm {
  let locale: Locale
  let query: String

  init(query: String, locale: Locale) {
    self.locale = locale
    self.query = query.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  var isEmpty: Bool {
    query.isEmpty
  }

  func matches(_ value: String?) -> Bool {
    guard let value = catalogText(value) else {
      return false
    }

    return value.range(
      of: query,
      options: [.caseInsensitive, .diacriticInsensitive],
      range: nil,
      locale: locale) != nil
  }

  func matches(_ chapter: CourseChapter) -> Bool {
    matches(chapter.title) || matches(chapter.description)
  }

  func matches(_ lesson: CourseLesson) -> Bool {
    matches(lesson.displayTitle())
      || matches(lesson.displayDescription())
      || matches(String(localized: lesson.kind.localizedTitle))
  }
}

private enum CatalogOrder {
  static func chapters(_ left: CourseChapter, _ right: CourseChapter) -> Bool {
    left.position == right.position ? left.id < right.id : left.position < right.position
  }

  static func lessons(_ left: CourseLesson, _ right: CourseLesson) -> Bool {
    left.position == right.position ? left.id < right.id : left.position < right.position
  }
}
