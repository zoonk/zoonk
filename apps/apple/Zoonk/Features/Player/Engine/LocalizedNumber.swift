import Foundation

/// Reads a number the learner typed, as main's `parseLocalizedNumber`: their locale's decimal comma
/// or a point, the typographic minus and spaces. Nil for anything that isn't one plain number.
func parseLocalizedNumber(_ text: String, locale: Locale) -> Double? {
  let cleaned = text.filter { !$0.isWhitespace }.replacingOccurrences(of: "\u{2212}", with: "-")

  guard cleaned.wholeMatch(of: /[+-]?[0-9.,]+/) != nil else {
    return nil
  }

  let normalized = normalizeSeparators(cleaned, decimal: locale.decimalSeparator ?? ".")

  guard normalized.wholeMatch(of: /[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)/) != nil else {
    return nil
  }

  return Double(normalized)
}

/// When both separators appear, the learner's locale decides which one groups digits.
private func normalizeSeparators(_ text: String, decimal: String) -> String {
  let hasDot = text.contains(".")
  let hasComma = text.contains(",")

  if hasDot, hasComma {
    return decimal == ","
      ? replacingFirst(",", in: text.replacingOccurrences(of: ".", with: ""))
      : text.replacingOccurrences(of: ",", with: "")
  }

  if hasComma {
    return normalizeOneSeparator(text, separator: ",", decimal: decimal)
  }

  return hasDot ? normalizeOneSeparator(text, separator: ".", decimal: decimal) : text
}

/// When only one kind of separator appears, it's a decimal point ("3,5" or "3.5" in any language)
/// unless it groups thousands the locale's way, like "1,000" in English or "1.000" in Portuguese.
private func normalizeOneSeparator(_ text: String, separator: String, decimal: String) -> String {
  let groupsThousands =
    decimal != separator && text.wholeMatch(of: /[+-]?[0-9]{1,3}(?:[.,][0-9]{3})+/) != nil

  return groupsThousands
    ? text.replacingOccurrences(of: separator, with: "") : replacingFirst(separator, in: text)
}

private func replacingFirst(_ separator: String, in text: String) -> String {
  guard let range = text.range(of: separator) else {
    return text
  }

  return text.replacingCharacters(in: range, with: ".")
}
