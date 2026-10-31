import Foundation

extension Locale {
  /// The whole tag, as main names it: "zh-TW" is "Chinese (Taiwan)", not "Chinese". In this
  /// locale's mid-sentence casing ("chinês").
  func languageName(_ tag: String) -> String {
    localizedString(forIdentifier: tag) ?? tag
  }

  /// A language named on its own, capitalized as main lists it ("Chinês (Taiwan)").
  func languageTitle(_ tag: String) -> String {
    let name = languageName(tag)
    return name.prefix(1).uppercased(with: self) + name.dropFirst()
  }
}
