import SwiftUI

/// A line of rich text as drawn, and what VoiceOver says for it when that differs, such as a
/// formula in words ("1 over 4").
struct RichInline {
  var text: AttributedString
  var spoken: String? = nil

  /// For a label or an announcement.
  var said: String {
    spoken ?? String(text.characters)
  }

  static func + (lhs: RichInline, rhs: RichInline) -> RichInline {
    RichInline(
      text: lhs.text + rhs.text,
      spoken: lhs.spoken == nil && rhs.spoken == nil ? nil : lhs.said + rhs.said)
  }

  static func += (lhs: inout RichInline, rhs: RichInline) {
    lhs = lhs + rhs
  }

  /// For quoting it inside another `Text`, which drops a quoted Text's own label: draw it, then
  /// give the whole line a label that quotes it spoken.
  func quoted(spoken: Bool) -> Text {
    spoken ? Text(verbatim: said) : Text(text)
  }
}

extension Text {
  init(_ inline: RichInline) {
    let text = Text(inline.text)
    self = inline.spoken.map { text.accessibilityLabel($0) } ?? text
  }
}

/// Anything beyond paragraphs, lists and GFM tables stays text, so a stray marker never changes a
/// screen's layout. Each caller reads the inline markup its own way: lessons typeset math, items don't.
struct RichTextBlocks: View {
  let text: String
  /// A quote of the text, in its markup, to highlight where it first shows.
  let mark: String?
  let marks: RichTextMarks?
  let inline: (String) -> RichInline

  init(
    _ text: String, mark: String? = nil, marks: RichTextMarks? = nil,
    inline: @escaping (String) -> RichInline
  ) {
    self.text = text
    self.mark = mark
    self.marks = marks
    self.inline = inline
  }

  var body: some View {
    let blocks = RichTextBlock.parse(text)
    let shown = { (markup: String) in String(inline(markup).text.characters) }
    let marked = mark.flatMap { RichTextBlock.mark($0, in: blocks, shown: shown) }
    let underlined = marks?.underline.flatMap { RichTextBlock.mark($0, in: blocks, shown: shown) }

    VStack(alignment: .leading, spacing: 12) {
      ForEach(Array(blocks.enumerated()), id: \.offset) { index, block in
        let mark = marked?.block == index ? marked : nil
        let underline = underlined?.block == index ? underlined : nil

        switch block {
        case .paragraph(let lines):
          line(inline(lines.joined(separator: "\n")), mark: mark, underline: underline)
        case .list(let items, let ordered):
          list(items, ordered: ordered, mark: mark, underline: underline)
        case .table(let header, let alignments, let rows):
          RichTable(header: header, alignments: alignments, rows: rows, inline: inline)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func list(
    _ items: [String], ordered: Bool, mark: RichTextBlock.Mark?, underline: RichTextBlock.Mark?
  ) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      ForEach(Array(items.enumerated()), id: \.offset) { index, item in
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          Text(ordered ? "\(index + 1)." : "•")
            .monospacedDigit()
            .foregroundStyle(.secondary)
            .accessibilityHidden(true)

          line(
            inline(item), mark: mark?.item == index ? mark : nil,
            underline: underline?.item == index ? underline : nil)
        }
      }
    }
  }

  private func line(
    _ inline: RichInline, mark: RichTextBlock.Mark?, underline: RichTextBlock.Mark?
  ) -> some View {
    let drawn = highlighting(inline, mark)

    return Text(drawn)
      .handMarks(
        InlineMarks(
          drawn.text, underline: underline?.text, highlightsTerms: marks?.highlightsTerms == true)
      )
      .fixedSize(horizontal: false, vertical: true)
  }

  private func highlighting(_ inline: RichInline, _ mark: RichTextBlock.Mark?) -> RichInline {
    guard let mark, let range = inline.text.range(of: mark.text) else {
      return inline
    }

    var marked = inline
    marked.text[range].backgroundColor = .warning.opacity(0.15)
    return marked
  }
}

/// Main's `RichTable`: the columns share the width the way an HTML table's do, their cells wrapping,
/// and the table scrolls sideways only when a column would get narrower than a short word.
private struct RichTable: View {
  let header: [String]
  let alignments: [RichTextBlock.ColumnAlignment]
  let rows: [[String]]
  let inline: (String) -> RichInline

  @ScaledMetric(relativeTo: .subheadline) private var minimumColumnWidth = 88
  @State private var visibleWidth: CGFloat?

  private let columnSpacing: CGFloat = 16

  var body: some View {
    Group {
      if let visibleWidth, visibleWidth < narrowestWidth {
        ScrollView(.horizontal) { cells.frame(width: narrowestWidth, alignment: .leading) }
          .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
      } else {
        cells
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .onGeometryChange(for: CGFloat.self) {
      $0.size.width
    } action: {
      visibleWidth = $0
    }
  }

  private var cells: some View {
    Grid(alignment: .leading, horizontalSpacing: columnSpacing, verticalSpacing: 8) {
      GridRow {
        ForEach(Array(header.enumerated()), id: \.offset) { index, cell in
          Text(inline(cell))
            .font(.subheadline.weight(.semibold))
            .fixedSize(horizontal: false, vertical: true)
            .gridColumnAlignment(alignments[index].horizontal)
        }
      }

      Divider()

      ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
        GridRow {
          ForEach(Array(row.enumerated()), id: \.offset) { index, cell in
            Text(inline(cell))
              .font(alignments[index] == .leading ? .subheadline : .subheadline.monospacedDigit())
              .fixedSize(horizontal: false, vertical: true)
          }
        }
      }
    }
    .padding(.vertical, 4)
  }

  private var narrowestWidth: CGFloat {
    let columns = CGFloat(header.count)
    return columns * minimumColumnWidth + (columns - 1) * columnSpacing
  }
}

enum RichTextBlock: Equatable {
  enum ColumnAlignment: Equatable {
    case leading
    case center
    case trailing
  }

  case paragraph(lines: [String])
  case list(items: [String], ordered: Bool)
  case table(header: [String], alignments: [ColumnAlignment], rows: [[String]])

  /// Mirrors main's `parseRichBlocks`.
  static func parse(_ text: String) -> [RichTextBlock] {
    let lines = Self.lines(text)
    var blocks: [RichTextBlock] = []
    var previous: Line?
    var index = 0

    while index < lines.count {
      if let table = Table(lines: lines, at: index) {
        blocks.append(
          .table(header: table.header, alignments: table.alignments, rows: table.rows))
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

  static var orderedItem: Regex<(Substring, Substring)> { /\s*\d{1,3}[.)]\s+(.+)/ }

  /// A list numbers its items from 1, so text split inside a numbered list restarts its numbers.
  static func cutsNumberedList(_ text: String, at cut: String.Index) -> Bool {
    guard cut > text.startIndex, cut < text.endIndex else {
      return false
    }

    let start = text[..<cut].lastIndex(of: "\n").map(text.index(after:)) ?? text.startIndex
    let end = text[cut...].firstIndex(of: "\n") ?? text.endIndex
    let isItem = { (line: Substring) in line.wholeMatch(of: orderedItem) != nil }

    guard start == cut else {
      return isItem(text[start..<end])
    }

    let previousStart =
      text[..<text.index(before: cut)].lastIndex(of: "\n").map(text.index(after:))
      ?? text.startIndex
    return isItem(text[previousStart..<text.index(before: cut)]) && isItem(text[cut..<end])
  }

  static func lines(_ text: String) -> [String] {
    text.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
  }

  /// The lines `parse` draws as tables.
  static func tableLines(_ lines: [String]) -> IndexSet {
    var found = IndexSet()
    var index = 0

    while index < lines.count {
      guard let table = Table(lines: lines, at: index) else {
        index += 1
        continue
      }

      found.insert(integersIn: index..<table.end)
      index = table.end
    }

    return found
  }

  struct Mark: Equatable {
    let block: Int
    /// The list item it's in; 0 in a paragraph.
    let item: Int
    let text: String
  }

  /// Main's `markRichBlocks`: the quote is read as one line of the text, list marker and all, and only
  /// the first paragraph or list item that shows it is marked. `shown` turns markup into what it
  /// displays.
  static func mark(_ quote: String, in blocks: [RichTextBlock], shown: (String) -> String) -> Mark?
  {
    let text: String

    switch Line(quote.trimmingCharacters(in: .whitespacesAndNewlines)) {
    case .blank: return nil
    case .item(let item, _): text = shown(item)
    case .text(let line): text = shown(line)
    }

    guard !text.isEmpty else {
      return nil
    }

    for (index, block) in blocks.enumerated() {
      switch block {
      case .paragraph(let lines) where shown(lines.joined(separator: "\n")).contains(text):
        return Mark(block: index, item: 0, text: text)
      case .list(let items, _):
        if let item = items.firstIndex(where: { shown($0).contains(text) }) {
          return Mark(block: index, item: item, text: text)
        }
      case .paragraph, .table:
        break
      }
    }

    return nil
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
      } else if let match = line.wholeMatch(of: RichTextBlock.orderedItem) {
        self = .item(String(match.output.1), ordered: true)
      } else {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        self = trimmed.isEmpty ? .blank : .text(trimmed)
      }
    }
  }

  private struct Table {
    let header: [String]
    let alignments: [ColumnAlignment]
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
      self.alignments = delimiter.map(Self.alignment)
      self.rows = lines[(index + 2)..<end].map { line in
        let cells = Self.cells(line)
        return header.indices.map { $0 < cells.count ? cells[$0] : "" }
      }
      self.end = end
    }

    private static func alignment(_ delimiter: String) -> ColumnAlignment {
      switch (delimiter.hasPrefix(":"), delimiter.hasSuffix(":")) {
      case (true, true): .center
      case (false, true): .trailing
      default: .leading
      }
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

extension RichTextBlock.ColumnAlignment {
  fileprivate var horizontal: HorizontalAlignment {
    switch self {
    case .leading: .leading
    case .center: .center
    case .trailing: .trailing
    }
  }
}
