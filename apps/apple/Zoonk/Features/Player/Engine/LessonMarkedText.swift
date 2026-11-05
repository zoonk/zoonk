import Foundation

struct LessonTextParts: Equatable {
  struct Part: Equatable {
    let text: String
    let underline: String?
  }

  let before: Part?
  let example: Part?
  let after: Part?

  init(_ text: String, marks: StepMarks) {
    let text = RichTextBlock.lines(text).joined(separator: "\n")
    let quote = marks.example.map { RichTextBlock.lines($0).joined(separator: "\n") }
    let range = quote.flatMap { $0.isEmpty ? nil : text.range(of: $0) }.flatMap {
      RichTextBlock.cutsNumberedList(text, at: $0.lowerBound)
        || RichTextBlock.cutsNumberedList(text, at: $0.upperBound) ? nil : $0
    }
    let pieces: [Substring] =
      range.map { [text[..<$0.lowerBound], text[$0], text[$0.upperBound...]] } ?? [
        text[...], "", "",
      ]
    var underline = marks.underline.flatMap { $0.isEmpty ? nil : $0 }

    let parts = pieces.map { piece -> Part? in
      let trimmed = piece.trimmingCharacters(in: .whitespacesAndNewlines)

      guard !trimmed.isEmpty else {
        return nil
      }

      // The underline quotes the text without its bold marks, and may run through a bold term.
      let owned = underline.flatMap {
        trimmed.replacingOccurrences(of: "**", with: "").contains($0) ? $0 : nil
      }

      if owned != nil {
        underline = nil
      }

      return Part(text: trimmed, underline: owned)
    }

    before = parts[0]
    example = parts[1]
    after = parts[2]
  }
}

extension PlayableLesson {
  /// The API's wait: marks come within a late picture's wait from when the lesson was written.
  func isWaitingForMarks(openedAt: Date, now: Date = .now) -> Bool {
    let start = steps.map { $0.waitStart(openedAt: openedAt) }.min() ?? openedAt
    return marksPending && now.timeIntervalSince(start) < LessonStep.lateWait
  }

  /// The map the opening scene and the strip draw from, once tagging has reached the lesson.
  var taggedSummary: LessonSummary? {
    steps.contains { $0.marks != nil } || summary?.isTagged == true ? summary : nil
  }
}

extension LessonSummary {
  var isTagged: Bool {
    ideas.contains { $0.icon != nil || $0.about != nil }
  }
}

/// Which of the lesson's ideas the end map puts above its title and which below, row by row, in
/// reading order. Two to five ideas fit: every connector then runs clear of the other ideas.
struct LessonMindMapRows: Equatable {
  let above: [[Int]]
  let below: [[Int]]

  static func fits(_ count: Int) -> Bool {
    (2...5).contains(count)
  }

  init(count: Int) {
    let first = count > 2 ? 2 : 1
    above = [Array(0..<min(first, count))]
    below = stride(from: first, to: count, by: 2).map { Array($0..<min($0 + 2, count)) }
  }
}
