import Foundation

struct ReadingPromptWord: Hashable {
  let word: String
  let translation: String?
}

/// Main's `buildReadingPromptWordHints` and the text rules it reads, from `@zoonk/utils/string`.
enum ReadingPromptHints {
  /// Each prompt word pairs with the sentence word whose translation it is; the words left over
  /// pair up in order, so every hinted word shows one translation.
  static func words(
    in prompt: String, sentenceWordOptions: [LanguageExercise.WordOption]
  ) -> [ReadingPromptWord] {
    let words = segmentWords(prompt)
    let targets = sentenceWordOptions.compactMap { option -> (key: String, translation: String)? in
      let key = matchKey(option.translation ?? "")
      let translation = trimPunctuation(option.word)
      return key.isEmpty || translation.isEmpty ? nil : (key, translation)
    }

    var used = Set<Int>()
    let direct = words.map { word -> Int? in
      let key = matchKey(word)
      let index = targets.indices.first { !used.contains($0) && targets[$0].key == key }
      if let index { used.insert(index) }
      return index
    }

    let leftoverWords = direct.indices.filter { direct[$0] == nil }
    let leftoverTargets = targets.indices.filter { !used.contains($0) }
    let fallback = Dictionary(uniqueKeysWithValues: zip(leftoverWords, leftoverTargets))

    return words.indices.map { index in
      ReadingPromptWord(
        word: words[index],
        translation: (direct[index] ?? fallback[index]).map { targets[$0].translation })
    }
  }

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

  /// ICU's dictionary word breaks, which main's `Intl.Segmenter` and Android's `BreakIterator` use;
  /// Foundation's `.byWords` splits words they keep whole ("新幹線").
  private static let wordBoundary = try! NSRegularExpression(
    pattern: #"\b"#, options: .useUnicodeWordBoundaries)

  /// A sentence's words, punctuation kept on the word it follows. Text without spaces (Japanese,
  /// Chinese, Thai) splits at the words a dictionary finds, with connector-linked runs
  /// ("gato-123") kept whole.
  static func segmentWords(_ text: String) -> [String] {
    let normalized = LessonGrading.normalizePunctuation(text)

    if normalized.contains(" ") {
      return normalized.split(separator: " ").map(String.init)
    }

    let breaks = wordBoundary.matches(
      in: normalized, range: NSRange(normalized.startIndex..., in: normalized)
    ).compactMap { Range($0.range, in: normalized)?.lowerBound }
    let cuts = Set([normalized.startIndex, normalized.endIndex] + breaks).sorted()

    var tokens: [String] = []
    var prefix = ""

    for (start, end) in zip(cuts, cuts.dropFirst()) {
      let segment = normalized[start..<end]

      if !segment.unicodeScalars.contains(where: isLetterOrNumber) {
        if tokens.isEmpty {
          prefix += segment
        } else {
          tokens[tokens.count - 1] += segment
        }
      } else if let last = tokens.last?.last, "-'’‐‑‒–".contains(last) {
        tokens[tokens.count - 1] += segment
      } else {
        tokens.append(prefix + segment)
        prefix = ""
      }
    }

    return tokens
  }

  private static func matchKey(_ word: String) -> String {
    let letters = String(
      word.unicodeScalars.filter { $0.properties.isWhitespace || LessonGrading.isWordCharacter($0) }
    )
    let unaccented = String(
      letters.decomposedStringWithCanonicalMapping.unicodeScalars.filter {
        !(0x300...0x36F).contains($0.value)
      }
    ).precomposedStringWithCanonicalMapping

    return unaccented.lowercased().split(whereSeparator: \.isWhitespace).joined(separator: " ")
  }

  private static func trimPunctuation(_ word: String) -> String {
    let scalars = word.unicodeScalars

    guard let first = scalars.firstIndex(where: LessonGrading.isWordCharacter),
      let last = scalars.lastIndex(where: LessonGrading.isWordCharacter)
    else {
      return ""
    }

    return String(scalars[first...last])
  }
}
