import Foundation

/// Main's `typesetNumbers`: long numbers grouped the learner's way, and a number kept on one line
/// with its unit or money sign.
enum RichTextTypography {
  /// Every run but inline code, as main typesets every segment but math and code.
  static func typesetNumbers(in text: AttributedString, locale: Locale = .courseLanguage)
    -> AttributedString
  {
    text.runs.reduce(into: AttributedString()) { result, run in
      let piece = AttributedString(text[run.range])

      result +=
        run.inlinePresentationIntent?.contains(.code) == true
        ? piece
        : AttributedString(
          typesetNumbers(String(piece.characters), locale: locale), attributes: run.attributes)
    }
  }

  static func typesetNumbers(_ text: String, locale: Locale) -> String {
    guard text.contains(where: \.isWholeNumber) else {
      return text
    }

    return groupingLongNumbers(text, locale: locale)
      .replacing(numberThenUnit) { "\($0.output.1)\u{00A0}" }
      .replacing(currencyThenNumber) { match in
        let sign = String(match.output.1)
        return sign + (ActivityNumberFormat.moneySignGap(sign, locale: locale) ?? "\u{00A0}")
      }
  }

  private static func groupingLongNumbers(_ text: String, locale: Locale) -> String {
    text.replacing(longNumber) { match in
      guard match.output.postalCode == nil,
        text[..<match.range.lowerBound].suffix(1).wholeMatch(of: partOfNumberOrWord) == nil,
        let value = Decimal(string: String(match.output.digits))
      else {
        return String(match.output.0)
      }

      return value.formatted(.number.locale(locale))
    }
  }

  /// Five digits or more without grouping ("350000"), not starting with 0 (a postal code or an ID)
  /// and not followed by more of a decimal, code, date or word. A postal code's label ("ZIP 94103",
  /// "PLZ 10115") or a city's state code ("San Francisco, CA 94103") before it marks a postal code.
  nonisolated(unsafe) private static let longNumber =
    #/
    (?<postalCode>
      (?i: \b (?: zip(?:\ code)? | postal\ code | postcode | plz | postleitzahl | cep | cp
        | code\ postal | código\ postal ) :? \s )
      | ,\s \p{Lu}{2} ,?\s
    )?
    (?<digits> [1-9][0-9]{4,} )
    (?! [0-9\p{L}/-] | [.,][0-9] )
    /#

  /// Main's lookbehind before a long number, which Swift Regex lacks.
  nonisolated(unsafe) private static let partOfNumberOrWord = /[0-9.,\p{L}\/-]/

  /// In their own case: "A" is amperes, "a" is a word.
  private static let units = [
    "%", "°C", "°F", "A", "B", "GB", "GHz", "Hz", "J", "K", "KB", "L", "MB", "MHz", "N", "Pa", "TB",
    "V", "W", "cal", "cm", "cm²", "cm³", "g", "h", "ha", "kHz", "kJ", "kW", "kWh", "kcal", "kg",
    "km", "km/h", "km²", "l", "m", "m/s", "mA", "mL", "mg", "min", "ml", "mm", "mol", "ms", "m²",
    "m³", "nm", "rpm", "s", "t", "µm", "Ω", "kΩ",
  ]

  // The units above are plain text; a pattern that doesn't compile is a programming error.
  nonisolated(unsafe) private static let numberThenUnit = try! Regex(
    "([0-9]) (?=(?:\(units.joined(separator: "|")))(?![\\p{L}0-9]))",
    as: (Substring, Substring).self)

  nonisolated(unsafe) private static let currencyThenNumber = /(\p{Lu}{0,2}\p{Sc}) (?=[0-9])/
}
