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

  /// "Spanish (Argentina)" with the country the learner chose, "Spanish" without: never from a
  /// goal's flag, so no country shows that they didn't choose.
  func varietyName(language: String, region: String?) -> String {
    languageTitle(varietyTag(language: language, region: region))
  }

  /// `varietyName` inside a sentence, in this locale's mid-sentence casing ("espanhol (Argentina)").
  func varietyNameInSentence(language: String, region: String?) -> String {
    languageName(varietyTag(language: language, region: region))
  }
}

private func varietyTag(language: String, region: String?) -> String {
  region.map { "\(language)-\($0)" } ?? language
}
