import Foundation

/// Ports of main's prompt text rules from `@zoonk/utils/string`.
enum PromptText {
  private static let quotePairs: [Character: Character] = [
    "\"": "\"", "'": "'", "‘": "’", "“": "”",
  ]
  private static let quotes: Set<Unicode.Scalar> = ["'", "\"", "‘", "’", "“", "”"]

  /// A whole sentence in quotes loses them, unless quotes inside it would then stand alone.
  static func stripWrappingQuotes(_ value: String) -> String {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)

    guard let opener = trimmed.first, let closer = quotePairs[opener], trimmed.count >= 2,
      trimmed.last == closer
    else {
      return value
    }

    let inner = String(trimmed.dropFirst().dropLast())
    return hasStandaloneQuote(inner) ? value : inner.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  /// A quote inside a word, like the apostrophe in "It's", doesn't stand alone.
  private static func hasStandaloneQuote(_ text: String) -> Bool {
    let scalars = Array(text.unicodeScalars)

    return scalars.indices.contains { index in
      guard quotes.contains(scalars[index]) else {
        return false
      }

      let before = index > scalars.startIndex ? scalars[index - 1] : nil
      let after = index + 1 < scalars.endIndex ? scalars[index + 1] : nil
      return !(before.map(isLetterOrNumber) ?? false) || !(after.map(isLetterOrNumber) ?? false)
    }
  }

  /// JavaScript's `\p{L}` and `\p{N}`.
  private static func isLetterOrNumber(_ scalar: Unicode.Scalar) -> Bool {
    switch scalar.properties.generalCategory {
    case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter,
      .decimalNumber, .letterNumber, .otherNumber:
      true
    default:
      false
    }
  }
}
