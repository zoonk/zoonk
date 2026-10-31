import Foundation

private let supportedCourseCatalogLanguages = Set(["de", "en", "es", "fr", "it", "ja", "ko", "pl", "pt", "tr"])

func currentCourseCatalogLanguage() -> String {
  courseCatalogLanguage(preferredLocalizations: Bundle.main.preferredLocalizations)
}

extension Locale {
  /// Lessons write and read numbers the course language's way, as main does, so a readout never
  /// says "12.000" beside lesson text saying "12,000". The app's own screens keep the device region.
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

extension Course {
  func edition(in language: String) -> CourseEdition? {
    guard baseLanguage(self.language) != language else {
      return nil
    }

    return editions.first { baseLanguage($0.language) == language }
  }
}
