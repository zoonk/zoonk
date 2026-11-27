import Foundation

/// Core's `countWritingLines`: the lines a handwritten sheet would take, erring toward more. A
/// paragraph starts on the next line, none is left blank between paragraphs, and a space never
/// starts a line, so only text opens one. `estimatedLines` counts at a typical hand
/// (`charactersPerLine`); `ignoredFrom` is the start of the word that passes `limit` even at the
/// densest published hand (`maxCharactersPerLine`), in UTF-16 code units as the grade's offsets.
enum WritingLines {
  struct Count: Equatable {
    var estimatedLines: Int
    var ignoredFrom: Int?
  }

  private static let breaks: Set<Character> = ["\r\n", "\r", "\n", "\u{2028}", "\u{2029}"]

  static func estimate(_ text: String, charactersPerLine: Int) -> Int {
    lines(text, charactersPerLine: charactersPerLine, limit: nil).lines
  }

  static func count(
    _ text: String, charactersPerLine: Int, maxCharactersPerLine: Int, limit: Int?
  ) -> Count {
    Count(
      estimatedLines: estimate(text, charactersPerLine: charactersPerLine),
      ignoredFrom: lines(text, charactersPerLine: maxCharactersPerLine, limit: limit).passedFrom)
  }

  private static func lines(
    _ text: String, charactersPerLine: Int, limit: Int?
  ) -> (lines: Int, passedFrom: Int?) {
    var lines = 0
    var used = 0
    var broken = false
    var passedFrom: Int?
    var wordStart = 0
    var offset = 0

    for character in text {
      let isSpace = character.unicodeScalars.allSatisfy(\.properties.isWhitespace)

      if breaks.contains(character) {
        broken = lines > 0
      } else if !isSpace {
        if lines == 0 || broken || used == charactersPerLine {
          lines += 1
          used = 0
          broken = false
        }

        if let limit, lines > limit, passedFrom == nil {
          passedFrom = wordStart
        }

        used += 1
      } else if lines > 0, !broken, used < charactersPerLine {
        used += 1
      }

      offset += character.utf16.count

      if isSpace {
        wordStart = offset
      }
    }

    return (lines, passedFrom)
  }
}
