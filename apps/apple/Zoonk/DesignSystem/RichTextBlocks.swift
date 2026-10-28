import SwiftUI

/// Anything beyond paragraphs, lists and GFM tables stays text, so a stray marker never changes a
/// screen's layout. Each caller reads the inline markup its own way: lessons typeset math, items don't.
struct RichTextBlocks: View {
  let text: String
  let inline: (String) -> AttributedString

  init(_ text: String, inline: @escaping (String) -> AttributedString) {
    self.text = text
    self.inline = inline
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ForEach(Array(RichTextBlock.parse(text).enumerated()), id: \.offset) { _, block in
        switch block {
        case .paragraph(let lines):
          Text(inline(lines.joined(separator: "\n")))
            .fixedSize(horizontal: false, vertical: true)
        case .list(let items, let ordered):
          list(items, ordered: ordered)
        case .table(let header, let rows):
          table(header: header, rows: rows)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func list(_ items: [String], ordered: Bool) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      ForEach(Array(items.enumerated()), id: \.offset) { index, item in
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          Text(ordered ? "\(index + 1)." : "•")
            .monospacedDigit()
            .foregroundStyle(.secondary)
            .accessibilityHidden(true)

          Text(inline(item))
            .fixedSize(horizontal: false, vertical: true)
        }
      }
    }
  }

  private func table(header: [String], rows: [[String]]) -> some View {
    ScrollView(.horizontal) {
      Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
        GridRow {
          ForEach(Array(header.enumerated()), id: \.offset) { _, cell in
            Text(inline(cell)).font(.subheadline.weight(.semibold))
          }
        }

        Divider()

        ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
          GridRow {
            ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
              Text(inline(cell)).font(.subheadline)
            }
          }
        }
      }
      .padding(.vertical, 4)
    }
    .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
  }
}

enum RichTextBlock: Equatable {
  case paragraph(lines: [String])
  case list(items: [String], ordered: Bool)
  case table(header: [String], rows: [[String]])

  /// Mirrors main's `parseRichBlocks`.
  static func parse(_ text: String) -> [RichTextBlock] {
    let lines = text.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
    var blocks: [RichTextBlock] = []
    var previous: Line?
    var index = 0

    while index < lines.count {
      if let table = Table(lines: lines, at: index) {
        blocks.append(.table(header: table.header, rows: table.rows))
        previous = nil
        index = table.end
        continue
      }

      let line = Line(lines[index])
      blocks = appending(line, after: previous, to: blocks)
      previous = line
      index += 1
    }

    return blocks
  }

  private static func appending(_ line: Line, after previous: Line?, to blocks: [RichTextBlock])
    -> [RichTextBlock]
  {
    var blocks = blocks

    switch (line, blocks.last, previous) {
    case (.blank, _, _):
      break
    case (.item(let text, let ordered), .list(let items, let listOrdered)?, .item?)
    where ordered == listOrdered:
      blocks[blocks.count - 1] = .list(items: items + [text], ordered: ordered)
    case (.item(let text, let ordered), _, _):
      blocks.append(.list(items: [text], ordered: ordered))
    case (.text(let text), .paragraph(let lines)?, .text?):
      blocks[blocks.count - 1] = .paragraph(lines: lines + [text])
    case (.text(let text), _, _):
      blocks.append(.paragraph(lines: [text]))
    }

    return blocks
  }

  private enum Line {
    case blank
    case item(String, ordered: Bool)
    case text(String)

    init(_ line: String) {
      if let match = line.wholeMatch(of: /\s*[-*•]\s+(.+)/) {
        self = .item(String(match.output.1), ordered: false)
      } else if let match = line.wholeMatch(of: /\s*\d{1,3}[.)]\s+(.+)/) {
        self = .item(String(match.output.1), ordered: true)
      } else {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        self = trimmed.isEmpty ? .blank : .text(trimmed)
      }
    }
  }

  private struct Table {
    let header: [String]
    let rows: [[String]]
    let end: Int

    init?(lines: [String], at index: Int) {
      guard index + 1 < lines.count, lines[index].contains("|"), lines[index + 1].contains("|")
      else {
        return nil
      }

      let header = Self.cells(lines[index])
      let delimiter = Self.cells(lines[index + 1])

      guard header.count == delimiter.count,
        delimiter.allSatisfy({ $0.wholeMatch(of: /:?-+:?/) != nil })
      else {
        return nil
      }

      var end = index + 2

      while end < lines.count, lines[end].contains("|") {
        end += 1
      }

      self.header = header
      self.rows = lines[(index + 2)..<end].map { line in
        let cells = Self.cells(line)
        return header.indices.map { $0 < cells.count ? cells[$0] : "" }
      }
      self.end = end
    }

    private static func cells(_ line: String) -> [String] {
      var row = line.trimmingCharacters(in: .whitespaces)

      if row.hasPrefix("|") { row.removeFirst() }
      if row.hasSuffix("|"), !row.hasSuffix("\\|") { row.removeLast() }

      return row.replacingOccurrences(of: "\\|", with: "\u{FFFC}")
        .components(separatedBy: "|")
        .map {
          $0.replacingOccurrences(of: "\u{FFFC}", with: "|").trimmingCharacters(in: .whitespaces)
        }
    }
  }
}
