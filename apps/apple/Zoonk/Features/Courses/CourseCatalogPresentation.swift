import Foundation
import SwiftUI

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
    case .exams:
      LocalizedStringResource(
        "Exams", table: "Courses",
        comment: "Course category for exam preparation courses, such as the SAT or ENEM.")
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

/// Chapters keep their order, and empty bands are left out.
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
}
