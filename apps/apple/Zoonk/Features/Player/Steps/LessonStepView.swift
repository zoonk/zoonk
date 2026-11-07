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
      .environment(
        \.highlightsLessonTerms, step.isExplaining && store.lesson?.targetLanguage == nil)
  }

  @ViewBuilder
  private var content: some View {
    switch step.content {
    case .hook(let content):
      HookStepView(
        step: step, content: content, context: context, part: part,
        openingMap: store.lesson?.taggedSummary)
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
  let openingMap: LessonSummary?
  /// A map that comes while the scene is read shows from the next visit, so the scene doesn't move.
  @State private var showsOpeningMap: Bool

  init(
    step: LessonStep, content: HookContent, context: LessonStepContext, part: LessonStepPart,
    openingMap: LessonSummary?
  ) {
    self.step = step
    self.content = content
    self.context = context
    self.part = part
    self.openingMap = openingMap
    _showsOpeningMap = State(initialValue: openingMap != nil)
  }

  var body: some View {
    switch part {
    case .screen: screen
    case .turn: turn
    }
  }

  @ViewBuilder
  private var screen: some View {
    if content.asksGuess, let question = content.question {
      LessonEyebrow(
        title: Text(
          "Just a guess, it doesn't count", tableName: "Player",
          comment:
            "Chip above the lesson's guess, which the learner answers after the opening scene and the first explanation. Guesses are never scored."
        ),
        systemImage: "sparkles")
      StepMedia(step: step, visual: content.visual, asks: true, opens: true)
      LessonQuestionText(text: question)
    } else {
      // A read screen leads with its picture; a spread has it on the facing page.
      if !isPaneSplit {
        StepMedia(step: step, visual: content.visual, hero: true)
      }

      LessonTextBlocks(content.text ?? "")
        .typeStyle(.lessonText)

      if showsOpeningMap, let openingMap {
        LessonOpeningMap(summary: openingMap)
      }
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

      LessonScreenText(
        title: content.title, titleIsHeading: true, text: content.text, marks: step.marks
      )
      .typeStyle(.lessonText)
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
  @Environment(\.legibilityWeight) private var legibilityWeight

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
    LessonEyebrow(
      title: Text("Worked example", tableName: "Player", comment: "Label above a worked example"),
      systemImage: "list.number")

    LessonScreenText(title: content.title, text: content.problem, marks: step.marks)
    StepMedia(step: step, visual: content.visual)
  }

  @ViewBuilder
  private var solution: some View {
    VStack(alignment: .leading, spacing: 12) {
      ForEach(Array(content.steps.prefix(shown).enumerated()), id: \.offset) { index, solved in
        HStack(alignment: .firstTextBaseline, spacing: 12) {
          Text(index + 1, format: .number)
            .typeStyle(.note.weight(.semibold).monospaced())
            .foregroundStyle(.mutedForeground)
          VStack(alignment: .leading, spacing: 4) {
            LessonTextBlocks(solved.text)
            if let math = solved.math {
              Text(LessonMath.typeset(math), legibility: legibilityWeight)
            }
          }
        }
        .accessibilityElement(children: .combine)
      }
    }
    .announcesStatus(newestStep)

    if shown >= content.steps.count {
      LessonTextBlocks(content.result)
        .typeStyle(.body.weight(.semibold))
    }
  }

  /// The step "Show the next step" just added; the first one is there as the screen opens.
  private var newestStep: String? {
    guard shown > 1, content.steps.indices.contains(shown - 1) else {
      return nil
    }

    let step = content.steps[shown - 1]
    return [LessonRichText.spoken(step.text), step.math.map { LessonMath.typeset($0).said }]
      .compactMap(\.self).joinedSentences()
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
      StepMedia(step: step, visual: nil, asks: true)

      if let context = content.context {
        LessonTextBlocks(context)
          .foregroundStyle(.mutedForeground)
      }

      if let visual = content.visual {
        LessonVisualView(visual: visual)
      }

      LessonQuestionText(text: content.question)
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
          .foregroundStyle(.mutedForeground)
      }

      if content.isOwnWords {
        LessonEyebrow(
          title: Text(
            "In your own words", tableName: "Player",
            comment: "Above a question answered in a few sentences"),
          systemImage: "pencil.line")
      }

      LessonQuestionText(text: content.question)

      if let visual = content.visual {
        LessonVisualView(visual: visual)
      }
    case .turn:
      let question = LessonQuestionParts(content.question).question

      LessonAnswerField(
        label: question.isEmpty ? nil : Text(verbatim: LessonRichText.spoken(question)),
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
  /// Without one, VoiceOver reads the placeholder, as a browser names main's field.
  let label: Text?
  let text: String
  let isLocked: Bool
  var isNumber = false
  var isFocused: FocusState<Bool>.Binding
  let check: (@MainActor () -> Void)?
  let onChange: @MainActor (String) -> Void

  private var prompt: Text {
    isNumber
      ? Text("Your answer", tableName: "Player", comment: "Placeholder of a number answer")
      : Text("Write your answer", tableName: "Player", comment: "Placeholder of a written answer")
  }

  var body: some View {
    MultilineTextField(
      text: Binding(get: { text }, set: onChange), prompt: prompt, label: label ?? prompt
    ) {
      isFocused.wrappedValue = false
      check?()
    }
    .lineLimit(isNumber ? 1...1 : 4...8)
    .keyboardType(isNumber ? .numbersAndPunctuation : .default)
    .submitLabel(.done)
    .focused(isFocused)
    .disabled(isLocked)
    .typeStyle(isNumber ? .reading.monospacedDigit() : .reading)
    .fieldBorder(isFocused: isFocused.wrappedValue, minHeight: isNumber ? 48 : 40)
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
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
    }

    LessonQuestionText(text: content.prompt)
    VStack(alignment: .leading, spacing: 4) {
      Text(content.targetText)
        .typeStyle(.section.weight(.medium))
      if let romanization = content.romanization {
        Text(romanization).foregroundStyle(.mutedForeground)
      }
      if let translation = content.translation {
        Text(translation).foregroundStyle(.mutedForeground)
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
          onBlocked: {
            store.isMicBlocked = true
            announcePolitely(Self.micBlockedLine)
          }))
    } else {
      if store.isMicBlocked, !context.isLocked {
        VStack(alignment: .leading, spacing: 4) {
          Text(Self.micBlockedLine)
            .foregroundStyle(.mutedForeground)

          if let settings = URL(string: UIApplication.openSettingsURLString) {
            Link(destination: settings) {
              Text(
                "Open Settings", tableName: "Player",
                comment: "Opens the app's settings to turn the microphone back on")
            }
          }
        }
        .typeStyle(.body)
      }

      LessonAnswerField(
        label: Text(verbatim: LessonRichText.spoken(content.prompt)),
        text: context.answer?.text ?? "",
        isLocked: context.isLocked, isFocused: $isFocused, check: context.check
      ) {
        context.select($0.isEmpty ? nil : .spokenAnswer(text: $0))
      }
    }

    modeSwitch
  }

  private static var micBlockedLine: String {
    String(
      localized: "The microphone is blocked. Type your answer instead.", table: "Player",
      comment: "A spoken screen falls back to typing when the microphone is off")
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
      .typeStyle(.pageTitle)
      .accessibilityAddTraits(.isHeader)

    VStack(alignment: .leading, spacing: 12) {
      ForEach(Array(content.ideas.enumerated()), id: \.offset) { _, idea in
        Label {
          LessonRichText(idea.text)
        } icon: {
          Image(systemName: "lightbulb")
            .foregroundStyle(.mutedForeground)
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
  var opensLesson: Bool {
    if case .hook(let hook) = content { !hook.asksGuess } else { false }
  }

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
