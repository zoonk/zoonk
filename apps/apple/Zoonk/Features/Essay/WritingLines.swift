import Foundation

/// Core's `countWritingLines`: the lines a handwritten sheet would take, at `charactersPerLine`
/// characters a line, erring toward more. A break starts a new line, except one that ends the text;
/// `ignoredFrom` is where the text passes `limit`, in UTF-16 code units as the grade's offsets.
enum WritingLines {
  struct Count: Equatable {
    var estimatedLines: Int
    var ignoredFrom: Int?
  }

  private static let breaks: Set<Character> = ["\r\n", "\r", "\n", "\u{2028}", "\u{2029}"]

  static func count(_ text: String, charactersPerLine: Int, limit: Int?) -> Count {
    var lines = 0
    var used = 0
    var ignoredFrom: Int?
    var offset = 0
    let length = text.utf16.count

    for character in text {
      let isBreak = breaks.contains(character)

      if lines == 0 || (used == charactersPerLine && !isBreak) {
        lines += 1
        used = 0
      }

      if let limit, lines > limit, ignoredFrom == nil {
        ignoredFrom = offset
      }

      if isBreak {
        lines += offset + character.utf16.count < length ? 1 : 0
        used = 0
      } else {
        used += 1
      }

      offset += character.utf16.count
    }

    return Count(estimatedLines: lines, ignoredFrom: ignoredFrom)
  }
}
