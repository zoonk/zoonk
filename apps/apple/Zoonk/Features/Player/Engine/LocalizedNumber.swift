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

/// The most decimals a number shows, as `Intl.NumberFormat` allows.
private let maxFractionDigits = 20

/// A number the way people read it in their language, as main's `formatLocalizedNumber`: rounded
/// for display only (grading uses the full value), with a typographic minus that reads as a sign.
func formatLocalizedNumber(
  _ value: Double, fractionDigits: Int, locale: Locale, grouping: Bool = false
) -> String {
  let digits = min(max(fractionDigits, 0), maxFractionDigits)
  let formatted = value.formatted(
    .number.precision(.fractionLength(0...digits)).grouping(grouping ? .automatic : .never)
      .locale(locale))

  return formatted.hasPrefix("-") ? "\u{2212}" + formatted.dropFirst() : formatted
}

/// Decimals worth showing for a value's size (main's `fractionDigitsFor`): none for thousands, one
/// for tens, two for ones and three significant digits below one, so a readout never shows float
/// noise and a tiny value never rounds to 0.
func fractionDigitsFor(_ value: Double) -> Int {
  let size = abs(value)

  if size >= 1000 {
    return 0
  }

  if size >= 10 {
    return 1
  }

  if size >= 1 {
    return 2
  }

  if size == 0 {
    return 3
  }

  let leadingZeros = max(0, -Int(log10(size).rounded(.down)) - 1)
  return min(maxFractionDigits, leadingZeros + 3)
}

/// One precision for an expected answer and the learner's value (main's `exactFractionDigitsFor`):
/// the tolerance sets the smallest meaningful decimal, and a wrong answer keeps a digit beyond
/// their difference, so rounding can't make both read the same. Zero tolerance keeps them all.
func exactFractionDigitsFor(
  expected: Double, tolerance: ActivityCheck.Tolerance, value: Double? = nil
) -> Int {
  let value = value ?? expected
  let allowed = tolerance.kind == .absolute ? tolerance.value : tolerance.value * abs(expected)

  guard allowed != 0 else {
    return maxFractionDigits
  }

  let difference = abs(value - expected)
  let differenceDigits = difference > allowed ? digitsForResolution(difference) + 1 : 0

  return min(
    maxFractionDigits,
    max(
      2, fractionDigitsFor(expected), fractionDigitsFor(value), digitsForResolution(allowed),
      differenceDigits))
}

/// Decimals needed to keep rounding smaller than a positive resolution.
private func digitsForResolution(_ resolution: Double) -> Int {
  max(0, Int((-log10(resolution)).rounded(.up)))
}
