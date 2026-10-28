import SwiftUI

/// Renders one screen by its kind. Screens report the learner's answer to the store; the verdict
/// and the next action live in the action bar.
struct LessonStepView: View {
  let step: LessonStep
  let state: LessonPlayerState
  let store: LessonPlayerStore

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      switch step.content {
      case .hook(let content):
        HookStepView(step: step, content: content, context: context)
      case .explanation(let content):
        ExplanationStepView(step: step, content: content)
      case .workedExample(let content):
        WorkedExampleStepView(step: step, content: content, shown: state.revealed[step.id] ?? 1)
      case .check(let content):
        CheckStepView(step: step, content: content, context: context)
      case .typedAnswer(let content):
        TypedAnswerStepView(content: content, context: context)
      case .spokenAnswer(let content, let listening):
        SpokenAnswerStepView(step: step, content: content, listening: listening, context: context)
      case .activity(let content):
        ActivityStepView(step: step, content: content, context: context)
      case .summary(let content):
        SummaryStepView(content: content)
      case .challenge(let content):
        ChallengeStepView(step: step, content: content, state: state, store: store)
      case .language(let exercise, let wordHints):
        LanguageStepView(exercise: exercise, wordHints: wordHints, context: context)
      }

      if let citation = step.citation {
        LessonCitationView(citation: citation)
      }
    }
  }

  private var context: LessonStepContext {
    LessonStepContext(
      lessonId: state.lessonId,
      answer: state.answers[step.id],
      result: state.results[step.id],
      isLocked: state.phase != .playing,
      select: { store.select($0) },
      resolveSpoken: { store.resolveSpoken($0) })
  }
}

/// What a screen reads and reports: its answer (kept in the player's state), its verdict, and
/// whether it still takes changes.
struct LessonStepContext {
  let lessonId: String
  let answer: LessonAnswer?
  let result: LessonStepResult?
  let isLocked: Bool
  let select: @MainActor (LessonAnswer?) -> Void
  let resolveSpoken: @MainActor (SpokenAnswerVerdict) -> Void
}

// MARK: - Teaching screens

private struct HookStepView: View {
  let step: LessonStep
  let content: HookContent
  let context: LessonStepContext

  var body: some View {
    if let question = content.question, let options = content.options, content.variant == .guess {
      Text(
        "Guess first", tableName: "Player", comment: "Above a hook's question: a guess never counts"
      )
      .font(.caption.monospaced())
      .foregroundStyle(.secondary)
      LessonQuestionText(text: question)
      StepMedia(step: step, description: content.image, visual: content.visual)
      LessonOptionList(
        options: options.map { LessonOption(id: $0.id, text: $0.text, isCorrect: $0.isCorrect) },
        selectedId: context.answer.flatMap { if case .hookGuess(let id) = $0 { id } else { nil } },
        isChecked: context.result != nil,
        isLocked: context.isLocked,
        isGuess: true
      ) { context.select(.hookGuess(optionId: $0)) }
    } else {
      LessonRichText(content.text ?? "")
        .font(.title2.weight(.semibold))
      StepMedia(step: step, description: content.image, visual: content.visual)
    }
  }
}

private struct ExplanationStepView: View {
  @Environment(\.activityRenderers) private var activityRenderers

  let step: LessonStep
  let content: ExplanationContent

  var body: some View {
    if let title = content.title {
      LessonQuestionText(text: title)
    }

    LessonRichText(content.text)
      .font(.body)
    StepMedia(step: step, description: content.image, visual: content.visual)

    if let explore = content.explore,
      let renderer = activityRenderers.renderer(for: explore.template)
    {
      renderer.canvas(
        ActivityCanvasContext(
          template: explore.template, payload: explore.payload, check: nil, phase: .explore,
          answer: nil, setAnswer: { _ in }))
    }
  }
}

private struct WorkedExampleStepView: View {
  let step: LessonStep
  let content: WorkedExampleContent
  let shown: Int

  var body: some View {
    Text("Worked example", tableName: "Player", comment: "Label above a worked example")
      .font(.caption.monospaced())
      .foregroundStyle(.secondary)

    if let title = content.title {
      LessonQuestionText(text: title)
    }

    LessonRichText(content.problem)
    StepMedia(step: step, description: content.image, visual: content.visual)

    VStack(alignment: .leading, spacing: 12) {
      ForEach(Array(content.steps.prefix(shown).enumerated()), id: \.offset) { index, part in
        HStack(alignment: .firstTextBaseline, spacing: 12) {
          Text(index + 1, format: .number)
            .font(.subheadline.monospacedDigit().weight(.semibold))
            .foregroundStyle(.secondary)
          VStack(alignment: .leading, spacing: 4) {
            LessonRichText(part.text)
            if let math = part.math {
              Text(LessonRichText.readable(math))
                .font(.body.monospaced())
            }
          }
        }
        .accessibilityElement(children: .combine)
      }
    }

    if shown >= content.steps.count {
      LessonRichText(content.result)
        .font(.headline)
    }
  }
}

private struct CheckStepView: View {
  let step: LessonStep
  let content: CheckContent
  let context: LessonStepContext

  var body: some View {
    if let context = content.context {
      LessonRichText(context)
        .foregroundStyle(.secondary)
    }

    if let basis = content.basis {
      Text("“\(basis.quote)”")
        .font(.callout.italic())
        .foregroundStyle(.secondary)
    }

    LessonQuestionText(text: content.question)
    StepMedia(step: step, description: content.image, visual: content.visual)
    LessonOptionList(
      options: content.options.map {
        LessonOption(id: $0.id, text: $0.text, isCorrect: $0.isCorrect, pictureAlt: $0.picture?.alt)
      },
      selectedId: context.answer.flatMap { if case .check(let id) = $0 { id } else { nil } },
      isChecked: context.result != nil,
      isLocked: context.isLocked
    ) { context.select(.check(optionId: $0)) }
  }
}

private struct TypedAnswerStepView: View {
  let content: TypedAnswerContent
  let context: LessonStepContext
  @FocusState private var isFocused: Bool

  var body: some View {
    if let context = content.context {
      LessonRichText(context)
        .foregroundStyle(.secondary)
    }

    LessonQuestionText(text: content.question)

    if let visual = content.visual {
      LessonVisualView(visual: visual)
    }

    LessonAnswerField(
      text: context.answer?.text ?? "",
      isLocked: context.isLocked,
      isFocused: $isFocused
    ) { context.select($0.isEmpty ? nil : .typedAnswer(text: $0)) }
    .onAppear { isFocused = !context.isLocked }
  }
}

/// A written answer, several lines, in a rounded field.
struct LessonAnswerField: View {
  let text: String
  let isLocked: Bool
  var isFocused: FocusState<Bool>.Binding
  let onChange: (String) -> Void

  var body: some View {
    TextField(
      text: Binding(get: { text }, set: onChange), axis: .vertical
    ) {
      Text("Write your answer", tableName: "Player", comment: "Placeholder of a written answer")
    }
    .lineLimit(3...8)
    .focused(isFocused)
    .disabled(isLocked)
    .padding()
    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 16))
  }
}

private struct SpokenAnswerStepView: View {
  @Environment(\.spokenAnswerRecording) private var recording
  @State private var cantTalk = false
  @FocusState private var isFocused: Bool

  let step: LessonStep
  let content: SpokenAnswerContent
  let listening: LanguageExercise?
  let context: LessonStepContext

  var body: some View {
    if cantTalk, let listening {
      LanguageStepView(exercise: listening, wordHints: nil, context: context)
    } else {
      Text("Tap and say it out loud", tableName: "Player", comment: "Above a sentence to say")
        .font(.caption.monospaced())
        .foregroundStyle(.secondary)
      LessonQuestionText(text: content.prompt)
      VStack(alignment: .leading, spacing: 4) {
        Text(content.targetText)
          .font(.title3.weight(.medium))
        if let romanization = content.romanization {
          Text(romanization).foregroundStyle(.secondary)
        }
        if let translation = content.translation {
          Text(translation).foregroundStyle(.secondary)
        }
      }

      if let input = recording.input {
        input(
          SpokenAnswerContext(
            lessonId: context.lessonId, stepId: step.id, content: content,
            isLocked: context.isLocked,
            onGraded: context.resolveSpoken))
      } else {
        LessonAnswerField(
          text: context.answer?.text ?? "", isLocked: context.isLocked, isFocused: $isFocused
        ) {
          context.select($0.isEmpty ? nil : .spokenAnswer(text: $0))
        }
      }

      if listening != nil, !context.isLocked {
        Button {
          context.select(nil)
          cantTalk = true
        } label: {
          Text(
            "I can't talk now", tableName: "Player",
            comment: "Answers a spoken screen as a listening exercise")
        }
        .buttonStyle(.bordered)
      }
    }
  }
}

private struct SummaryStepView: View {
  let content: SummaryContent

  var body: some View {
    Text("Summary", tableName: "Player", comment: "Title of a lesson's summary screen")
      .font(.title2.weight(.semibold))
      .accessibilityAddTraits(.isHeader)

    VStack(alignment: .leading, spacing: 12) {
      ForEach(Array(content.ideas.enumerated()), id: \.offset) { _, idea in
        Label {
          LessonRichText(idea.text)
        } icon: {
          Image(systemName: "lightbulb")
            .foregroundStyle(.secondary)
        }
      }
    }
  }
}

/// A screen's drawn picture and its chart or timeline.
struct StepMedia: View {
  let step: LessonStep
  let description: LessonPictureDescription?
  let visual: LessonVisual?

  var body: some View {
    LessonPictureView(image: step.image, description: description, isPending: step.imagePending)

    if let visual {
      LessonVisualView(visual: visual)
    }
  }
}
