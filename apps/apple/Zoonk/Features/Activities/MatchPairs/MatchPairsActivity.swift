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

extension MatchPairs {
  /// Main's `MatchPairsMisses`: each left card's first wrong try, from the answer's first tries.
  @MainActor
  static func misses(_ content: ActivityStepContent, answer: LessonAnswer?) -> MatchMisses? {
    guard let fields = try? content.fields(as: MatchPairsFields.self),
      case .activity(let answer)? = answer
    else { return nil }

    let columns = columns(fields)
    let firstTries = progress(from: answer).firstTries
    let misses = columns.left.enumerated().compactMap { index, card in
      firstTries[card.id].flatMap { tried in
        tried == card.id
          ? nil
          : columns.right.firstIndex { $0.id == tried }.map { MatchTry(left: index, right: $0) }
      }
    }

    return MatchMisses(misses) { card in
      let cards = card.side == .left ? columns.left : columns.right
      return cards.indices.contains(card.index)
        ? LessonRichText.typeset(cards[card.index].text) : nil
    }
  }
}

private struct MatchPairsCanvas: View {
  /// Why the last try didn't go together, in the card's own words, until the next tap.
  private struct MissNote: Equatable, Sendable {
    let explanation: String
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
        // Each miss's own note, so it comes into sight under a tall board as the verdict does.
        .id(picking.missCount)
        .scrollsIntoSightWhenShown()
      }
    }
  }

  private func solvedRows(_ columns: (left: [MatchCard], right: [MatchCard])) -> [MatchTry] {
    columns.left.enumerated().compactMap { index, card in
      columns.right.firstIndex { $0.id == card.id }.map { MatchTry(left: index, right: $0) }
    }
  }

  private func missLine(_ miss: MissNote, spoken: Bool) -> Text {
    let explanation = LessonRichText.typeset(miss.explanation)
      .quoted(spoken: spoken, legibility: legibilityWeight)

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

  private func state(of ref: MatchCardRef, card: MatchCard) -> MatchEntryState {
    if progress.matched.contains(card.id) {
      // A pair's two cards share its id.
      let firstTry = progress.firstTries[card.id]
      return isComplete
        ? .solved(missed: firstTry.map { $0 != card.id } ?? false) : picking.kept(ref)
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

    if let answer = MatchPairs.answer(pairIds: pairIds, progress: next) {
      context.complete(answer)
    } else {
      context.setAnswer(nil)
    }

    let leftText = LessonRichText.spoken(left.text)
    let rightText = LessonRichText.spoken(right.text)

    if isRight {
      announcePolitely(
        MatchAnnouncement.matched(
          leftText, rightText, matched: next.matched.count, total: pairIds.count))
      return
    }

    let explanation = right.why ?? left.why
    missNote = explanation.map(MissNote.init)

    announcePolitely(
      [
        MatchAnnouncement.missed(leftText, rightText),
        explanation.map { LessonRichText.spoken($0) },
      ].compactMap(\.self).joinedSentences())
  }
}
