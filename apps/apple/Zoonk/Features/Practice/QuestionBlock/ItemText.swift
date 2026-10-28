import SwiftUI

/// Item text (a question, its context, an option, an explanation) is Markdown limited to
/// paragraphs, pipe tables for data, and inline code, bold and italics, as item writers are told.
/// Anything else stays text, so a stray marker never changes a question's layout.
struct ItemText: View {
  let text: String

  init(_ text: String) {
    self.text = text
  }

  var body: some View {
    let blocks = ItemTextBlock.parse(text)

    VStack(alignment: .leading, spacing: 12) {
      ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
        switch block {
        case .paragraph(let line):
          Text(ItemTextBlock.inline(line))
            .fixedSize(horizontal: false, vertical: true)
        case .table(let header, let rows):
          ItemTable(header: header, rows: rows)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// A data table from an item's text, scrolling sideways when it's wider than the column.
private struct ItemTable: View {
  let header: [String]
  let rows: [[String]]

  var body: some View {
    ScrollView(.horizontal) {
      Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
        GridRow {
          ForEach(Array(header.enumerated()), id: \.offset) { _, cell in
            Text(ItemTextBlock.inline(cell)).font(.subheadline.weight(.semibold))
          }
        }

        Divider()

        ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
          GridRow {
            ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
              Text(ItemTextBlock.inline(cell)).font(.subheadline)
            }
          }
        }
      }
      .padding(.vertical, 4)
    }
    .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
  }
}

enum ItemTextBlock: Equatable {
  case paragraph(String)
  case table(header: [String], rows: [[String]])

  /// Paragraphs split by blank lines; a run of `|` lines with a `---` separator is a table.
  static func parse(_ text: String) -> [ItemTextBlock] {
    let lines = text.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
    var blocks: [ItemTextBlock] = []
    var paragraph: [String] = []
    var index = 0

    func flush() {
      let joined = paragraph.map { $0.trimmingCharacters(in: .whitespaces) }.joined(separator: " ")

      if !joined.isEmpty {
        blocks.append(.paragraph(joined))
      }

      paragraph = []
    }

    while index < lines.count {
      let line = lines[index]

      if isTableRow(line), index + 1 < lines.count, isTableSeparator(lines[index + 1]) {
        flush()
        let header = cells(line)
        var rows: [[String]] = []
        index += 2

        while index < lines.count, isTableRow(lines[index]) {
          rows.append(cells(lines[index]))
          index += 1
        }

        blocks.append(.table(header: header, rows: rows))
        continue
      }

      if line.trimmingCharacters(in: .whitespaces).isEmpty {
        flush()
      } else {
        paragraph.append(line)
      }

      index += 1
    }

    flush()
    return blocks
  }

  /// Inline Markdown (bold, italics, code); text that isn't valid Markdown stays as written.
  static func inline(_ text: String) -> AttributedString {
    let options = AttributedString.MarkdownParsingOptions(
      interpretedSyntax: .inlineOnlyPreservingWhitespace,
      failurePolicy: .returnPartiallyParsedIfPossible)
    return (try? AttributedString(markdown: text, options: options)) ?? AttributedString(text)
  }

  /// The words of item text without its Markdown, for VoiceOver labels and one-line answers.
  static func plain(_ text: String) -> String {
    String(inline(text).characters)
  }

  private static func isTableRow(_ line: String) -> Bool {
    line.trimmingCharacters(in: .whitespaces).hasPrefix("|")
  }

  private static func isTableSeparator(_ line: String) -> Bool {
    let trimmed = line.trimmingCharacters(in: .whitespaces)
    return trimmed.hasPrefix("|") && trimmed.contains("-")
      && trimmed.allSatisfy { "|-: ".contains($0) }
  }

  private static func cells(_ line: String) -> [String] {
    var trimmed = line.trimmingCharacters(in: .whitespaces)

    if trimmed.hasPrefix("|") { trimmed.removeFirst() }
    if trimmed.hasSuffix("|") { trimmed.removeLast() }

    return trimmed.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
  }
}
