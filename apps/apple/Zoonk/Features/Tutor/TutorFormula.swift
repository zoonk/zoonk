import Foundation

/// A port of how the web's `TutorMarkdown` finds math (remark-math, single dollars off): only
/// `$$…$$`, never inside code. `TutorAnswerBlockTests` holds it to `tutor-math-native-fixtures.json`.
struct TutorFormula: Equatable {
  let display: Bool
  let latex: String
  /// What the writer wrote, which shows wherever Markdown reads the formula as code.
  let source: String

  static let placeholderStart: Character = "\u{E000}"
  static let placeholderEnd: Character = "\u{E001}"

  /// The answer as Apple's Markdown parser reads it, each formula a placeholder outside code.
  static func parse(_ markdown: String) -> (text: AttributedString, formulas: [TutorFormula])? {
    let (withoutFormulas, formulas) = takeOut(markdown)

    guard
      let parsed = try? AttributedString(
        markdown: withoutFormulas,
        options: .init(
          allowsExtendedAttributes: false, interpretedSyntax: .full,
          failurePolicy: .returnPartiallyParsedIfPossible))
    else {
      return nil
    }

    var text = AttributedString()

    for run in parsed.runs {
      let isCode =
        run.inlinePresentationIntent?.contains(.code) == true
        || run.presentationIntent?.components.contains {
          if case .codeBlock = $0.kind { true } else { false }
        } == true

      text +=
        isCode
        ? AttributedString(
          String(parsed[run.range].characters).replacing(/\x{E000}(\d+)\x{E001}/) {
            Int($0.1).flatMap { formulas.indices.contains($0) ? formulas[$0].source : nil }
              ?? String($0.0)
          }, attributes: run.attributes)
        : AttributedString(parsed[run.range])
    }

    return (text, formulas)
  }

  /// Formulas come out before Apple's Markdown parser runs, which would read their `_` and `*`
  /// as emphasis.
  private static func takeOut(_ markdown: String) -> (markdown: String, formulas: [TutorFormula]) {
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
      let quote = Quote(line)
      index += 1

      if let fence = codeFence {
        output.append(line)
        codeFence = fence.isClosed(by: quote.body) ? nil : fence
      } else if let fence = Fence(opening: quote.body) {
        flushProse()
        output.append(line)
        codeFence = fence
      } else if let block = MathBlock(opening: quote.body) {
        flushProse()
        let end =
          lines[index...].firstIndex {
            Quote($0).depth < quote.depth || block.isClosed(by: Quote($0).body)
          } ?? lines.count
        let next = end < lines.count && Quote(lines[end]).depth >= quote.depth ? end + 1 : end
        let content = lines[index..<end].map { block.content(of: Quote($0).body) }
        let source = [String(quote.body.dropFirst(block.indent.count))] + lines[index..<next]
        output.append(quote.prefix + block.indent + placeholder(formulas.count))
        formulas.append(
          TutorFormula(
            display: true, latex: content.joined(separator: "\n"),
            source: source.joined(separator: "\n")))
        index = next
      } else {
        prose.append(line)
      }
    }

    flushProse()
    return (output.joined(separator: "\n"), formulas)
  }

  private static func placeholder(_ index: Int) -> String {
    "\(placeholderStart)\(index)\(placeholderEnd)"
  }

  /// remark-math closes `$$` like a code span: on a run of exactly as many dollars, in the same
  /// paragraph.
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
      let close = opens ? closingRun(characters, from: index, length: run) : nil
      let end = close.map { $0 + run } ?? index + run

      if let close, character == "$" {
        let latex = String(characters[(index + run)..<close])
          .split(separator: "\n", omittingEmptySubsequences: false)
          .enumerated().map { $0.offset == 0 ? String($0.element) : Quote(String($0.element)).body }
          .joined(separator: "\n")
        formulas.append(
          TutorFormula(
            display: false, latex: unpadded(latex), source: String(characters[index..<end])))
        output += placeholder(formulas.count - 1)
      } else {
        output += String(characters[index..<end])
      }

      index = end
    }

    return output
  }

  private static func closingRun(_ characters: [Character], from open: Int, length: Int) -> Int? {
    let lineStart = characters[..<open].lastIndex(of: "\n").map { $0 + 1 } ?? 0
    let depth = Quote(String(characters[lineStart...].prefix { $0 != "\n" })).depth
    var index = open + length

    while index < characters.count {
      if characters[index] == "\n",
        Quote(String(characters[(index + 1)...].prefix { $0 != "\n" })).endsParagraph(in: depth)
      {
        return nil
      }

      guard characters[index] == characters[open] else {
        index += 1
        continue
      }

      let run = characters[index...].prefix { $0 == characters[open] }.count

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

/// A line split into its block quote markers and what they hold.
private struct Quote {
  let prefix: String
  let body: String

  var depth: Int { prefix.count(where: { $0 == ">" }) }

  init(_ line: String) {
    prefix = String(line.prefixMatch(of: /(?: {0,3}> ?)*/)?.0 ?? "")
    body = String(line.dropFirst(prefix.count))
  }

  /// Blank lines and lines that open a heading, a thematic break, a list item or a deeper quote
  /// end a paragraph; a shallower line is a lazy continuation.
  func endsParagraph(in depth: Int) -> Bool {
    self.depth > depth
      || body.prefixMatch(
        of:
          /[ \t]*$| {0,3}(?:#{1,6}(?:[ \t]|$)|(?:-[ \t]*){3,}$|(?:\*[ \t]*){3,}$|(?:_[ \t]*){3,}$)|[ \t]*(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)/
      ) != nil
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

/// remark-math's math flow: its block runs to a fence at least as long, the end of its quote, or
/// the end.
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
    let fence = line.trimmingCharacters(in: CharacterSet(charactersIn: " \t"))
    return fence.count >= length && fence.allSatisfy { $0 == "$" }
  }

  func content(of line: String) -> String {
    String(line.dropFirst(line.prefix(indent.count).prefix { $0 == " " || $0 == "\t" }.count))
  }
}
