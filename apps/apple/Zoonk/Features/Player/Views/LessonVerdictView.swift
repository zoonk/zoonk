import SwiftUI

/// The feedback panel above the action bar: the verdict in a few words with its symbol and soft
/// color, the right answer when missed, the why, and notes on what happens next.
struct LessonVerdictView: View {
  let step: LessonStep
  let result: LessonStepResult
  let store: LessonPlayerStore
  /// The question comes back at the end of the lesson.
  let willReturn: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Label {
        Text(verdict.title)
          .font(.headline)
      } icon: {
        Image(systemName: verdict.symbol)
      }
      .foregroundStyle(verdict.tint)

      if let spelling = result.spelling {
        LabeledText(
          label: Text(
            "Spelled:", tableName: "Player", comment: "Before the right spelling of a typed answer"),
          text: spelling)
      }

      if !result.isCorrect, let correctAnswer = result.correctAnswer, step.kind != .typedAnswer {
        LabeledText(
          label: Text(
            "Correct answer", tableName: "Player", comment: "Before the right answer after a miss"),
          text: correctAnswer)
      }

      if case .typedAnswer(let content) = step.content, !result.isCorrect {
        if !result.checked {
          Text(
            "Each question is checked a few times a day. Compare your answer with this one:",
            tableName: "Player",
            comment: "A typed answer that wasn't graded, before the sample answer"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }

        LabeledText(
          label: Text(
            "Answer:", tableName: "Player", comment: "Before a typed question's sample answer"),
          text: content.sampleAnswer)
      }

      ForEach(result.corrections, id: \.self) { correction in
        Text("\(Text(correction.wrong).strikethrough()) → \(Text(correction.right).bold())")
          .font(.subheadline)
      }

      if let keyPoints = result.keyPoints, !keyPoints.isEmpty {
        LessonKeyPointsView(keyPoints: keyPoints)
      }

      if let feedback = result.feedback, !feedback.isEmpty {
        LessonRichText(feedback)
          .font(.subheadline)
      }

      if case .typedAnswer = step.content, !result.isCorrect, result.checked {
        LessonExplainAnswerView(step: step, store: store)
      }

      if let note {
        Text(note)
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding()
    .background(verdict.tint.opacity(0.15), in: .rect(cornerRadius: 20))
    .accessibilityElement(children: .combine)
  }

  private var note: LocalizedStringResource? {
    if result.savedMistake {
      return willReturn
        ? LocalizedStringResource(
          "Saved to your mistakes · back at the end of this lesson", table: "Player",
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

    return nil
  }

  private struct Verdict {
    let title: LocalizedStringResource
    let symbol: String
    let tint: Color
  }

  /// Right reads in soft blue, wrong in soft pink; a hook's guess is never wrong.
  private var verdict: Verdict {
    if step.kind == .hook {
      return result.isCorrect
        ? Verdict(
          title: LocalizedStringResource(
            "Good guess!", table: "Player", comment: "A hook's guess was right"),
          symbol: "sparkles", tint: .success)
        : Verdict(
          title: LocalizedStringResource(
            "Here's the answer", table: "Player", comment: "A hook's guess missed"),
          symbol: "sparkles", tint: .secondary)
    }

    if result.isCorrect {
      return result.spelling == nil
        ? Verdict(
          title: LocalizedStringResource(
            "Correct!", table: "Player", comment: "The answer was right"), symbol: "checkmark",
          tint: .success)
        : Verdict(
          title: LocalizedStringResource(
            "Right, watch the spelling", table: "Player",
            comment: "A right typed answer with a typo"),
          symbol: "checkmark", tint: .success)
    }

    if step.kind == .typedAnswer, !result.checked {
      return Verdict(
        title: LocalizedStringResource(
          "Not checked this time", table: "Player", comment: "A typed answer that wasn't graded"),
        symbol: "text.bubble", tint: .secondary)
    }

    if let score = result.score, score >= 0.5 {
      return Verdict(
        title: LocalizedStringResource(
          "Almost there", table: "Player", comment: "A typed or spoken answer that was partly right"
        ),
        symbol: "circle.lefthalf.filled", tint: .warning)
    }

    return Verdict(
      title: LocalizedStringResource("Not quite", table: "Player", comment: "The answer was wrong"),
      symbol: "xmark", tint: .destructive)
  }
}

private struct LabeledText: View {
  let label: Text
  let text: String

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      label
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
      LessonRichText(text)
        .font(.body.weight(.medium))
    }
  }
}

/// Which key points a typed answer stated, by meaning.
private struct LessonKeyPointsView: View {
  let keyPoints: [LessonStepResult.KeyPoint]

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(
        "\(keyPoints.filter(\.met).count) of \(keyPoints.count) key points", tableName: "Player",
        comment: "How many key points a typed answer stated"
      )
      .font(.caption.weight(.medium))
      .foregroundStyle(.secondary)

      ForEach(keyPoints, id: \.self) { point in
        Label {
          Text(point.text)
        } icon: {
          Image(systemName: point.met ? "checkmark.circle" : "circle.dashed")
            .foregroundStyle(point.met ? .success : .secondary)
        }
        .font(.subheadline)
        .accessibilityLabel(
          point.met
            ? Text(
              "Stated: \(point.text)", tableName: "Player", comment: "A key point the answer stated"
            )
            : Text(
              "Missing: \(point.text)", tableName: "Player",
              comment: "A key point the answer missed"))
      }
    }
  }
}

/// "Explain my answer": why a wrong typed answer misses, written on the learner's tap.
private struct LessonExplainAnswerView: View {
  let step: LessonStep
  let store: LessonPlayerStore

  var body: some View {
    switch store.explanations[step.id] {
    case nil:
      Button {
        Task { await store.explainAnswer() }
      } label: {
        Text("Explain my answer", tableName: "Player", comment: "Asks why a typed answer is wrong")
      }
      .buttonStyle(.bordered)
    case .loading:
      HStack {
        ProgressView()
        Text(
          "Explaining your answer", tableName: "Player",
          comment: "While the explanation of a typed answer is written")
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)
    case .explained(let explanation):
      VStack(alignment: .leading, spacing: 2) {
        Text(
          "Why that answer misses", tableName: "Player",
          comment: "Title above why a typed answer is wrong"
        )
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
        LessonRichText(explanation)
          .font(.subheadline)
      }
    case .refused(let refusal):
      LessonHelpLimitNote(refusal: refusal)
    case .failed:
      Text(
        "We couldn't explain it right now. Try again in a moment.", tableName: "Player",
        comment: "The explanation of a typed answer failed"
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }
  }
}
