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

  /// Tagged, or being tagged: its map's ideas get icons, which can come after the map shows.
  var expectsIdeaIcons: Bool {
    marksPending || taggedSummary != nil
  }
}

extension LessonSummary {
  var isTagged: Bool {
    ideas.contains { $0.icon != nil || $0.about != nil }
  }
}

/// Where a lesson-map idea sits around the map's center, as main's `getIdeaSlots` places it: with
/// three or more ideas the first two sit above the center, the rest below in pairs, and a last idea
/// without a pair is centered. The strip's mini map, the opening map and the end map all place ideas
/// this way, so an idea keeps its place from the first screen to the last, and the slots run in
/// reading order, which is the order VoiceOver reads them by their position.
struct LessonIdeaSlot: Equatable {
  /// -1 leading, 0 centered, 1 trailing.
  let column: Int
  /// The center's row is 0.
  let row: Int

  static func slots(count: Int) -> [LessonIdeaSlot] {
    let above = count > 2 ? 2 : 0
    let below = count - above

    return (0..<count).map { index in
      guard index >= above else {
        return LessonIdeaSlot(column: index == 0 ? -1 : 1, row: -1)
      }

      let place = index - above
      let isLastAlone = place == below - 1 && !below.isMultiple(of: 2)

      return LessonIdeaSlot(
        column: isLastAlone ? 0 : place.isMultiple(of: 2) ? -1 : 1, row: 1 + place / 2)
    }
  }

  /// The rows the slots span, the center's included.
  static func rows(of slots: [LessonIdeaSlot]) -> ClosedRange<Int> {
    let rows = slots.map(\.row)
    return min(0, rows.min() ?? 0)...max(0, rows.max() ?? 0)
  }

  /// Where each slot's idea sits around `center`, these gaps apart.
  static func points(of slots: [LessonIdeaSlot], around center: CGPoint, gaps: CGSize)
    -> [CGPoint]
  {
    slots.map { slot in
      CGPoint(
        x: center.x + CGFloat(slot.column) * gaps.width,
        y: center.y + CGFloat(slot.row) * gaps.height)
    }
  }
}
