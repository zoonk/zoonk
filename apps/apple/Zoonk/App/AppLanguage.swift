import Foundation

extension Locale {
  static let appLanguage = formattingLocale(Bundle.main.preferredLocalizations.first ?? "en")
}

/// Zoonk writes Spanish the Mexican way (1,234.56), as main does.
func formattingLocale(_ language: String) -> Locale {
  Locale(identifier: language == "es" ? "es_MX" : language)
}
