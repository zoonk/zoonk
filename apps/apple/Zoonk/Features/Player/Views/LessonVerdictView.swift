import SwiftUI

struct LessonVerdictView: View {
  @Environment(\.legibilityWeight) private var legibility

  let step: LessonStep
  let result: LessonStepResult
  let store: LessonPlayerStore
  let willReturn: Bool
  var hyperdriveStreak: Int?

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      FeedbackVerdict(Text(verdict.title), tone: verdict.tone, symbol: verdict.symbol) {
        if let hyperdriveStreak {
          Text(
            "\(hyperdriveStreak) right in a row", tableName: "Player",
            comment: "Hyperdrive: right answers in a row")
        }
      }

      if let spelling = result.spelling {
        LabeledText(
          label: Text(
            "Spelled:", tableName: "Player", comment: "Before the right spelling of a typed answer"),
          text: spelling)
      }

      if correctReason == nil {
        correctAnswerLine
      }

      if case .typedAnswer(let content) = step.content, !result.isCorrect {
        if !result.checked {
          Text(
            "Each question is checked a few times a day. Compare your answer with this one:",
            tableName: "Player",
            comment: "A typed answer that wasn't graded, before the sample answer"
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }

        LabeledText(
          label: Text(
            "Answer:", tableName: "Player", comment: "Before a typed question's sample answer"),
          text: content.sampleAnswer)
      }

      if let heard = result.heard, case .spokenAnswer(let content, _) = step.content {
        LessonSpokenWordsView(heard: heard, language: content.language)
      }

      ForEach(result.corrections, id: \.self) { correction in
        Text(
          "\(Text(correction.wrong).strikethrough()) → \(Text(correction.right).typeWeight(.bold, legibility: legibility))"
        )
        .typeStyle(.body)
      }

      if let keyPoints = result.keyPoints, !keyPoints.isEmpty {
        LessonKeyPointsView(keyPoints: keyPoints)
      }

      if let feedback = result.feedback, !feedback.isEmpty {
        LessonTextBlocks(feedback)
          .typeStyle(.body)
      }

      if let correctReason {
        correctAnswerLine

        LessonTextBlocks(correctReason)
          .typeStyle(.body)
      }

      if case .language(_, let wordHints?) = step.content {
        LessonWordHints(hints: wordHints)
          .typeStyle(.body)
      }

      if case .typedAnswer = step.content, !result.isCorrect, result.checked, !result.isSampleAnswer
      {
        LessonExplainAnswerView(step: step, store: store)
      }

      if let note {
        Text(note)
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
    }
    .feedbackPanel()
    .accessibilityElement(children: .contain)
  }

  /// A guess's reveal already names the right option, and the option list marks it.
  @ViewBuilder
  private var correctAnswerLine: some View {
    if !result.isCorrect, let correctAnswer = result.correctAnswer,
      !Self.marksItsAnswer.contains(step.kind)
    {
      LabeledText(
        label: Text(
          "Correct answer", tableName: "Player", comment: "Before the right answer after a miss"),
        text: correctAnswer)
    }
  }

  /// Steps whose options already mark the right one, and a typed answer, which shows its sample.
  private static let marksItsAnswer: Set<LessonStepKind> = [
    .typedAnswer, .hook, .check, .multipleChoice, .translation,
  ]

  /// Main's activity feedback: after a missed choice, the picked option's reason, then the right
  /// option with its own.
  private var correctReason: String? {
    guard !result.isCorrect, case .activity(let content) = step.content,
      case .choice(_, let options, _, _) = content.check,
      let reason = options.first(where: \.isCorrect)?.reason, !reason.isEmpty
    else { return nil }

    return reason
  }

  private var note: LocalizedStringResource? {
    if result.savedMistake {
      return willReturn
        ? LocalizedStringResource(
          "Saved to your mistakes\u{00A0}· back at the end of this lesson", table: "Player",
          comment:
            "A missed question went to the mistakes notebook and comes back later in the lesson")
        : LocalizedStringResource(
          "Saved to your mistakes", table: "Player",
          comment: "A missed question went to the mistakes notebook")
    }

    if willReturn {
      return LocalizedStringResource(
        "This question comes back at the end of the lesson", table: "Player",
        comment: "A missed question returns at the end of the lesson")
    }

    if let reviewAt = result.nextReviewAt {
      return LocalizedStringResource(
        "Review on \(reviewAt.formatted(.dateTime.day().month(.abbreviated)))", table: "Player",
        comment: "When the lesson's idea comes back for review")
    }

    return nil
  }

  private var verdict: LessonVerdict {
    .of(result, step: step)
  }
}

private struct LabeledText: View {
  let label: Text
  let text: String

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      label
        .typeStyle(.meta.weight(.medium))
        .foregroundStyle(.mutedForeground)
      LessonRichText(text)
        .typeStyle(.body.weight(.medium))
    }
  }
}

private struct LessonKeyPointsView: View {
  let keyPoints: [LessonStepResult.KeyPoint]

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(
        "\(keyPoints.filter(\.met).count) of \(keyPoints.count) key points", tableName: "Player",
        comment: "How many key points a typed answer stated"
      )
      .typeStyle(.meta.weight(.medium))
      .foregroundStyle(.mutedForeground)

      ForEach(keyPoints, id: \.self) { point in
        Label {
          LessonRichText(point.text)
        } icon: {
          Image(systemName: point.met ? "checkmark.circle" : "circle.dashed")
            .foregroundStyle(point.met ? .success : .mutedForeground)
        }
        .typeStyle(.note)
        .accessibilityLabel(
          point.met
            ? Text(
              "Stated: \(LessonRichText.spoken(point.text))", tableName: "Player",
              comment: "A key point the answer stated")
            : Text(
              "Missing: \(LessonRichText.spoken(point.text))", tableName: "Player",
              comment: "A key point the answer missed"))
      }
    }
  }
}

/// Written only on the learner's tap. After a failure or a refusal the button stays, so the learner
/// can ask again, as on main.
private struct LessonExplainAnswerView: View {
  let step: LessonStep
  let store: LessonPlayerStore

  var body: some View {
    let state = store.explanations[step.id]

    if case .explained(let explanation) = state {
      VStack(alignment: .leading, spacing: 2) {
        Text(
          "Why that answer misses", tableName: "Player",
          comment: "Title above why a typed answer is wrong"
        )
        .typeStyle(.meta.weight(.medium))
        .foregroundStyle(.mutedForeground)
        LessonTextBlocks(explanation)
          .typeStyle(.note)
      }
    } else {
      VStack(alignment: .leading, spacing: 8) {
        Button {
          Task { await store.explainAnswer() }
        } label: {
          if state == .loading {
            HStack {
              ProgressView()
              Text(
                "Explaining your answer", tableName: "Player",
                comment: "While the explanation of a typed answer is written")
            }
          } else {
            Label {
              Text(
                "Explain my answer", tableName: "Player",
                comment: "Asks why a typed answer is wrong")
            } icon: {
              Image(systemName: "lightbulb")
            }
          }
        }
        .buttonStyle(.outline)
        .disabled(state == .loading)

        switch state {
        case .failed:
          Text(Self.failedLine)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        case .refused(let refusal):
          LessonHelpLimitNote(refusal: refusal)
        default:
          EmptyView()
        }
      }
      .announcesStatus(statusLine)
    }
  }

  private var statusLine: String? {
    switch store.explanations[step.id] {
    case .failed: Self.failedLine
    case .refused(let refusal): LessonHelpLimitNote.message(refusal)
    default: nil
    }
  }

  private static var failedLine: String {
    String(
      localized: "We couldn't explain it right now. Try again in a moment.", table: "Player",
      comment: "The explanation of a typed answer failed")
  }
}

/// What a checked answer was. A hook's guess is never wrong.
struct LessonVerdict {
  let title: LocalizedStringResource
  var symbol: String?
  let tone: FeedbackTone
}

extension LessonVerdict {
  static func guess(isRight: Bool) -> LessonVerdict {
    isRight
      ? LessonVerdict(
        title: LocalizedStringResource(
          "Good guess!", table: "Player", comment: "A hook's guess was right"),
        symbol: "sparkles", tone: .right)
      : LessonVerdict(
        title: LocalizedStringResource(
          "Here's the answer", table: "Player", comment: "A hook's guess missed"),
        symbol: "sparkles", tone: .neutral)
  }

  static func of(_ result: LessonStepResult, step: LessonStep) -> LessonVerdict {
    if result.isSampleAnswer {
      return LessonVerdict(
        title: LocalizedStringResource(
          "Here's a good answer", table: "Player",
          comment: "\"I don't know yet\" shows a good answer"),
        tone: .neutral)
    }

    if step.kind == .hook {
      return .guess(isRight: result.isCorrect)
    }

    if result.isCorrect {
      return result.spelling == nil
        ? LessonVerdict(
          title: LocalizedStringResource(
            "Correct!", table: "Player", comment: "The answer was right"), tone: .right)
        : LessonVerdict(
          title: LocalizedStringResource(
            "Right, watch the spelling", table: "Player",
            comment: "A right typed answer with a typo"),
          tone: .right)
    }

    if step.kind == .typedAnswer, !result.checked {
      return LessonVerdict(
        title: LocalizedStringResource(
          "Not checked this time", table: "Player", comment: "A typed answer that wasn't graded"),
        tone: .neutral)
    }

    if let score = result.score, score > 0 {
      return LessonVerdict(
        title: LocalizedStringResource(
          "Almost there", table: "Player", comment: "A typed or spoken answer that was partly right"
        ),
        tone: .almost)
    }

    return LessonVerdict(
      title: LocalizedStringResource(
        "Not quite", table: "Player",
        comment: "Gentle verdict after a wrong answer, without saying it was almost right"),
      tone: .wrong)
  }
}
