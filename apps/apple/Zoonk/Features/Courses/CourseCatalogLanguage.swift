import Foundation

private let supportedCourseCatalogLanguages = Set(["de", "en", "es", "fr", "pt"])

func currentCourseCatalogLanguage() -> String {
  courseCatalogLanguage(preferredLocalizations: Bundle.main.preferredLocalizations)
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
  /// The edition in the reader's language (`language`) when this one is written in another, which
  /// its page points to (main's `EditionNotice`).
  func edition(in language: String) -> CourseEdition? {
    guard baseLanguage(self.language) != language else {
      return nil
    }

    return editions.first { baseLanguage($0.language) == language }
  }
}
