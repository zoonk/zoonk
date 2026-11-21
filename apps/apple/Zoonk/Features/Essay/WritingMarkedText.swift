import SwiftUI

/// The learner's text as sent, each language error marked and numbered, the passage to rewrite
/// underlined, and what graders wouldn't read set apart (main's `WritingMarkedText`).
struct WritingMarkedTextSection: View {
  let grade: WritingResult
  let lines: Int?
  let text: String

  @Environment(\.self) private var environment

  var body: some View {
    Section {
      Text(
        WritingMarks.attributed(
          grade: grade, lines: lines, text: text,
          noteFont: TypeStyle.data.font(in: environment),
          numberFont: TypeStyle.small.font(in: environment))
      )
      .typeStyle(.reading)
      .textSelection(.enabled)

      ForEach(Array(grade.errors.enumerated()), id: \.offset) { index, error in
        ListRow(
          Text(error.correction),
          description: Text(
            "You wrote “\(error.quote)” (\(error.kind))", tableName: "Essay",
            comment:
              "Under a correction: what the learner wrote, then the kind of error, like \"grammar\"."
          ),
          alignment: .firstTextBaseline
        ) {
          Text(verbatim: "\(index + 1)")
            .typeStyle(.data)
            .frame(minWidth: 20, minHeight: 20)
            .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(.border))
        } trailing: {
          EmptyView()
        }
      }
    } header: {
      SectionTitle(Text("Your text", tableName: "Essay")) {
        if !grade.errors.isEmpty {
          Text(WritingLabels.errors(grade.errors.count))
            .typeStyle(.data)
        }
      }
    }
  }
}

enum WritingMarks {
  struct Piece: Equatable {
    var start: Int
    var end: Int
    var error: Int?
    var ignored: Bool
    var step: Bool
  }

  /// Offsets are UTF-16 code units into the saved text, as the grade's `start` and `ignoredFrom`.
  /// A mark only begins or ends between characters: one whose edge falls inside a character, such
  /// as between an "e" and its accent, takes in the whole character, and one that doesn't fit in
  /// the text isn't drawn.
  static func pieces(grade: WritingResult, text: String) -> [Piece] {
    let edges = characterEdges(text)
    let length = text.utf16.count
    let stepQuote = WritingNextStep(grade: grade, text: text).quote
    let step = stepQuote.flatMap { quote in
      text.range(of: quote).map {
        (
          start: text.utf16.distance(from: text.startIndex, to: $0.lowerBound),
          end: text.utf16.distance(from: text.startIndex, to: $0.upperBound)
        )
      }
    }
    let ignoredFrom =
      grade.ignoredFrom.map { snap(wordStart(text, min(max($0, 0), length)), edges, up: false) }
      ?? length
    let errors = grade.errors.map { error -> (start: Int, end: Int)? in
      let end = error.start + error.quote.utf16.count
      guard error.start >= 0, end <= length, end > error.start else { return nil }
      return (snap(error.start, edges, up: false), snap(end, edges, up: true))
    }
    var cuts: Set<Int> = [0, length, ignoredFrom]

    for error in errors.compactMap(\.self) {
      cuts.insert(error.start)
      cuts.insert(error.end)
    }

    if let step {
      cuts.insert(step.start)
      cuts.insert(step.end)
    }

    let points = cuts.sorted()

    return zip(points, points.dropFirst()).map { start, end in
      Piece(
        start: start, end: end,
        error: errors.firstIndex { $0.map { start >= $0.start && start < $0.end } ?? false },
        ignored: start >= ignoredFrom,
        step: step.map { start >= $0.start && start < $0.end } ?? false)
    }
  }

  /// A line limit falls inside a word as often as not; the word it splits is shown as past it,
  /// whole. A limit on the space after a word leaves that word read.
  static func wordStart(_ text: String, _ offset: Int) -> Int {
    let units = Array(text.utf16)
    let isWordUnit = { (unit: UInt16) in
      Unicode.Scalar(unit).map { !$0.properties.isWhitespace } ?? true
    }

    guard offset > 0, offset < units.count, isWordUnit(units[offset]) else { return offset }

    let splitWord = units[..<offset].reversed().prefix(while: isWordUnit)
    return offset - splitWord.count
  }

  /// Where each character of `text` starts, in UTF-16 code units, and where the text ends.
  private static func characterEdges(_ text: String) -> [Int] {
    var edges = [0]
    edges.reserveCapacity(text.utf16.count + 1)

    for character in text {
      edges.append(edges[edges.count - 1] + character.utf16.count)
    }

    return edges
  }

  /// The nearest edge between characters at or before `offset`, or at or after it when `up`.
  private static func snap(_ offset: Int, _ edges: [Int], up: Bool) -> Int {
    if up {
      return edges.first { $0 >= offset } ?? edges[edges.count - 1]
    }

    return edges.last { $0 <= offset } ?? 0
  }

  static func attributed(
    grade: WritingResult, lines: Int?, text: String, noteFont: Font, numberFont: Font
  ) -> AttributedString {
    let pieces = pieces(grade: grade, text: text)
    var result = AttributedString()

    for (index, piece) in pieces.enumerated() {
      if piece.ignored, index == 0 || !pieces[index - 1].ignored {
        var note = AttributedString(
          "\n"
            + (lines.map {
              String(
                localized: "Past line \(String($0)): graders stop reading here", table: "Essay")
            }
              ?? String(localized: "Past the limit: graders stop reading here", table: "Essay"))
            + "\n")
        note.foregroundColor = .warningText
        note.font = noteFont
        result += note
      }

      var part = AttributedString(slice(text, piece.start, piece.end))

      if piece.error != nil {
        part.backgroundColor = Color.destructive.opacity(0.1)
        part.underlineStyle = Text.LineStyle(pattern: .solid, color: .destructive)
      } else if piece.step {
        part.underlineStyle = Text.LineStyle(pattern: .dot, color: .warning)
      }

      if piece.ignored {
        part.foregroundColor = .mutedForeground
        part.strikethroughStyle = .single
      }

      result += part

      if let error = piece.error, index == pieces.count - 1 || pieces[index + 1].error != error {
        var number = AttributedString("\(error + 1)")
        number.foregroundColor = .destructiveText
        number.font = numberFont
        number.baselineOffset = 6
        result += number
      }
    }

    return result
  }

  /// `start` and `end` fall between characters, as every piece's do.
  private static func slice(_ text: String, _ start: Int, _ end: Int) -> Substring {
    let utf16 = text.utf16
    guard
      let from = utf16.index(utf16.startIndex, offsetBy: start, limitedBy: utf16.endIndex),
      let to = utf16.index(utf16.startIndex, offsetBy: end, limitedBy: utf16.endIndex),
      let lower = String.Index(from, within: text),
      let upper = String.Index(to, within: text),
      lower <= upper
    else { return "" }

    return text[lower..<upper]
  }
}
