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
  /// Why the last try didn't go together, until the next tap.
  private struct MissNote: Equatable, Sendable {
    let explanation: String?
  }

  let fields: MatchPairsFields
  let context: ActivityCanvasContext

  @Environment(\.legibilityWeight) private var legibilityWeight
  @ActivityState private var progress: MatchPairs.Progress
  @ActivityState("picking") private var picking = MatchPicking()
  @ActivityState("missNote") private var missNote: MissNote? = nil

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
      MatchBoard(
        leftCount: columns.left.count, rightCount: columns.right.count,
        solvedRows: isComplete ? solvedRows(columns) : nil
      ) { ref in
        cardButton(ref, columns: columns)
      }
      .matchBoardFeedback($picking, locked: progress.matched.count)

      if let missNote {
        Label {
          missLine(missNote, spoken: false)
        } icon: {
          Image(systemName: "xmark.circle")
            .foregroundStyle(.destructive)
        }
        .accessibilityLabel(missLine(missNote, spoken: true))
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

  private func solvedRows(_ columns: (left: [MatchCard], right: [MatchCard])) -> [MatchTry] {
    columns.left.enumerated().compactMap { index, card in
      columns.right.firstIndex { $0.id == card.id }.map { MatchTry(left: index, right: $0) }
    }
  }

  private func missLine(_ miss: MissNote, spoken: Bool) -> Text {
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

  private func cardButton(
    _ ref: MatchCardRef, columns: (left: [MatchCard], right: [MatchCard])
  ) -> some View {
    let card = ref.side == .left ? columns.left[ref.index] : columns.right[ref.index]
    let isMatched = progress.matched.contains(card.id)
    let others = ref.side == .left ? columns.right : columns.left

    return MatchEntry(
      state: state(of: ref, card: card),
      keyIndex: ref.side == .left ? ref.index : columns.left.count + ref.index,
      partner: isMatched
        ? others.first { $0.id == card.id }.map { LessonRichText.spoken($0.text) } : nil,
      action: isChecked ? nil : { tap(ref, columns: columns) }
    ) {
      LessonRichText(card.text)
    }
  }

  /// Checked, a pair first tried with another card is marked, as the result below names it.
  private func state(of ref: MatchCardRef, card: MatchCard) -> MatchEntryState {
    if progress.matched.contains(card.id) {
      return isChecked && progress.firstTries[card.id] != card.id ? .missed : .right
    }

    if picking.isMissed(ref) {
      return .wrong(picking.missCount)
    }

    return picking.selected == ref ? .selected : .idle
  }

  private func tap(_ ref: MatchCardRef, columns: (left: [MatchCard], right: [MatchCard])) {
    let card = ref.side == .left ? columns.left[ref.index] : columns.right[ref.index]
    guard !progress.matched.contains(card.id) else { return }

    missNote = nil

    guard
      let (attempt, isRight) = picking.tap(
        ref, goesTogether: { columns.left[$0.left].id == columns.right[$0.right].id })
    else {
      return
    }

    let (left, right) = (columns.left[attempt.left], columns.right[attempt.right])
    let next = MatchPairs.recordTry(progress, left: left, right: right)
    progress = next
    context.setAnswer(MatchPairs.answer(pairIds: pairIds, progress: next))

    let leftText = LessonRichText.spoken(left.text)
    let rightText = LessonRichText.spoken(right.text)

    if isRight {
      announcePolitely(
        MatchAnnouncement.matched(
          leftText, rightText, matched: next.matched.count, total: pairIds.count))
      return
    }

    let explanation = right.why ?? left.why
    missNote = MissNote(explanation: explanation)

    announcePolitely(
      [
        MatchAnnouncement.missed(leftText, rightText),
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
