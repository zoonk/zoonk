import SwiftUI

extension ActivityRenderer {
  static let findError = ActivityRenderer(
    template: "findError",
    grade: ActivityExpectedAnswer.grader(FindErrorFields.self) { .selection([$0.errorStepId]) }
  ) { context in
    if let fields = try? context.fields(as: FindErrorFields.self) {
      FindErrorCanvas(fields: fields, context: context)
    }
  }
}

struct FindErrorFields: Decodable, Hashable, Sendable {
  struct Step: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let text: String
  }

  /// "ai" when the worked answer is an AI assistant's reply, to check for its mistake.
  let author: String?
  let correction: String
  let errorStepId: String
  let problem: String
  let steps: [Step]
  let why: String
}

/// A worked answer with one wrong step: the learner taps the step they think is wrong (number keys
/// pick it on a keyboard). After the check the wrong step is struck through with its correction,
/// a different pick is marked, and why the step is wrong shows under them.
private struct FindErrorCanvas: View {
  let fields: FindErrorFields
  let context: ActivityCanvasContext

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var pickedId: String? {
    context.answer?.ids?.first
  }

  private var isAIAnswer: Bool {
    fields.author == "ai"
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        Group {
          if isAIAnswer {
            Text(
              "Someone asked an AI assistant", tableName: "Activities",
              comment: "Above the question an AI assistant answered, with one wrong step")
          } else {
            Text(
              "Problem", tableName: "Activities", comment: "Above the problem of a worked answer")
          }
        }
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)

        LessonRichText(fields.problem)
      }

      if isAIAnswer {
        Label {
          Text(
            "The AI's answer. One step is wrong: spot the AI's mistake.", tableName: "Activities",
            comment: "Above an AI assistant's answer to check")
        } icon: {
          Image(systemName: "sparkles")
        }
        .font(.subheadline.weight(.medium))
      }

      VStack(spacing: 8) {
        ForEach(Array(fields.steps.enumerated()), id: \.element.id) { index, step in
          stepButton(step, index: index)
        }
      }

      if isChecked {
        VStack(alignment: .leading, spacing: 4) {
          if pickedId != fields.errorStepId,
            let errorIndex = fields.steps.firstIndex(where: { $0.id == fields.errorStepId })
          {
            Text(
              "The wrong step is step \(errorIndex + 1).", tableName: "Activities",
              comment: "After a missed pick: which step of a worked answer was wrong"
            )
            .fontWeight(.semibold)
          }

          LessonRichText(fields.why)
            .foregroundStyle(.secondary)
        }
        .font(.subheadline)
      }
    }
  }

  private func stepButton(_ step: FindErrorFields.Step, index: Int) -> some View {
    let mark = mark(for: step)

    return Button {
      context.setAnswer(step.id == pickedId ? nil : .selection([step.id]))
    } label: {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        Text(index + 1, format: .number)
          .font(.footnote.weight(.semibold).monospacedDigit())
          .foregroundStyle(.secondary)

        VStack(alignment: .leading, spacing: 4) {
          LessonRichText(step.text)
            .strikethrough(mark == .right)
            .foregroundStyle(mark == .right ? .secondary : .primary)

          if mark == .right {
            LessonRichText(fields.correction)
              .fontWeight(.semibold)
          }
        }
      }
    }
    .buttonStyle(ActivityTileStyle(mark: mark))
    .disabled(isChecked)
    .modifier(ActivityNumberKey(index: index))
    .accessibilityLabel(
      Text(
        "Step \(index + 1): \(LessonRichText.plain(step.text))", tableName: "Activities",
        comment: "VoiceOver: one step of a worked answer")
    )
    .accessibilityAddTraits(step.id == pickedId ? .isSelected : [])
    .accessibilityValue(verdict(mark))
  }

  private func mark(for step: FindErrorFields.Step) -> ActivityTileMark {
    if isChecked {
      if step.id == fields.errorStepId {
        return .right
      }

      return step.id == pickedId ? .wrong : .dimmed
    }

    return step.id == pickedId ? .selected : .plain
  }

  private func verdict(_ mark: ActivityTileMark) -> Text {
    switch mark {
    case .right:
      Text(
        "The wrong step. \(LessonRichText.plain(fields.correction))", tableName: "Activities",
        comment: "VoiceOver after the check: the step that was wrong, then its correction")
    case .wrong:
      Text(
        "Your pick", tableName: "Activities",
        comment: "VoiceOver after the check: the step the learner picked")
    default:
      Text(verbatim: "")
    }
  }
}
