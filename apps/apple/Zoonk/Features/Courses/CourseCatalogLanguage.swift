import Foundation

private let supportedCourseCatalogLanguages = Set([
  "de", "en", "es", "fr", "it", "ja", "ko", "pl", "pt", "tr",
])

func currentCourseCatalogLanguage() -> String {
  courseCatalogLanguage(preferredLocalizations: Bundle.main.preferredLocalizations)
}

extension Locale {
  /// Lessons write and read numbers the course language's way, as main does, so a readout never
  /// says "12.000" beside lesson text saying "12,000". Durations take it too, as main's. The app's
  /// other screens keep the device region.
  static let courseLanguage = formattingLocale(currentCourseCatalogLanguage())
}

/// Zoonk writes Spanish the Mexican way (1,234.56), as main does.
func formattingLocale(_ language: String) -> Locale {
  Locale(identifier: language == "es" ? "es_MX" : language)
}

func courseCatalogLanguage(preferredLocalizations: [String]) -> String {
  preferredLocalizations
    .lazy
    .map(baseLanguage)
    .first(where: supportedCourseCatalogLanguages.contains) ?? "en"
}

private func baseLanguage(_ localization: String) -> String {
  localization
    .lowercased()
    .split(whereSeparator: { $0 == "-" || $0 == "_" })
    .first
    .map(String.init) ?? ""
}

/// Which course a start in the app's language uses, as core's `resolveCourseStartLanguage` decides.
enum CourseStartLanguage: Equatable {
  case same
  /// The course's version in the app's language.
  case edition(CourseEdition)
  /// No version in the app's language: the plan is written in it from the course's subject.
  case learnerLanguage(String)
}

extension Course {
  func startLanguage(in language: String) -> CourseStartLanguage {
    guard baseLanguage(self.language) != language else {
      return .same
    }

    let matches = editions.filter { baseLanguage($0.language) == language }

    if let edition = matches.first, matches.count == 1 {
      return .edition(edition)
    }

    return .learnerLanguage(language)
  }

  func edition(in language: String) -> CourseEdition? {
    guard baseLanguage(self.language) != language else {
      return nil
    }

    return editions.first { baseLanguage($0.language) == language }
  }
}
