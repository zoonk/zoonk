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

extension CourseLevel {
  var localizedTitle: LocalizedStringResource {
    switch self {
    case .overview:
      LocalizedStringResource(
        "Overview", table: "Courses", comment: "Heading above a course's overview chapters.")
    case .beginner:
      LocalizedStringResource(
        "Beginner", table: "Courses", comment: "Heading above a course's beginner chapters.")
    case .intermediate:
      LocalizedStringResource(
        "Intermediate",
        table: "Courses",
        comment: "Heading above a course's intermediate chapters.")
    case .advanced:
      LocalizedStringResource(
        "Advanced", table: "Courses", comment: "Heading above a course's advanced chapters.")
    }
  }
}

struct CourseLevelBand: Equatable, Identifiable {
  let chapters: [CourseChapter]
  let level: CourseLevel

  var id: CourseLevel { level }
}

/// Groups a course's chapters into level bands from overview to advanced, like the course outline
/// on the web. Chapters keep their order, and empty bands are left out.
func courseLevelBands(_ chapters: [CourseChapter]) -> [CourseLevelBand] {
  CourseLevel.allCases.compactMap { level in
    let bandChapters = chapters.filter { $0.level == level }
    return bandChapters.isEmpty ? nil : CourseLevelBand(chapters: bandChapters, level: level)
  }
}

extension CourseLesson {
  /// Lessons are listed before their titles are written only in rare cases, so they fall back to a
  /// plain label.
  func displayTitle() -> String {
    catalogText(title)
      ?? String(
        localized: LocalizedStringResource(
          "Lesson", table: "Courses", comment: "Fallback title for a lesson without a title."))
  }

  func displayDescription() -> String? {
    catalogText(description)
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
    matches(lesson.displayTitle()) || matches(lesson.displayDescription())
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
