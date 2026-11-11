import Foundation

/// A formula in a buddy answer, found as main's `TutorMarkdown` finds it (remark-math with single
/// dollars off): only `$$…$$` is math, never inside code, and a `$$` fence on its own line opens a
/// block. `TutorAnswerBlockTests` holds it to the cases remark-math writes.
struct TutorFormula: Equatable {
  /// A block on its own lines, not a formula inside a paragraph.
  let display: Bool
  let latex: String

  /// Around a formula's index where it was taken out.
  static let open: Character = "\u{E000}"
  static let close: Character = "\u{E001}"

  /// The answer with a placeholder where each formula was, so its LaTeX never reads as Markdown.
  static func takeOut(_ markdown: String) -> (markdown: String, formulas: [TutorFormula]) {
    let lines = markdown.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    var formulas: [TutorFormula] = []
    var output: [String] = []
    var prose: [String] = []
    var codeFence: Fence?
    var index = 0

    func flushProse() {
      if !prose.isEmpty {
        output.append(takeOutInline(prose.joined(separator: "\n"), into: &formulas))
        prose = []
      }
    }

    while index < lines.count {
      let line = lines[index]
      index += 1

      if let fence = codeFence {
        output.append(line)
        codeFence = fence.isClosed(by: line) ? nil : fence
      } else if let fence = Fence(opening: line) {
        flushProse()
        output.append(line)
        codeFence = fence
      } else if let block = MathBlock(opening: line) {
        flushProse()
        let close = lines[index...].firstIndex { block.isClosed(by: $0) }
        let content = lines[index..<(close ?? lines.count)].map { block.content(of: $0) }
        output.append(block.indent + placeholder(formulas.count))
        formulas.append(TutorFormula(display: true, latex: content.joined(separator: "\n")))
        index = (close ?? lines.count - 1) + 1
      } else {
        prose.append(line)
      }
    }

    flushProse()
    return (output.joined(separator: "\n"), formulas)
  }

  private static func placeholder(_ index: Int) -> String {
    "\(open)\(index)\(close)"
  }

  /// `$$…$$` closes on a run of as many dollars, within its paragraph, the way a code span closes.
  private static func takeOutInline(_ text: String, into formulas: inout [TutorFormula]) -> String {
    let characters = Array(text)
    var output = ""
    var index = 0

    while index < characters.count {
      let character = characters[index]

      if character == "\\" && index + 1 < characters.count {
        output.append(character)
        output.append(characters[index + 1])
        index += 2
        continue
      }

      guard character == "`" || character == "$" else {
        output.append(character)
        index += 1
        continue
      }

      let run = characters[index...].prefix { $0 == character }.count
      let opens = character == "`" || run >= 2
      let close =
        opens ? closingRun(characters, of: character, length: run, from: index + run) : nil

      if let close, character == "$" {
        formulas.append(
          TutorFormula(display: false, latex: unpadded(String(characters[(index + run)..<close]))))
        output += placeholder(formulas.count - 1)
      } else {
        output += String(characters[index..<(close.map { $0 + run } ?? index + run)])
      }

      index = close.map { $0 + run } ?? index + run
    }

    return output
  }

  /// A blank line ends the paragraph, and with it any formula or code span left open.
  private static func closingRun(
    _ characters: [Character], of character: Character, length: Int, from start: Int
  ) -> Int? {
    var index = start

    while index < characters.count {
      if characters[index] == "\n",
        characters[(index + 1)...].prefix(while: { $0 != "\n" }).allSatisfy(\.isWhitespace)
      {
        return nil
      }

      guard characters[index] == character else {
        index += 1
        continue
      }

      let run = characters[index...].prefix { $0 == character }.count

      if run == length {
        return index
      }

      index += run
    }

    return nil
  }

  /// remark-math drops one space or line break from each side when both sides have one.
  private static func unpadded(_ latex: String) -> String {
    let isPadding = { (character: Character?) in character == " " || character == "\n" }

    guard isPadding(latex.first), isPadding(latex.last),
      latex.contains(where: { !isPadding($0) })
    else {
      return latex
    }

    return String(latex.dropFirst().dropLast())
  }
}

private struct Fence {
  let marker: Character
  let length: Int

  init?(opening line: String) {
    guard let match = line.prefixMatch(of: /^ {0,3}(`{3,}|~{3,})/), let marker = match.1.first
    else {
      return nil
    }

    self.marker = marker
    self.length = match.1.count
  }

  func isClosed(by line: String) -> Bool {
    Fence(opening: line).map { $0.marker == marker && $0.length >= length } ?? false
  }
}

/// remark-math's math flow: a fence of two or more dollars and nothing else but words without a
/// dollar, its lines up to a fence at least as long, or to the end when none closes it.
private struct MathBlock {
  /// Inside a list item, the fence lines up with the item's text.
  let indent: String
  let length: Int

  init?(opening line: String) {
    guard let match = line.wholeMatch(of: /([ \t]*)(\${2,})[^$]*/) else {
      return nil
    }

    indent = String(match.1)
    length = match.2.count
  }

  func isClosed(by line: String) -> Bool {
    let fence = line.trimmingCharacters(in: .whitespaces)
    return fence.count >= length && fence.allSatisfy { $0 == "$" }
  }

  func content(of line: String) -> String {
    String(line.dropFirst(line.prefix(indent.count).prefix(while: \.isWhitespace).count))
  }
}
