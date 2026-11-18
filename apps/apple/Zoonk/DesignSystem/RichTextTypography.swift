import Foundation

/// Main's `typesetNumbers`: long numbers grouped the learner's way, and a number kept on one line
/// with the word, unit or money sign beside it.
enum RichTextTypography {
  /// Every run but inline code, as main typesets every segment but math and code.
  static func typesetNumbers(in text: AttributedString, locale: Locale = .courseLanguage)
    -> AttributedString
  {
    let runs = Array(text.runs)
    return runs.indices.reduce(into: AttributedString()) { result, index in
      let run = runs[index]
      let piece = AttributedString(text[run.range])
      guard run.inlinePresentationIntent?.contains(.code) != true else {
        result += piece
        return
      }

      var value = typesetNumbers(String(piece.characters), locale: locale)
      if index > 0 {
        let before = runs[index - 1]
        if before.inlinePresentationIntent?.contains(.code) != true,
          text[before.range].characters.last?.isASCII == true,
          text[before.range].characters.last?.isNumber == true,
          value.trimmingCharacters(in: .whitespaces).prefixMatch(of: startsWithWord) != nil
        {
          value = value.replacing(/^([ \t])+/, with: "\u{00A0}")
        }
      }
      if index + 1 < runs.count {
        let after = runs[index + 1]
        if after.inlinePresentationIntent?.contains(.code) != true,
          String(text[after.range].characters).prefixMatch(of: startsWithWord) != nil
        {
          value = value.replacing(/([0-9])[ \t]+$/) { "\($0.output.1)\u{00A0}" }
        }
      }
      result += AttributedString(value, attributes: run.attributes)
    }
  }

  static func typesetNumbers(_ text: String, locale: Locale) -> String {
    guard text.contains(where: \.isWholeNumber) else {
      return text
    }

    return groupingLongNumbers(text, locale: locale)
      .replacing(numberThenWord) { "\($0.output.1)\u{00A0}" }
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

  nonisolated(unsafe) private static let numberThenWord = /([0-9])[ \t]+(?=[\p{L}%°])/
  nonisolated(unsafe) private static let startsWithWord = /^[\p{L}%°]/

  nonisolated(unsafe) private static let currencyThenNumber = /(\p{Lu}{0,2}\p{Sc}) (?=[0-9])/
}
