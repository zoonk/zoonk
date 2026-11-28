import SwiftUI

enum LessonStepPart {
  case screen
  case turn
}

struct LessonStepView: View {
  @Environment(\.activityRenderers) private var activityRenderers

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
    case .check, .typedAnswer, .spokenAnswer, .activity, .challenge, .language:
      LessonQuestionStepView(
        step: step, state: state, context: context, part: part,
        cantTalk: Binding(get: { store.cantTalkToday }, set: { store.cantTalkToday = $0 }),
        cantListen: Binding(get: { store.cantListenToday }, set: { store.cantListenToday = $0 }),
        microphoneProblem: Binding(
          get: { store.microphoneProblem }, set: { store.microphoneProblem = $0 }),
        team: store.challengeTeam, waitForRun: { await store.ensureRun() },
        studySessionId: { store.studySessionId })
      if part == .turn, step.kind == .check || step.kind == .typedAnswer {
        ExplainFirstButton(state: state, store: store)
      }
    case .summary(let content):
      if part == .screen { SummaryStepView(content: content) }
    }
  }

  private var context: LessonStepContext {
    LessonStepContext(
      lessonId: state.lessonId,
      answer: state.answers[step.id],
      result: state.results[step.id],
      isLocked: state.phase != .playing,
      waitsForPicture: step.isRequiredPictureDrawing(openedAt: store.openedAt),
      select: { store.select($0) },
      resolveSpoken: { store.resolveSpoken($0, stepId: step.id) },
      check: state.phase == .playing
        && step.canCheck(state.answers[step.id], openedAt: store.openedAt) ? check : nil,
      complete: { answer in
        store.select(answer)
        check()
      })
  }

  private func check() {
    let grade = activityRenderers.grade(for: step)
    Task { await store.check(gradeActivity: grade) }
  }
}

struct LessonQuestionStepView: View {
  let step: LessonStep
  let state: LessonPlayerState
  let context: LessonStepContext
  let part: LessonStepPart
  @Binding var cantTalk: Bool
  @Binding var cantListen: Bool
  @Binding var microphoneProblem: MicrophoneProblem?
  var team: [String] = []
  var waitForRun: @MainActor () async -> Bool = { true }
  var studySessionId: @MainActor () -> String? = { nil }
  var mistake: SpokenMistakeTarget? = nil
  var onPracticeGraded: (@MainActor (Components.Schemas.MistakePracticeFeedback) -> Void)? = nil
  var onCheckingChanged: (@MainActor (Bool) -> Void)? = nil

  var body: some View {
    switch step.content {
    case .check(let content):
      CheckStepView(step: step, content: content, context: context, part: part)
    case .typedAnswer(let content):
      TypedAnswerStepView(content: content, context: context, part: part)
    case .spokenAnswer(let content, let listening):
      SpokenAnswerStepView(
        step: step, content: content, listening: listening, context: context,
        cantTalk: $cantTalk, cantListen: $cantListen, microphoneProblem: $microphoneProblem,
        waitForRun: waitForRun, studySessionId: studySessionId, part: part, mistake: mistake,
        onPracticeGraded: onPracticeGraded, onCheckingChanged: onCheckingChanged)
    case .activity(let content):
      ActivityStepView(step: step, content: content, context: context, part: part)
    case .language(let exercise, let hints):
      LanguageStepView(
        exercise: exercise, wordHints: hints, context: context, part: part,
        cantListen: $cantListen)
    case .challenge(let content):
      ChallengeStepView(
        step: step, content: content, state: state, select: context.select, team: team, part: part)
    default: EmptyView()
    }
  }
}

struct LessonStepContext {
  let lessonId: String
  let answer: LessonAnswer?
  let result: LessonStepResult?
  let isLocked: Bool
  /// Picks wait while the numbered picture the question is about is still being drawn, as on main.
  let waitsForPicture: Bool
  let select: @MainActor (LessonAnswer?) -> Void
  let resolveSpoken: @MainActor (SpokenAnswerVerdict) -> Void
  /// The main button's check, or nil while that button is disabled.
  let check: (@MainActor () -> Void)?
  /// Selects a finished answer and checks it once, as a match board does on its last pair. A
  /// failed check waits for the learner's Retry.
  let complete: @MainActor (LessonAnswer) -> Void
}

private struct HookStepView: View {
  @Environment(\.isPaneSplit) private var isPaneSplit
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

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
      Chip(
        Text(
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
        // A large screen centers it in the room under the scene; a phone keeps it under the text.
        LessonOpeningMap(summary: openingMap)
          .frame(maxHeight: horizontalSizeClass == .regular ? .infinity : nil)
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
            answer: nil, setAnswer: { _ in }, complete: { _ in }, baseMap: explore.baseMap))

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
    Chip(
      Text("Worked example", tableName: "Player", comment: "Label above a worked example"),
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

  /// The step "Next step" just added; the first one is there as the screen opens.
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
        LessonContextText(context)
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
        LessonContextText(context)
      }

      if content.isOwnWords {
        Chip(
          Text(
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

  private static let answerLimit = 1000

  private var prompt: Text {
    isNumber
      ? Text("Your answer", tableName: "Player", comment: "Placeholder of a number answer")
      : Text("Write your answer", tableName: "Player", comment: "Placeholder of a written answer")
  }

  var body: some View {
    field
      .submitLabel(.done)
      .focused(isFocused)
      .disabled(isLocked)
      .typeStyle(isNumber ? .reading.monospacedDigit() : .reading)
      .fieldBorder(isFocused: isFocused.wrappedValue, minHeight: isNumber ? 48 : 40)
      // The lesson scrolls to the field's layout bounds, which omit its outer focus ring.
      .padding(.bottom, 4)
  }

  @ViewBuilder
  private var field: some View {
    let answer = Binding(get: { text }, set: onChange)

    if isNumber {
      FittedTextInput(text: answer, limit: Self.answerLimit) { text, selection in
        TextField(text: text, selection: selection, prompt: prompt.fieldPrompt()) {
          label ?? prompt
        }
        .keyboardType(.numbersAndPunctuation)
        .onSubmit(submit)
      }
    } else {
      MultilineTextField(
        text: answer, limit: Self.answerLimit, prompt: prompt, label: label ?? prompt,
        onSubmit: submit
      )
      .lineLimit(4...8)
    }
  }

  private func submit() {
    isFocused.wrappedValue = false
    check?()
  }
}

/// Mirrors main's `getAnswerMode`. Every spoken screen keeps a way to answer.
enum SpokenAnswerMode: Equatable {
  case speak
  case listen
  case type

  init(
    canListen: Bool, canSpeak: Bool, cantTalk: Bool, cantListen: Bool,
    microphoneProblem: MicrophoneProblem?,
    lockedAnswer: LessonAnswer? = nil, heard: SpokenHeard? = nil
  ) {
    if heard != nil {
      self = .speak
    } else if case .spokenAnswer = lockedAnswer {
      self = .type
    } else if canListen, case .listening = lockedAnswer {
      self = .listen
    } else if (cantTalk || !canSpeak) && canListen && !cantListen {
      self = .listen
    } else if cantTalk || microphoneProblem != nil || !canSpeak {
      self = .type
    } else {
      self = .speak
    }
  }
}

extension LessonStep {
  func spokenAnswerMode(
    canSpeak: Bool, cantTalk: Bool, cantListen: Bool, microphoneProblem: MicrophoneProblem?,
    lockedAnswer: LessonAnswer?, heard: SpokenHeard?
  ) -> SpokenAnswerMode? {
    guard case .spokenAnswer(_, let listening) = content else { return nil }

    return SpokenAnswerMode(
      canListen: listening != nil, canSpeak: canSpeak, cantTalk: cantTalk, cantListen: cantListen,
      microphoneProblem: microphoneProblem, lockedAnswer: lockedAnswer, heard: heard)
  }

  /// The prompt this screen plays. Main's `ListeningInstead`: a spoken screen answered by listening
  /// is a listening screen.
  func shownPromptAudio(spokenMode: SpokenAnswerMode?, cantListen: Bool) -> URL? {
    switch content {
    case .spokenAnswer(_, let listening?):
      spokenMode == .listen ? listening.promptAudio(cantListen: cantListen) : nil
    case .language(let exercise, _):
      exercise.promptAudio(cantListen: cantListen)
    default:
      nil
    }
  }
}

private struct SpokenAnswerStepView: View {
  @Environment(\.spokenAnswerRecording) private var recording
  @Environment(RecordInBar.self) private var recordInBar: RecordInBar?
  @FocusState private var isFocused: Bool

  let step: LessonStep
  let content: SpokenAnswerContent
  let listening: LanguageExercise?
  let context: LessonStepContext
  @Binding var cantTalk: Bool
  @Binding var cantListen: Bool
  @Binding var microphoneProblem: MicrophoneProblem?
  let waitForRun: @MainActor () async -> Bool
  let studySessionId: @MainActor () -> String?
  let part: LessonStepPart
  var mistake: SpokenMistakeTarget? = nil
  var onPracticeGraded: (@MainActor (Components.Schemas.MistakePracticeFeedback) -> Void)? = nil
  var onCheckingChanged: (@MainActor (Bool) -> Void)? = nil

  private var mode: SpokenAnswerMode {
    SpokenAnswerMode(
      canListen: listening != nil, canSpeak: recording.input != nil, cantTalk: cantTalk,
      cantListen: cantListen, microphoneProblem: microphoneProblem,
      lockedAnswer: context.isLocked ? context.answer : nil, heard: context.result?.heard)
  }

  var body: some View {
    if mode == .listen, let listening {
      ArrangeWordsView(
        exercise: listening, context: context, part: part, cantListen: typingWhenCantListen
      ) {
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
    ClosingColumn(spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        Text(content.targetText)
          .typeStyle(.section.weight(.medium))
          .accessibilityAddTraits(.isHeader)
        if let romanization = content.romanization {
          Text(romanization).foregroundStyle(.mutedForeground)
        }
        if let translation = content.translation {
          Text(translation).foregroundStyle(.mutedForeground)
        }
      }
      if mode == .speak {
        if !context.isLocked {
          RecordCue(
            recorder: recordInBar?.recorder, isChecking: recordInBar?.isChecking == true)
        }
        modeSwitch
      }
    }
  }

  @ViewBuilder
  private var turn: some View {
    if mode == .speak, let input = recording.input {
      input(
        SpokenAnswerContext(
          lessonId: context.lessonId, stepId: step.id, content: content,
          isLocked: context.isLocked,
          waitForRun: waitForRun,
          studySessionId: studySessionId,
          onGraded: context.resolveSpoken,
          onMicrophoneProblem: { problem in
            microphoneProblem = problem
            announcePolitely(Self.microphoneProblemLine(problem))
          }, mistake: mistake, onPracticeGraded: onPracticeGraded,
          onCheckingChanged: onCheckingChanged))
    } else {
      if let microphoneProblem, !context.isLocked {
        VStack(alignment: .leading, spacing: 4) {
          Text(Self.microphoneProblemLine(microphoneProblem))
            .foregroundStyle(.mutedForeground)

          if microphoneProblem == .denied,
            let settings = URL(string: UIApplication.openSettingsURLString)
          {
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

      modeSwitch
    }
  }

  /// Not listening leaves this screen to be typed, and an answer started one way doesn't carry over.
  private var typingWhenCantListen: Binding<Bool> {
    Binding {
      cantListen
    } set: {
      context.select(nil)
      cantListen = $0
    }
  }

  private static func microphoneProblemLine(_ problem: MicrophoneProblem) -> String {
    switch problem {
    case .denied:
      String(localized: "The microphone is blocked.", table: "Player")
    case .unavailable:
      String(localized: "We can't use your microphone, so type what you'd say.", table: "Player")
    }
  }

  private var modeSwitchLabel: String {
    guard mode == .speak else {
      return cantTalk
        ? String(
          localized: "I can talk now", table: "Player", comment: "Goes back to answering out loud")
        : String(
          localized: "Say it instead", table: "Player", comment: "Tries the microphone again")
    }
    let label = String(localized: "I can't talk now", table: "Player")
    let alternative =
      listening != nil
      ? String(localized: "Listen", table: "Player")
      : String(
        localized: "Type instead", table: "Player",
        comment:
          "On a question answered aloud: the learner types this one answer instead of saying it.")
    return "\(label). \(alternative)"
  }

  /// An answer started one way doesn't carry over, and asking to speak tries the microphone again.
  @ViewBuilder
  private var modeSwitch: some View {
    if !context.isLocked, recording.input != nil {
      Button {
        context.select(nil)
        cantTalk = mode == .speak
        microphoneProblem = nil
      } label: {
        if mode == .speak {
          Label {
            Text(
              "I can't talk now", tableName: "Player",
              comment: "Answers a spoken screen by listening or typing instead")
          } icon: {
            Image(systemName: "mic.slash")
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
      .accessibilityLabel(modeSwitchLabel)
      .buttonStyle(.outline)
      .controlSize(.large)
    }
  }
}

/// A leading column whose views that draw nothing take no room and no spacing, as main's
/// `empty:hidden` does.
struct ClosingColumn: Layout {
  let spacing: CGFloat

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let sizes = subviews.map {
      $0.sizeThatFits(ProposedViewSize(width: proposal.width, height: nil))
    }
    let shown = sizes.filter { $0.height > 0 }

    return CGSize(
      width: proposal.width ?? shown.map(\.width).max() ?? 0,
      height: shown.map(\.height).reduce(0, +) + spacing * CGFloat(max(shown.count - 1, 0)))
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    var y = bounds.minY

    for subview in subviews {
      let size = subview.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
      subview.place(
        at: CGPoint(x: bounds.minX, y: y),
        proposal: ProposedViewSize(width: bounds.width, height: size.height))

      if size.height > 0 {
        y += size.height + spacing
      }
    }
  }
}

private struct SummaryStepView: View {
  let content: SummaryContent

  var body: some View {
    Text("Summary", tableName: "Player", comment: "Title of a lesson's summary screen")
      .typeStyle(.pageTitle)
      .accessibilityAddTraits(.isHeader)

    LessonSummaryIdeas(ideas: content.ideas.map(\.text))
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
