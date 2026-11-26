import SwiftUI

/// A card on a match board: its column and its place in that column.
struct MatchCardRef: Hashable, Sendable {
  enum Side: Hashable, Sendable {
    case left, right
  }

  let side: Side
  let index: Int

  static func left(_ index: Int) -> Self { Self(side: .left, index: index) }
  static func right(_ index: Int) -> Self { Self(side: .right, index: index) }
}

/// A pair the learner tried, by the places of its cards in the shown columns: main's `MatchAnswer`
/// miss.
struct MatchTry: Hashable, Sendable, Codable {
  let left: Int
  let right: Int

  /// Core keeps the earliest of a board's misses up to this many.
  static let maxMisses = 32
}

/// Main's match hook: the tap rule every match board shares. A card on either side, then one on the
/// other side, makes a try. Another card on the same side takes the selection over, and the
/// selected card again clears it. After a try that doesn't go together, the card picked first stays
/// selected, so its next partner is one tap away.
struct MatchPicking: Equatable, Sendable {
  private(set) var selected: MatchCardRef?
  /// The last try that didn't go together, for its moment on screen.
  private(set) var miss: MatchTry?
  /// Names each miss, so a second one on the same cards cues again.
  private(set) var missCount = 0

  /// The try a tap makes, if any, with `goesTogether`'s verdict on it.
  mutating func tap(_ card: MatchCardRef, goesTogether: (MatchTry) -> Bool) -> (
    attempt: MatchTry, isRight: Bool
  )? {
    miss = nil

    guard let first = selected, first != card else {
      selected = selected == card ? nil : card
      return nil
    }

    guard first.side != card.side else {
      selected = card
      return nil
    }

    let attempt =
      first.side == .left
      ? MatchTry(left: first.index, right: card.index)
      : MatchTry(left: card.index, right: first.index)
    let isRight = goesTogether(attempt)

    if isRight {
      selected = nil
    } else {
      miss = attempt
      missCount += 1
    }

    return (attempt, isRight)
  }

  mutating func clear() {
    selected = nil
    miss = nil
  }

  /// The miss's cue ends; a later one keeps its own.
  mutating func endMiss(_ count: Int) {
    if count == missCount {
      miss = nil
    }
  }

  func isMissed(_ card: MatchCardRef) -> Bool {
    guard let miss else { return false }
    return card.side == .left ? miss.left == card.index : miss.right == card.index
  }
}

/// What a match card shows.
enum MatchEntryState: Equatable {
  case idle
  case selected
  /// In a pair nothing has checked yet, with the pair's number.
  case paired(Int)
  /// A pair checked and kept.
  case right
  /// Part of a try that didn't go together, for a moment; the miss's count, so a second miss on the
  /// card cues again.
  case wrong(Int)
  /// On a checked board, a pair the learner found only after a miss: its tone and no check, since
  /// the pair shown is still the right one.
  case missed
}

/// Main's `MatchEntry`: one side of a pair, on every board that asks to match these with those. Its
/// words start at the card's edge, and a mark (a pair's number, a check) sits on its corner, so
/// pairing moves no text. `partner` is what VoiceOver says it's matched with.
struct MatchEntry<Label: View>: View {
  let state: MatchEntryState
  /// Its place on the board, the left column first, for the number key that picks it.
  var keyIndex: Int?
  var partner: String?
  /// Without one, it shows an answer after the fact: the same look, with nothing to press.
  let action: (() -> Void)?
  @ViewBuilder let label: Label

  var body: some View {
    Button {
      action?()
    } label: {
      label
        .frame(maxWidth: .infinity, alignment: .leading)
        .multilineTextAlignment(.leading)
    }
    .buttonStyle(MatchEntryStyle(state: state))
    .disabled(action == nil || isSettled)
    .modifier(MatchShake(missNumber: missNumber))
    .modifier(MatchKey(index: action == nil || isSettled ? nil : keyIndex))
    .accessibilityValue(value)
    .accessibilityAddTraits(state == .selected ? .isSelected : [])
  }

  private var isSettled: Bool {
    state == .right || state == .missed
  }

  private var missNumber: Int? {
    if case .wrong(let number) = state { number } else { nil }
  }

  private var value: Text {
    if state == .missed {
      return Text(
        "Missed on the first try", tableName: "Activities",
        comment: "Above the pairs a learner missed at first")
    }

    guard let partner else { return Text(verbatim: "") }

    return Text(
      "Matched with \(partner)", tableName: "Practice",
      comment: "VoiceOver value of a right-column entry already matched with a left entry.")
  }
}

/// Main's `animate-shake`, once per miss; with reduced motion the miss shows by its tone alone.
private struct MatchShake: ViewModifier {
  let missNumber: Int?

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var shakes = 0

  func body(content: Content) -> some View {
    content
      .keyframeAnimator(initialValue: 0.0, trigger: shakes) { content, offset in
        content.offset(x: offset)
      } keyframes: { _ in
        KeyframeTrack {
          LinearKeyframe(-4.0, duration: 0.08)
          LinearKeyframe(4.0, duration: 0.08)
          LinearKeyframe(-3.0, duration: 0.08)
          LinearKeyframe(3.0, duration: 0.08)
          LinearKeyframe(0.0, duration: 0.08)
        }
      }
      .onChange(of: missNumber) { _, number in
        if number != nil, !reduceMotion {
          shakes += 1
        }
      }
  }
}

private struct MatchKey: ViewModifier {
  let index: Int?

  func body(content: Content) -> some View {
    if let index, index < 9, let key = "\(index + 1)".first {
      content.keyboardShortcut(KeyEquivalent(key), modifiers: [])
    } else {
      content
    }
  }
}

/// Disabled cards keep their colors, so a checked board stays readable.
private struct MatchEntryStyle: ButtonStyle {
  let state: MatchEntryState

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .typeStyle(.body.weight(.medium))
      .foregroundStyle(Color(.foreground))
      .padding(12)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      .frame(minHeight: 48)
      .answerSurface(tone, isPressed: configuration.isPressed)
      // As on the page, on a lesson's tinted canvas too.
      .background(
        Color(.background), in: .rect(cornerRadius: Radius.option, style: .continuous)
      )
      .overlay(alignment: .topTrailing) {
        MatchMark(state: state)
      }
      .animation(.easeOut(duration: 0.15), value: tone)
  }

  private var tone: AnswerTone {
    switch state {
    case .idle, .paired: .idle
    case .selected: .picked
    case .right: .right
    case .wrong, .missed: .wrong
    }
  }
}

/// The mark on a card's corner, over its border: inside, it stays within the card's padding, so it
/// never covers a word.
private struct MatchMark: View {
  let state: MatchEntryState

  @ScaledMetric(relativeTo: .caption2) private var size = 18.0

  var body: some View {
    if let mark {
      ZStack {
        Circle().fill(mark.fill)
        mark.glyph
          .foregroundStyle(Color(.background))
      }
      .frame(width: size, height: size)
      .offset(x: size / 3, y: -size / 3)
      .accessibilityHidden(true)
    }
  }

  private var mark: (fill: Color, glyph: AnyView)? {
    switch state {
    case .paired(let number):
      (
        Color(.foreground),
        AnyView(Text(number, format: .number).typeStyle(.small.weight(.semibold).monospaced()))
      )
    case .right:
      (.success, AnyView(Image(systemName: "checkmark").typeStyle(.small.bold())))
    case .idle, .selected, .wrong, .missed:
      nil
    }
  }
}

/// Main's `MatchBoard`: two columns side by side, the right one under the left once text is at an
/// accessibility size. Solved, it lays out as rows, each pair side by side.
struct MatchBoard<Card: View>: View {
  let leftCount: Int
  let rightCount: Int
  var solvedRows: [MatchTry]?
  @ViewBuilder let card: (MatchCardRef) -> Card

  @Environment(\.stacksContent) private var isStacked

  var body: some View {
    if let solvedRows {
      VStack(spacing: isStacked ? 16 : 8) {
        ForEach(solvedRows, id: \.self) { row in
          AccessibilityStack(spacing: 8) {
            card(.left(row.left))
            card(.right(row.right))
          }
          .fixedSize(horizontal: false, vertical: true)
        }
      }
    } else {
      AccessibilityStack(alignment: .top, spacing: 8, stackedSpacing: 16) {
        column(.left, count: leftCount)
        column(.right, count: rightCount)
      }
    }
  }

  private func column(_ side: MatchCardRef.Side, count: Int) -> some View {
    VStack(spacing: 8) {
      ForEach(0..<count, id: \.self) { index in
        card(MatchCardRef(side: side, index: index))
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .frame(maxWidth: .infinity)
  }
}

extension View {
  /// What every match board does around its taps: a light tap in the hand as a pair locks, and a
  /// miss's cue ending after its moment.
  func matchBoardFeedback(_ picking: Binding<MatchPicking>, locked: Int) -> some View {
    sensoryFeedback(.impact(weight: .light), trigger: locked) { old, new in new > old }
      .task(id: picking.wrappedValue.missCount) {
        let count = picking.wrappedValue.missCount
        guard picking.wrappedValue.miss != nil else { return }
        try? await Task.sleep(for: .milliseconds(700))
        guard !Task.isCancelled else { return }
        picking.wrappedValue.endMiss(count)
      }
  }
}

/// What VoiceOver says after each try on a board that checks its pairs.
enum MatchAnnouncement {
  static func matched(_ left: String, _ right: String, matched: Int, total: Int) -> String {
    String(
      localized:
        "Matched \(left) with \(right). \(matched) of \(total) pairs matched.",
      table: "Activities", locale: .appLanguage, comment: "VoiceOver, after a pair is matched")
  }

  static func missed(_ left: String, _ right: String) -> String {
    String(
      localized: "\(left) and \(right) don't go together.", table: "Activities",
      comment: "VoiceOver, after two cards that don't match are picked")
  }
}
