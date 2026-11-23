import SwiftUI

extension ActivityRenderer {
  static let matchPairs = ActivityRenderer(
    template: "matchPairs",
    grade: ActivityExpectedAnswer.grader(MatchPairsFields.self) { $0.expected }
  ) { context in
    if let fields = try? context.fields(as: MatchPairsFields.self) {
      MatchPairsCanvas(fields: fields, context: context)
    }
  }
}

private struct MatchPairsCanvas: View {
  private struct Miss: Equatable, Sendable {
    let left: String
    let right: String
    let explanation: String?
  }

  let fields: MatchPairsFields
  let context: ActivityCanvasContext

  @Environment(\.legibilityWeight) private var legibilityWeight
  @Environment(\.stacksContent) private var isStacked
  @ActivityState private var progress: MatchPairs.Progress
  @ActivityState("selection") private var selection: [MatchPairs.Side: String] = [:]
  @ActivityState("miss") private var miss: Miss? = nil

  init(fields: MatchPairsFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context
    _progress = ActivityState(wrappedValue: MatchPairs.progress(from: context.answer), "progress")
  }

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var pairIds: [String] { fields.pairs.map(\.id) }
  private var isComplete: Bool { progress.matched.count == pairIds.count }

  var body: some View {
    let columns = MatchPairs.columns(fields)
    VStack(alignment: .leading, spacing: 16) {
      ActivityCaption(caption)

      if isComplete {
        solvedBoard(columns)
      } else {
        AccessibilityStack(alignment: .top, spacing: 10, stackedSpacing: 16) {
          column(.left, columns.left, others: columns.right)
          column(.right, columns.right, others: columns.left)
        }
      }

      if let miss {
        Label {
          missLine(miss, spoken: false)
        } icon: {
          Image(systemName: "xmark.circle")
            .foregroundStyle(.destructive)
        }
        .accessibilityLabel(missLine(miss, spoken: true))
        .typeStyle(.body)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.destructive.opacity(0.1), in: .rect(cornerRadius: Radius.option))
      }

      if isChecked {
        results(columns)
      }
    }
  }

  private var caption: Text {
    Text(
      "\(progress.matched.count) of \(pairIds.count) pairs matched", tableName: "Activities",
      comment: "How many pairs the learner matched")
  }

  private func missLine(_ miss: Miss, spoken: Bool) -> Text {
    let explanation =
      miss.explanation.map {
        LessonRichText.typeset($0).quoted(spoken: spoken, legibility: legibilityWeight)
      }
      ?? Text(
        "Those two don't go together.", tableName: "Activities",
        comment: "Two picked cards don't match and there's no note on why")

    return Text(
      "\(Text("Not quite:", tableName: "Activities", comment: "Before why two picked cards don't match").typeWeight(.semibold, legibility: legibilityWeight)) \(explanation)",
      tableName: "Activities",
      comment: "Why two picked cards don't match, after a bold 'Not quite:'")
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

  private func solvedBoard(_ columns: (left: [MatchCard], right: [MatchCard])) -> some View {
    VStack(spacing: isStacked ? 16 : 8) {
      ForEach(MatchPairs.solvedRows(left: columns.left, right: columns.right), id: \.self) { row in
        AccessibilityStack(spacing: 10, stackedSpacing: 8) {
          cardButton(row.left, side: .left, others: columns.right)
          cardButton(row.right, side: .right, others: columns.left)
        }
        .fixedSize(horizontal: false, vertical: true)
      }
    }
  }

  private func cardButton(_ card: MatchCard, side: MatchPairs.Side, others: [MatchCard])
    -> some View
  {
    let state = state(of: card, side: side)
    let other: MatchPairs.Side = side == .left ? .right : .left

    return Button {
      pick(card, side: side)
    } label: {
      LessonRichText(card.text)
        .frame(maxHeight: isComplete ? .infinity : nil, alignment: .leading)
    }
    .buttonStyle(ActivityTileStyle(mark: state.mark))
    .disabled(isChecked || state == .matched)
    .draggable(ActivityDragItem(id: "\(side.rawValue):\(card.id)"))
    .dropDestination(for: ActivityDragItem.self) { dropped, _ in
      guard !isChecked, state != .matched, let payload = dropped.first?.id,
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
    let text = LessonRichText.spoken(card.text)

    switch state {
    case .matched:
      return Text(
        "\(text), matched", tableName: "Activities", comment: "VoiceOver: a card already matched")
    default:
      return Text(verbatim: text)
    }
  }

  private func state(of card: MatchCard, side: MatchPairs.Side) -> MatchCardState {
    if progress.matched.contains(card.id) {
      return .matched
    }

    if let miss, (side == .left ? miss.left : miss.right) == card.id {
      return .missed
    }

    return selection[side] == card.id ? .selected : .idle
  }

  private func pick(_ card: MatchCard, side: MatchPairs.Side) {
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

    let leftText = LessonRichText.spoken(left.text)
    let rightText = LessonRichText.spoken(right.text)

    if left.id == right.id {
      miss = nil
      announcePolitely(
        String(
          localized:
            "Matched \(leftText) with \(rightText). \(next.matched.count) of \(pairIds.count) pairs matched.",
          table: "Activities", comment: "VoiceOver, after a pair is matched"))
      return
    }

    let explanation = right.why ?? left.why
    miss = Miss(left: left.id, right: right.id, explanation: explanation)

    announcePolitely(
      [
        String(
          localized: "\(leftText) and \(rightText) don't go together.", table: "Activities",
          comment: "VoiceOver, after two cards that don't match are picked"),
        explanation.map { LessonRichText.spoken($0) },
      ].compactMap(\.self).joinedSentences())
  }

  @ViewBuilder
  private func results(_ columns: (left: [MatchCard], right: [MatchCard])) -> some View {
    let expected = Dictionary(pairIds.map { ($0, $0) }, uniquingKeysWith: { first, _ in first })
    let missed = columns.left.filter { progress.firstTries[$0.id] != expected[$0.id] }
    let textOf = { (id: String?) in columns.right.first { $0.id == id }?.text }

    if !missed.isEmpty {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "Missed on the first try", tableName: "Activities",
          comment: "Above the pairs a learner missed at first"
        )
        .typeStyle(.body.weight(.semibold))
        ActivityReasonList(
          reasons: missed.map { card in
            let partner = textOf(expected[card.id]) ?? card.text
            let text =
              textOf(progress.firstTries[card.id]).map { picked in
                String(
                  localized: "\(card.text) goes with \(partner), not \(picked).",
                  table: "Activities",
                  comment: "After the check: a pair the learner first matched wrong")
              } ?? "\(card.text) → \(partner)"
            return ActivityReasonList.Reason(
              id: card.id, text: text,
              why: card.why)
          })
      }
    }

  }
}

private enum MatchCardState {
  case idle, selected, matched, missed

  var mark: ActivityTileMark {
    switch self {
    case .selected: .selected
    case .matched: .right
    case .missed: .wrong
    default: .plain
    }
  }
}
