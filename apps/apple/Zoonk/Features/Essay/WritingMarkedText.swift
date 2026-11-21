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
            "You wrote “\(error.quote)” · \(error.kind)", tableName: "Essay",
            comment: "What the learner wrote for a language error, and the kind of error"),
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
      SectionTitle(Text("Your text", tableName: "Essay", comment: "The learner's answer as sent")) {
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
  static func pieces(grade: WritingResult, text: String) -> [Piece] {
    let length = text.utf16.count
    let stepQuote = WritingNextStep(grade: grade, text: text).quote
    let stepStart = stepQuote.flatMap { quote in
      text.range(of: quote).map { text.utf16.distance(from: text.startIndex, to: $0.lowerBound) }
    }
    let stepLength = stepQuote?.utf16.count ?? 0
    let ignoredFrom = grade.ignoredFrom.map { wordStart(text, min($0, length)) } ?? length
    var cuts: Set<Int> = [0, length, ignoredFrom]

    for error in grade.errors {
      cuts.insert(min(error.start, length))
      cuts.insert(min(length, error.start + error.quote.utf16.count))
    }

    if let stepStart {
      cuts.insert(stepStart)
      cuts.insert(stepStart + stepLength)
    }

    let points = cuts.filter { $0 <= length }.sorted()

    return zip(points, points.dropFirst()).map { start, end in
      Piece(
        start: start, end: end,
        error: grade.errors.firstIndex {
          start >= $0.start && start < $0.start + $0.quote.utf16.count
        },
        ignored: start >= ignoredFrom,
        step: stepStart.map { start >= $0 && start < $0 + stepLength } ?? false)
    }
  }

  /// A line limit falls inside a word as often as not; the word it splits is shown as past it, whole.
  static func wordStart(_ text: String, _ offset: Int) -> Int {
    let before = text.utf16.prefix(offset)
    let splitWord = before.reversed().prefix { unit in
      guard let scalar = Unicode.Scalar(unit) else { return true }
      return !scalar.properties.isWhitespace
    }
    return offset - splitWord.count
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

  private static func slice(_ text: String, _ start: Int, _ end: Int) -> Substring {
    let utf16 = text.utf16
    let from =
      utf16.index(utf16.startIndex, offsetBy: start, limitedBy: utf16.endIndex) ?? utf16.endIndex
    let to =
      utf16.index(utf16.startIndex, offsetBy: end, limitedBy: utf16.endIndex) ?? utf16.endIndex
    return text[
      (String.Index(from, within: text) ?? text.endIndex)..<(String.Index(to, within: text)
        ?? text.endIndex)]
  }
}
