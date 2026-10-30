import Foundation

private let supportedCourseCatalogLanguages = Set(["de", "en", "es", "fr", "pt"])

func currentCourseCatalogLanguage() -> String {
  courseCatalogLanguage(preferredLocalizations: Bundle.main.preferredLocalizations)
}

extension Locale {
  /// Lessons write and read numbers the course language's way, as main does, so a readout never
  /// says "12.000" beside lesson text saying "12,000". The app's own screens keep the device region.
  static let courseLanguage = Locale(identifier: currentCourseCatalogLanguage())
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
