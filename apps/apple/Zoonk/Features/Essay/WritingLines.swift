import Foundation

/// Core's `countWritingLines`: the lines a handwritten sheet would take at a typical hand of
/// `charactersPerLine`, erring toward more. A line break starts a line and a blank line takes none,
/// since a sheet skips no line between paragraphs. `ignoredFrom` is where the text passes `limit`
/// even at `denseCharactersPerLine`, in UTF-16 code units as the grade's offsets.
enum WritingLines {
  struct Count: Equatable {
    var estimatedLines: Int
    var ignoredFrom: Int?
  }

  /// Whether a text fits its sheet at a typical hand, only in small handwriting, or not even then.
  enum Fit: Equatable {
    case fits
    case smallHandwriting
    case over
  }

  private static let breaks: Set<Character> = ["\r\n", "\r", "\n", "\u{2028}", "\u{2029}"]

  static func count(
    _ text: String, charactersPerLine: Int, denseCharactersPerLine: Int, limit: Int?
  ) -> Count {
    Count(
      estimatedLines: estimate(text, charactersPerLine: charactersPerLine),
      ignoredFrom: layOut(text, perLine: denseCharactersPerLine, limit: limit).pastLimitFrom)
  }

  static func estimate(_ text: String, charactersPerLine: Int) -> Int {
    layOut(text, perLine: charactersPerLine, limit: nil).lines
  }

  static func fit(_ text: String, writing: WritingPrompt) -> (count: Count, fit: Fit)? {
    guard let limit = writing.lines else { return nil }

    let count = count(
      text, charactersPerLine: writing.charactersPerLine,
      denseCharactersPerLine: writing.denseCharactersPerLine, limit: limit)

    if count.ignoredFrom != nil { return (count, .over) }
    return (count, count.estimatedLines > limit ? .smallHandwriting : .fits)
  }

  private static func layOut(_ text: String, perLine: Int, limit: Int?) -> (
    lines: Int, pastLimitFrom: Int?
  ) {
    var lines = 0
    var pastLimitFrom: Int?
    var line: [Int] = []
    var isBlank = true
    var offset = 0

    func endLine() {
      if !isBlank {
        for (position, start) in line.enumerated()
        where pastLimitFrom == nil && limit.map({ lines + position / perLine >= $0 }) == true {
          pastLimitFrom = start
        }

        lines += (line.count + perLine - 1) / perLine
      }

      line = []
      isBlank = true
    }

    for character in text {
      if breaks.contains(character) {
        endLine()
      } else {
        line.append(offset)
        isBlank = isBlank && character.unicodeScalars.allSatisfy(\.properties.isWhitespace)
      }

      offset += character.utf16.count
    }

    endLine()
    return (lines, pastLimitFrom)
  }
}
