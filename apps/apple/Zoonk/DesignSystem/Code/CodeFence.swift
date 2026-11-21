import Foundation

/// Main's `code-fence`: a CommonMark fenced code block, written with backticks or tildes and closed
/// by a line of the same character at least as long. A backtick fence's info string can't hold a
/// backtick, so "```x```" stays inline code.
struct CodeFence: Equatable {
  /// The lines between the fences as written, less the opening fence's own indentation.
  let code: String
  /// The info string's first word, lowercased, such as `python`.
  let language: String?
  let isClosed: Bool
  /// The opening fence's line.
  let start: Int
  /// The line after the closing fence; a fence that never closes runs to the text's end.
  let end: Int

  static func read(_ lines: [String], at index: Int) -> CodeFence? {
    guard lines.indices.contains(index), let opening = lines[index].wholeMatch(of: openingFence)
    else {
      return nil
    }

    let fence = opening.output.fence
    let indent = opening.output.indent.count
    // A fence is one character repeated, so a closing one as long or longer starts with the opening one.
    let close = lines.indices.first { line in
      line > index
        && lines[line].wholeMatch(of: closingFence)?.output.fence.hasPrefix(fence) == true
    }

    return CodeFence(
      code: lines[(index + 1)..<(close ?? lines.count)]
        .map { line in String(line.dropFirst(min(indent, line.prefix { $0 == " " }.count))) }
        .joined(separator: "\n"),
      language: opening.output.info.split(whereSeparator: \.isWhitespace).first?.lowercased(),
      isClosed: close != nil, start: index, end: close.map { $0 + 1 } ?? lines.count)
  }

  /// A text that is one closed code block and nothing else, such as an answer option that is code.
  static func whole(_ text: String) -> CodeFence? {
    let lines = RichTextBlock.lines(text.trimmingCharacters(in: .whitespacesAndNewlines))

    return read(lines, at: 0).flatMap { $0.isClosed && $0.end == lines.count ? $0 : nil }
  }

  static func all(in lines: [String]) -> [CodeFence] {
    var fences: [CodeFence] = []
    var index = 0

    while index < lines.count {
      if let fence = read(lines, at: index) {
        fences.append(fence)
        index = fence.end
      } else {
        index += 1
      }
    }

    return fences
  }

  /// Every line a fence covers, its fences included: code, where nothing is parsed.
  static func lines(in lines: [String]) -> IndexSet {
    all(in: lines).reduce(into: IndexSet()) { $0.insert(integersIn: $1.start..<$1.end) }
  }

  /// Main's `parseRichLine`, for text drawn on one line such as an answer quoted in a sentence:
  /// `prose` reads its words, and each code block reads as one run of inline code, its lines
  /// trimmed and joined, a space apart from the words around it.
  static func line(_ text: String, prose: (String) -> RichInline) -> RichInline {
    let lines = RichTextBlock.lines(text)
    let fences = all(in: lines)

    guard !fences.isEmpty else {
      return prose(text)
    }

    var pieces: [RichInline] = []
    var from = 0

    for fence in fences {
      pieces.append(prose(lines[from..<fence.start].joined(separator: "\n")))
      pieces.append(RichInline(text: fence.inlineCode))
      from = fence.end
    }

    pieces.append(prose(lines[from...].joined(separator: "\n")))

    return pieces.filter { !$0.said.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
      .enumerated()
      .reduce(RichInline(text: AttributedString())) { line, piece in
        piece.offset == 0 ? piece.element : line + RichInline(text: " ") + piece.element
      }
  }

  /// The code as one run of inline code, for a line that can't show a block.
  var inlineCode: AttributedString {
    var run = AttributedString(CodeBreaks.insertedInLongWords(into: Self.oneLine(code)))
    run.inlinePresentationIntent = .code
    return run
  }

  /// Code's lines on one line, each without its indentation, as main's one-line code reads it.
  static func oneLine(_ code: String) -> String {
    code.split(separator: "\n", omittingEmptySubsequences: false)
      .map { $0.trimmingCharacters(in: .whitespaces) }
      .filter { !$0.isEmpty }
      .joined(separator: " ")
  }

  // Regex isn't Sendable, but these are built once and never mutated: matching only reads them.
  nonisolated(unsafe) private static let openingFence =
    /(?<indent>[ ]{0,3})(?<fence>`{3,}(?=[^`]*$)|~{3,})(?<info>.*)/
  nonisolated(unsafe) private static let closingFence = /[ ]{0,3}(?<fence>`{3,}|~{3,})[ ]*/
}

/// Main's `code-breaks`: where a wrapped line of code reads best when it splits, before a `.` and
/// after an opening bracket or a comma, never inside an empty pair (`()`). Text breaks at a zero
/// width space, which draws nothing and isn't spoken.
enum CodeBreaks {
  static let mark: Character = "\u{200B}"

  static func inserted(into text: String) -> String {
    var result = ""
    var previous: Character?

    for character in text {
      if let previous, breaks(between: previous, and: character) {
        result.append(mark)
      }

      result.append(character)
      previous = character
    }

    return result
  }

  /// Main's `withWordBreakPoints`, for inline code in a sentence: a word this short fits on a line
  /// of the narrowest column, larger text included, so it moves to the next line whole; only a
  /// longer one splits at its break points.
  static func insertedInLongWords(into text: String) -> String {
    var result = ""
    var word = ""

    func flush() {
      result += word.count > wholeWordLength ? inserted(into: word) : word
      word = ""
    }

    for character in text {
      if character.isWhitespace {
        flush()
        result.append(character)
      } else {
        word.append(character)
      }
    }

    flush()
    return result
  }

  private static let wholeWordLength = 20

  static func breaks(between before: Character, and after: Character) -> Bool {
    after == "." || ("([{,".contains(before) && !")]}".contains(after))
  }
}
