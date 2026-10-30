import SwiftUI

extension ActivityRenderer {
  static let matchPairs = ActivityRenderer(
    template: "matchPairs", badge: .always(.matchPairs),
    grade: ActivityExpectedAnswer.grader(MatchPairsFields.self) { $0.expected }
  ) { context in
    if let fields = try? context.fields(as: MatchPairsFields.self) {
      MatchPairsCanvas(fields: fields, context: context)
    }
  }
}

private struct MatchPairsCanvas: View {
  private struct Miss: Equatable {
    let left: String
    let right: String
    let explanation: String?
  }

  let fields: MatchPairsFields
  let context: ActivityCanvasContext

  @State private var progress: MatchPairs.Progress
  @State private var selection: [MatchPairs.Side: String] = [:]
  @State private var miss: Miss?
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  init(fields: MatchPairsFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context
    _progress = State(initialValue: MatchPairs.progress(from: context.answer))
  }

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var pairIds: [String] { fields.pairs.map(\.id) }
  private var isComplete: Bool { progress.matched.count == pairIds.count }

  var body: some View {
    let columns = MatchPairs.columns(fields)
    let layout =
      dynamicTypeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: 16))
      : AnyLayout(HStackLayout(alignment: .top, spacing: 10))

    VStack(alignment: .leading, spacing: 16) {
      ActivityCaption(caption)

      layout {
        column(.left, columns.left, others: columns.right)
        column(.right, columns.right, others: columns.left)
      }

      if let miss {
        Label {
          Text(
            "\(Text("Not quite:", tableName: "Activities", comment: "Before why two picked cards don't match").fontWeight(.semibold)) \(missText(miss))",
            tableName: "Activities",
            comment: "Why two picked cards don't match, after a bold 'Not quite:'")
        } icon: {
          Image(systemName: "xmark.circle")
            .foregroundStyle(.destructive)
        }
        .font(.subheadline)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.destructive.opacity(0.1), in: .rect(cornerRadius: 12))
      }

      if isChecked {
        results(columns)
      }
    }
  }

  private var caption: Text {
    let matched = Text(
      "\(progress.matched.count) of \(pairIds.count) pairs matched", tableName: "Activities",
      comment: "How many pairs the learner matched")

    guard !fields.distractors.isEmpty else {
      return matched
    }

    let traps = Text(
      "\(fields.distractors.count) cards have no match", tableName: "Activities",
      comment: "How many cards in a matching activity are traps with no match")

    return Text(
      "\(matched) · \(traps)", tableName: "Activities",
      comment: "Pairs matched, then how many cards have no match")
  }

  private func missText(_ miss: Miss) -> Text {
    miss.explanation.map { Text(LessonRichText.attributed($0)) }
      ?? Text(
        "Those two don't go together.", tableName: "Activities",
        comment: "Two picked cards don't match and there's no note on why")
  }

  private func column(_ side: MatchPairs.Side, _ cards: [MatchCard], others: [MatchCard])
    -> some View
  {
    VStack(spacing: 8) {
      ForEach(cards) { card in
        cardButton(card, side: side, others: others)
      }
    }
    .frame(maxWidth: .infinity, alignment: .top)
  }

  private func cardButton(_ card: MatchCard, side: MatchPairs.Side, others: [MatchCard])
    -> some View
  {
    let state = state(of: card, side: side)
    let isDone = state == .matched || state == .noMatch
    let other: MatchPairs.Side = side == .left ? .right : .left

    return Button {
      pick(card, side: side, others: others)
    } label: {
      LessonRichText(card.text)
    }
    .buttonStyle(MatchCardStyle(state: state))
    .disabled(isChecked || isDone)
    .draggable("\(side.rawValue):\(card.id)")
    .dropDestination(for: String.self) { payloads, _ in
      guard !isChecked, !isDone, let payload = payloads.first,
        payload.hasPrefix("\(other.rawValue):"),
        let dragged = others.first(where: { "\(other.rawValue):\($0.id)" == payload })
      else {
        return false
      }

      let (left, right) = side == .left ? (card, dragged) : (dragged, card)
      tryPair(left: left, right: right)
      return true
    }
    .accessibilityLabel(label(card, state: state))
    .accessibilityAddTraits(state == .selected ? .isSelected : [])
  }

  private func label(_ card: MatchCard, state: MatchCardState) -> Text {
    let text = LessonRichText.plain(card.text)

    switch state {
    case .matched:
      return Text(
        "\(text), matched", tableName: "Activities", comment: "VoiceOver: a card already matched")
    case .noMatch:
      return Text(
        "\(text), no match", tableName: "Activities",
        comment: "VoiceOver: a trap card with no match")
    default:
      return Text(verbatim: text)
    }
  }

  private func state(of card: MatchCard, side: MatchPairs.Side) -> MatchCardState {
    if !card.isTrap, progress.matched.contains(card.id) {
      return .matched
    }

    if card.isTrap, isComplete || progress.traps.contains(card.id) {
      return .noMatch
    }

    if let miss, (side == .left ? miss.left : miss.right) == card.id {
      return .missed
    }

    return selection[side] == card.id ? .selected : .idle
  }

  private func pick(_ card: MatchCard, side: MatchPairs.Side, others: [MatchCard]) {
    var next = selection
    next[side] = selection[side] == card.id ? nil : card.id
    miss = nil

    let columns = MatchPairs.columns(fields)
    let left = next[.left].flatMap { id in columns.left.first { $0.id == id } }
    let right = next[.right].flatMap { id in columns.right.first { $0.id == id } }

    if let left, let right {
      tryPair(left: left, right: right)
    } else {
      selection = next
    }
  }

  private func tryPair(left: MatchCard, right: MatchCard) {
    let next = MatchPairs.recordTry(progress, left: left, right: right)
    progress = next
    selection = [:]
    context.setAnswer(MatchPairs.answer(pairIds: pairIds, progress: next))

    let leftText = LessonRichText.plain(left.text)
    let rightText = LessonRichText.plain(right.text)

    if MatchPairs.isMatch(left, right) {
      miss = nil
      announceActivityChange(
        String(
          localized:
            "Matched \(leftText) with \(rightText). \(next.matched.count) of \(pairIds.count) pairs matched.",
          table: "Activities", comment: "VoiceOver, after a pair is matched"))
      return
    }

    let (reason, trap) = MatchPairs.mismatch(left: left, right: right)
    let trapNote = trap.map {
      String(
        localized: "“\(LessonRichText.plain($0.text))” has no match.", table: "Activities",
        comment: "Says that the trap card the learner picked has no match")
    }
    let explanation = [trapNote, reason].compactMap(\.self).joined(separator: " ")
    miss = Miss(
      left: left.id, right: right.id, explanation: explanation.isEmpty ? nil : explanation)

    announceActivityChange(
      [
        String(
          localized: "\(leftText) and \(rightText) don't go together.", table: "Activities",
          comment: "VoiceOver, after two cards that don't match are picked"),
        explanation.isEmpty ? nil : LessonRichText.plain(explanation),
      ].compactMap(\.self).joined(separator: " "))
  }

  @ViewBuilder
  private func results(_ columns: (left: [MatchCard], right: [MatchCard])) -> some View {
    let expected = Dictionary(pairIds.map { ($0, $0) }, uniquingKeysWith: { first, _ in first })
    let missed = columns.left.filter { !$0.isTrap && progress.firstTries[$0.id] != expected[$0.id] }
    let traps = (columns.left + columns.right).filter(\.isTrap)
    let textOf = { (id: String?) in columns.right.first { $0.id == id }?.text ?? "" }

    if !missed.isEmpty {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "Missed on the first try", tableName: "Activities",
          comment: "Above the pairs a learner missed at first"
        )
        .font(.subheadline.weight(.semibold))
        ActivityReasonList(
          reasons: missed.map { card in
            ActivityReasonList.Reason(
              id: card.id,
              text: String(
                localized:
                  "\(card.text) goes with \(textOf(expected[card.id])), not \(textOf(progress.firstTries[card.id])).",
                table: "Activities",
                comment: "After the check: a pair the learner first matched wrong"),
              why: card.why)
          })
      }
    }

    if !traps.isEmpty {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "Look-alikes with no match", tableName: "Activities",
          comment: "Above the trap cards after the check"
        )
        .font(.subheadline.weight(.semibold))
        ActivityReasonList(
          reasons: traps.map { ActivityReasonList.Reason(id: $0.id, text: $0.text, why: $0.why) })
      }
    }
  }
}

private enum MatchCardState {
  case idle, selected, matched, missed, noMatch

  var mark: ActivityTileMark {
    switch self {
    case .selected: .selected
    case .matched: .right
    case .missed: .wrong
    default: .plain
    }
  }
}

private struct MatchCardStyle: ButtonStyle {
  let state: MatchCardState

  func makeBody(configuration: Configuration) -> some View {
    if state == .noMatch {
      configuration.label
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.leading)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(minHeight: 44)
        .overlay {
          RoundedRectangle(cornerRadius: 12)
            .strokeBorder(Color(.separator), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
        }
    } else {
      ActivityTileStyle(mark: state.mark).makeBody(configuration: configuration)
    }
  }
}
