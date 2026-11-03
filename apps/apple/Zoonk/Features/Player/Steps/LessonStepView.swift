import SwiftUI

enum LessonStepPart {
  case screen
  case turn
}

struct LessonStepView: View {
  let step: LessonStep
  let state: LessonPlayerState
  let store: LessonPlayerStore
  let part: LessonStepPart

  var body: some View {
    content
      .environment(store.work(for: step.id, round: state.rounds[step.id] ?? 0))
  }

  @ViewBuilder
  private var content: some View {
    switch step.content {
    case .hook(let content):
      HookStepView(step: step, content: content, context: context, part: part)
    case .explanation(let content):
      ExplanationStepView(step: step, content: content, part: part)
    case .workedExample(let content):
      WorkedExampleStepView(
        step: step, content: content, shown: state.revealed[step.id] ?? 1, part: part)
    case .check(let content):
      CheckStepView(step: step, content: content, context: context, part: part)

      if part == .turn {
        LessonWaysOut(state: state, store: store, step: step)
      }
    case .typedAnswer(let content):
      TypedAnswerStepView(content: content, context: context, part: part)

      if part == .turn {
        LessonWaysOut(state: state, store: store, step: step)
      }
    case .spokenAnswer(let content, let listening):
      SpokenAnswerStepView(
        step: step, content: content, listening: listening, context: context, store: store,
        part: part)
    case .activity(let content):
      ActivityStepView(step: step, content: content, context: context, part: part)
    case .summary(let content):
      if part == .screen {
        SummaryStepView(content: content)
      }
    case .challenge(let content):
      ChallengeStepView(step: step, content: content, state: state, store: store, part: part)
    case .language(let exercise, let wordHints):
      LanguageStepView(exercise: exercise, wordHints: wordHints, context: context, part: part)
    }
  }

  private var context: LessonStepContext {
    LessonStepContext(
      lessonId: state.lessonId,
      studySessionId: store.studySessionId,
      answer: state.answers[step.id],
      result: state.results[step.id],
      isLocked: state.phase != .playing,
      waitsForPicture: step.isRequiredPictureDrawing(openedAt: store.openedAt),
      select: { store.select($0) },
      resolveSpoken: { store.resolveSpoken($0, stepId: step.id) },
      check: state.phase == .playing
        && step.canCheck(state.answers[step.id], openedAt: store.openedAt) ? check : nil)
  }

  private func check() {
    Task { await store.check() }
  }
}

struct LessonStepContext {
  let lessonId: String
  let studySessionId: String?
  let answer: LessonAnswer?
  let result: LessonStepResult?
  let isLocked: Bool
  /// Picks wait while the numbered picture the question is about is still being drawn, as on main.
  let waitsForPicture: Bool
  let select: @MainActor (LessonAnswer?) -> Void
  let resolveSpoken: @MainActor (SpokenAnswerVerdict) -> Void
  /// The main button's check, or nil while that button is disabled.
  let check: (@MainActor () -> Void)?
}

private struct HookStepView: View {
  @Environment(\.isPaneSplit) private var isPaneSplit

  let step: LessonStep
  let content: HookContent
  let context: LessonStepContext
  let part: LessonStepPart

  var body: some View {
    switch part {
    case .screen: screen
    case .turn: turn
    }
  }

  @ViewBuilder
  private var screen: some View {
    if content.asksGuess, let question = content.question {
      Label {
        Text(
          "Just a guess, it doesn't count", tableName: "Player",
          comment:
            "Chip above the lesson's opening question, which the learner answers before being taught: it's only a guess, and a guess never earns or loses points."
        )
      } icon: {
        Image(systemName: "sparkles")
      }
      .chip()
      StepMedia(step: step, visual: content.visual, asks: true, opens: true)
      LessonQuestionText(text: question)
    } else {
      // A read screen leads with its picture; a spread has it on the facing page.
      if !isPaneSplit {
        StepMedia(step: step, visual: content.visual, hero: true)
      }

      LessonTextBlocks(content.text ?? "")
        .font(.body)
    }
  }

  @ViewBuilder
  private var turn: some View {
    if content.asksGuess, let options = content.options {
      LessonOptionList(
        options: options.map { LessonOption(id: $0.id, text: $0.text, isCorrect: $0.isCorrect) },
        selectedId: context.answer.flatMap { if case .hookGuess(let id) = $0 { id } else { nil } },
        isChecked: context.result != nil,
        isLocked: context.isLocked || context.waitsForPicture,
        isGuess: true
      ) { context.select(.hookGuess(optionId: $0)) }
    } else if isPaneSplit {
      StepMedia(step: step, visual: content.visual, hero: true)
    }
  }
}

/// It leads with its picture, as main's read screens do; a spread has the picture on the facing page.
private struct ExplanationStepView: View {
  @Environment(\.activityRenderers) private var activityRenderers
  @Environment(\.isPaneSplit) private var isPaneSplit

  let step: LessonStep
  let content: ExplanationContent
  let part: LessonStepPart

  /// A labeled diagram's key means nothing without the picture it labels.
  private var isExploredPictureLost: Bool {
    content.explore?.template == "labeledDiagram" && step.image == nil && !step.imagePending
  }

  var body: some View {
    switch part {
    case .screen:
      if !isPaneSplit {
        StepMedia(step: step, visual: content.visual, hero: true)
      }

      if let title = content.title {
        LessonQuestionText(text: title)
      }

      LessonTextBlocks(content.text)
        .font(.body)
    case .turn:
      if isPaneSplit {
        StepMedia(step: step, visual: content.visual, hero: true)
      }

      if let explore = content.explore, !isExploredPictureLost,
        let renderer = activityRenderers.renderer(for: explore.template)
      {
        renderer.canvas(
          ActivityCanvasContext(
            template: explore.template, payload: explore.payload, check: nil, phase: .explore,
            answer: nil, setAnswer: { _ in }, baseMap: explore.baseMap))

        ActivityDataNote(data: explore.data)
      }
    }
  }
}

/// The problem with its picture or chart, then its steps. On a spread the steps unfold on the
/// learner's page, right above the button that shows the next one.
private struct WorkedExampleStepView: View {
  @Environment(\.isPaneSplit) private var isPaneSplit

  let step: LessonStep
  let content: WorkedExampleContent
  let shown: Int
  let part: LessonStepPart

  var body: some View {
    switch part {
    case .screen:
      problem

      if !isPaneSplit {
        solution
      }
    case .turn:
      if isPaneSplit {
        solution
      }
    }
  }

  @ViewBuilder
  private var problem: some View {
    Label {
      Text("Worked example", tableName: "Player", comment: "Label above a worked example")
    } icon: {
      Image(systemName: "list.number")
    }
    .chip()

    if let title = content.title {
      LessonQuestionText(text: title)
    }

    LessonTextBlocks(content.problem)
    StepMedia(step: step, visual: content.visual)
  }

  @ViewBuilder
  private var solution: some View {
    VStack(alignment: .leading, spacing: 12) {
      ForEach(Array(content.steps.prefix(shown).enumerated()), id: \.offset) { index, solved in
        HStack(alignment: .firstTextBaseline, spacing: 12) {
          Text(index + 1, format: .number)
            .font(.subheadline.monospacedDigit().weight(.semibold))
            .foregroundStyle(.secondary)
          VStack(alignment: .leading, spacing: 4) {
            LessonTextBlocks(solved.text)
            if let math = solved.math {
              Text(LessonMath.attributed(math))
            }
          }
        }
        .accessibilityElement(children: .combine)
      }
    }

    if shown >= content.steps.count {
      LessonTextBlocks(content.result)
        .font(.headline)
    }
  }
}

private struct CheckStepView: View {
  let step: LessonStep
  let content: CheckContent
  let context: LessonStepContext
  let part: LessonStepPart

  var body: some View {
    switch part {
    case .screen:
      if let context = content.context {
        LessonTextBlocks(context)
          .foregroundStyle(.secondary)
      }

      LessonQuestionText(text: content.question)
      StepMedia(step: step, visual: content.visual, asks: true)
    case .turn:
      LessonOptionList(
        options: content.options.map {
          LessonOption(
            id: $0.id, text: $0.text, isCorrect: $0.isCorrect, pictureAlt: $0.picture?.alt,
            picture: step.optionPictures[$0.id])
        },
        selectedId: context.answer.flatMap { if case .check(let id) = $0 { id } else { nil } },
        isChecked: context.result != nil,
        isLocked: context.isLocked || context.waitsForPicture,
        picturesPending: step.imagePending
      ) { context.select(.check(optionId: $0)) }
    }
  }
}

private struct TypedAnswerStepView: View {
  let content: TypedAnswerContent
  let context: LessonStepContext
  let part: LessonStepPart
  @FocusState private var isFocused: Bool

  var body: some View {
    switch part {
    case .screen:
      if let context = content.context {
        LessonTextBlocks(context)
          .foregroundStyle(.secondary)
      }

      if content.isOwnWords {
        Label {
          Text(
            "In your own words", tableName: "Player",
            comment: "Above a question answered in a few sentences")
        } icon: {
          Image(systemName: "pencil.line")
        }
        .chip()
      }

      LessonQuestionText(text: content.question)

      if let visual = content.visual {
        LessonVisualView(visual: visual)
      }
    case .turn:
      LessonAnswerField(
        label: Text(LessonRichText.attributed(content.question)),
        text: context.answer?.text ?? "",
        isLocked: context.isLocked,
        isNumber: content.isNumberAnswer,
        isFocused: $isFocused,
        check: context.check
      ) { context.select($0.isEmpty ? nil : .typedAnswer(text: $0)) }
      .onAppear { isFocused = !context.isLocked }
    }
  }
}

struct LessonAnswerField: View {
  let label: Text
  let text: String
  let isLocked: Bool
  var isNumber = false
  var isFocused: FocusState<Bool>.Binding
  let check: (@MainActor () -> Void)?
  let onChange: @MainActor (String) -> Void

  var body: some View {
    MultilineTextField(
      text: Binding(get: { text }, set: onChange),
      prompt: isNumber
        ? Text("Your answer", tableName: "Player", comment: "Placeholder of a number answer")
        : Text(
          "Write your answer", tableName: "Player", comment: "Placeholder of a written answer"),
      label: label
    ) {
      isFocused.wrappedValue = false
      check?()
    }
    .lineLimit(isNumber ? 1...1 : 3...8)
    .keyboardType(isNumber ? .numbersAndPunctuation : .default)
    .submitLabel(.done)
    .focused(isFocused)
    .disabled(isLocked)
    .padding()
    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 16))
  }
}

/// Mirrors main's `getAnswerMode`. Every spoken screen keeps a way to answer.
enum SpokenAnswerMode: Equatable {
  case speak
  case listen
  case type

  init(canListen: Bool, canSpeak: Bool, cantTalk: Bool, micBlocked: Bool) {
    if (cantTalk || !canSpeak) && canListen {
      self = .listen
    } else if cantTalk || micBlocked || !canSpeak {
      self = .type
    } else {
      self = .speak
    }
  }
}

extension LessonPlayerStore {
  func spokenAnswerMode(canListen: Bool, canSpeak: Bool) -> SpokenAnswerMode {
    SpokenAnswerMode(
      canListen: canListen, canSpeak: canSpeak, cantTalk: cantTalkToday, micBlocked: isMicBlocked)
  }
}

private struct SpokenAnswerStepView: View {
  @Environment(\.spokenAnswerRecording) private var recording
  @FocusState private var isFocused: Bool

  let step: LessonStep
  let content: SpokenAnswerContent
  let listening: LanguageExercise?
  let context: LessonStepContext
  let store: LessonPlayerStore
  let part: LessonStepPart

  /// "I can't talk now" holds for every spoken screen for the rest of the day, as on main.
  private var cantTalk: Bool {
    store.cantTalkToday
  }

  private var mode: SpokenAnswerMode {
    store.spokenAnswerMode(canListen: listening != nil, canSpeak: recording.input != nil)
  }

  var body: some View {
    if mode == .listen, let listening {
      LanguageStepView(exercise: listening, wordHints: nil, context: context, part: part)

      if part == .turn {
        modeSwitch
      }
    } else {
      switch part {
      case .screen: screen
      case .turn: turn
      }
    }
  }

  @ViewBuilder
  private var screen: some View {
    if mode == .speak {
      Text("Tap and say it out loud", tableName: "Player", comment: "Above a sentence to say")
        .font(.caption.monospaced())
        .foregroundStyle(.secondary)
    }

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
  }

  @ViewBuilder
  private var turn: some View {
    if mode == .speak, let input = recording.input {
      input(
        SpokenAnswerContext(
          lessonId: context.lessonId, studySessionId: context.studySessionId, stepId: step.id,
          content: content,
          isLocked: context.isLocked,
          onGraded: context.resolveSpoken,
          onBlocked: { store.isMicBlocked = true }))
    } else {
      if store.isMicBlocked, !context.isLocked {
        VStack(alignment: .leading, spacing: 4) {
          Text(
            "The microphone is blocked. Type your answer instead.", tableName: "Player",
            comment: "A spoken screen falls back to typing when the microphone is off"
          )
          .foregroundStyle(.secondary)

          if let settings = URL(string: UIApplication.openSettingsURLString) {
            Link(destination: settings) {
              Text(
                "Open Settings", tableName: "Player",
                comment: "Opens the app's settings to turn the microphone back on")
            }
          }
        }
        .font(.subheadline)
      }

      LessonAnswerField(
        label: Text(LessonRichText.attributed(content.prompt)), text: context.answer?.text ?? "",
        isLocked: context.isLocked, isFocused: $isFocused, check: context.check
      ) {
        context.select($0.isEmpty ? nil : .spokenAnswer(text: $0))
      }
    }

    modeSwitch
  }

  /// An answer started one way doesn't carry over, and asking to speak tries the microphone again.
  @ViewBuilder
  private var modeSwitch: some View {
    if !context.isLocked, recording.input != nil {
      Button {
        context.select(nil)
        store.cantTalkToday = mode == .speak
        store.isMicBlocked = false
      } label: {
        if mode == .speak {
          Label {
            Text(
              "I can't talk now", tableName: "Player",
              comment: "Answers a spoken screen by listening or typing instead")
          } icon: {
            Image(systemName: listening == nil ? "keyboard" : "headphones")
          }
        } else {
          Label {
            if cantTalk {
              Text(
                "I can talk now", tableName: "Player", comment: "Goes back to answering out loud")
            } else {
              Text("Say it instead", tableName: "Player", comment: "Tries the microphone again")
            }
          } icon: {
            Image(systemName: "mic")
          }
        }
      }
      .buttonStyle(.borderless)
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

extension HookContent {
  /// A hook that asks for a guess first, with its question and options.
  var asksGuess: Bool {
    variant == .guess && question != nil && options != nil
  }
}

extension LessonStep {
  /// Text that teaches, which the buddy can explain another way, as main's aside offers beside it.
  var teachesInText: Bool {
    switch content {
    case .explanation: true
    case .hook(let hook): !hook.asksGuess
    default: false
    }
  }
}

struct StepMedia: View {
  let step: LessonStep
  let visual: LessonVisual?
  var asks = false
  var hero = false
  var opens = false

  var body: some View {
    LessonPictureView(
      image: step.image, alt: step.picture?.alt, isPending: step.imagePending, asks: asks,
      hero: hero, opens: opens)

    if let visual {
      LessonVisualView(visual: visual)
    }
  }
}
