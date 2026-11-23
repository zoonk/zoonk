import SwiftUI

/// "I don't know yet" is welcome and there's no score. It ends when every area has a starting point,
/// when nothing more can be asked today, or whenever the learner stops, and goes straight on.
struct PlacementStep: View {
  let view: GoalOnboarding
  let subject: String
  let onDone: (String?) async throws -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @Environment(PlanStore.self) private var plans
  @State private var topics: GoalPlacement?
  @State private var opening: Resource<GoalPlacement>?
  /// Where the learner's taps and the wait took the step; until then it shows the opening read.
  @State private var reached: Phase?
  @State private var shownAt = ContinuousClock.now
  @State private var isSaving = false
  @State private var isStarting = false
  @State private var questionFailures = 0
  @State private var finishFailed = false
  @State private var showsSaveReport = false
  @State private var failedAnswer: SentAnswer?
  @State private var waitRound = 0
  /// The goal's run while its questions are written, as the wait shows it.
  @State private var run = GenerationWait(kind: .placement).started
  /// Neither a question's number nor the bar ever goes back while the plan is still being written.
  @State private var shown = (answered: 0, spent: 0.0)
  /// The answers and the finish: a step left during one does nothing when it answers.
  @State private var tasks = ScreenTasks()

  enum Phase: Equatable {
    case loading
    case intro
    case waiting(failure: GenerationFailure?)
    case question(PracticeQuestion, labels: PracticeTrueFalseLabels)
    /// Over and not saved yet: the learner came back to it, or its last save failed.
    case done
    case unavailable

    var isWaiting: Bool {
      if case .waiting = self {
        return true
      }

      return false
    }

    init(_ placement: GoalPlacement) {
      switch placement.status {
      case .asking:
        guard let next = placement.next,
          let question = try? PracticeJSON.recode(next, as: PracticeQuestion.self)
        else {
          self = .unavailable
          return
        }

        self = .question(
          question, labels: placement.trueFalseLabels == .rightWrong ? .rightWrong : .trueFalse)
      case .done:
        self = .done
      case .unavailable, .failed:
        self = .unavailable
      case .preparing, .waitingForQuestions:
        self = .waiting(failure: nil)
      }
    }

    init(started placement: GoalPlacement?) {
      self = placement.map(Phase.init) ?? .waiting(failure: .notStarted)
    }
  }

  var body: some View {
    Group {
      if let placement = topics ?? opening?.value, placement.resumesOnboardingTopics {
        PlacementTestFlow(
          goalID: view.goal.id, subject: subject,
          wholeCourseMinutes: wholeCourseMinutes, nextTopic: { nil },
          initialPlacement: placement, onOnboardingDone: { try await onDone($0) }
        ) {
          try await onDone(nil)
        }
      } else if let opening {
        steps(opening)
          .loads(opening, refreshable: false)
      } else {
        StepLoading()
      }
    }
    .onAppear {
      if opening == nil {
        opening = onboarding.openingPlacement(goalID: view.goal.id)
      }
    }
    .loads(plan, refreshable: false)
    .onDisappear { tasks.cancel() }
    .feedbackSheet(
      isPresented: $showsSaveReport,
      context: FeedbackContext(screen: "placement-question", reportType: .saveFailure),
      isReport: true)
  }

  private var plan: Resource<PlanRead> { plans.plan(goalId: view.goal.id) }

  private var wholeCourseMinutes: Int { plan.value?.plan.placementTest?.estimatedMinutes ?? 0 }

  private var phase: Phase {
    reached ?? opening?.value.map { $0.started ? Phase($0) : .intro } ?? .loading
  }

  private var progress: (answered: Int, spent: Double) {
    let opened = opening?.value
    return (
      max(shown.answered, opened?.answered ?? 0), max(shown.spent, opened?.dayBudgetSpent ?? 0)
    )
  }

  /// Questions that couldn't be written show at once, as on main: there's nothing to be ready for.
  @ViewBuilder
  private func steps(_ opening: Resource<GoalPlacement>) -> some View {
    if reached == nil, case .failed(let error) = opening.state {
      PracticeLoadFailureView(error: error) { Task { await opening.refresh() } }
    } else if phase == .unavailable {
      ready
    } else {
      WaitHold(
        surface: .placementWait, isReady: !phase.isWaiting,
        announcement: PlacementWaitScreen.questionsReady
      ) { stage in
        switch stage {
        case .waiting(let holding): waiting(holding: holding)
        case .ready: ready
        }
      }
    }
  }

  @ViewBuilder
  private var ready: some View {
    switch phase {
    case .loading:
      StepLoading()
    case .intro:
      intro
    case .waiting:
      EmptyView()
    case .question(let question, let labels):
      PlacementQuestionScreen(
        subject: subject, number: progress.answered + 1, progress: progress.spent,
        question: question,
        labels: labels, isSaving: isSaving, failures: questionFailures,
        saveFailure: finishFailed ? testSaveFailure : nil,
        onReport: { showsSaveReport = true },
        onAnswer: { submit($0, to: question) }, onStop: { finish(fromScratch: false) }
      )
      .id(question.itemId)
      // A question held behind the warm-up's wait is timed from when it shows.
      .onAppear { shownAt = .now }
    case .done:
      TestOutcome(
        title: Text(
          "Your answers are saved", tableName: "Onboarding",
          comment: "Title once the short test is over and its answers wait to be saved"),
        isSaving: isSaving, failed: finishFailed
      ) {
        finish(fromScratch: false)
      }
    case .unavailable:
      PlacementUnavailable(isSaving: isSaving, failed: finishFailed) {
        finish(fromScratch: false)
      }
    }
  }

  private var intro: some View {
    PlacementLengthChoice(
      wholeCourseMinutes: wholeCourseMinutes, isSaving: isStarting || isSaving,
      failed: finishFailed, onSkip: { finish(fromScratch: true) },
      onStart: { choice in
        guard !isStarting, !isSaving, case .length(let length) = choice else { return }

        if length == .quick {
          tasks.run { await start() }
        } else {
          isStarting = true
          finishFailed = false

          tasks.run {
            defer { isStarting = false }

            do {
              let placement = try await onboarding.startPlacementTest(
                goalID: view.goal.id, length: length)
              guard placement.resumesOnboardingTopics else { throw APIError.unavailable }
              topics = placement
            } catch is CancellationError {
            } catch {
              finishFailed = true
            }
          }
        }
      })
  }

  private func waiting(holding: WaitHolding?) -> some View {
    let failure: GenerationFailure? = if case .waiting(let failure) = phase { failure } else { nil }

    return PlacementWaitScreen(
      onboarding: view, goalID: view.goal.id, run: run, failure: failure, holding: holding,
      isActing: isStarting,
      skip: .init(
        label: Text(
          "Skip", tableName: "Onboarding",
          comment: "Skips placement while its questions are written"),
        note: nil,
        isBusy: isSaving, failed: finishFailed
      ) {
        finish(fromScratch: false)
      },
      onRetry: retry
    )
    .taskThroughPush(id: waitRound) { await waitForQuestions() }
  }

  /// Start reads first, so questions that already exist never flash the wait.
  private func start() async {
    guard !isSaving, !isStarting else {
      return
    }

    isStarting = true
    defer { isStarting = false }

    let placement = try? await onboarding.placement(goalID: view.goal.id)
    show(Phase(started: placement), from: placement)
    waitRound += 1
  }

  private func retry(_ failure: GenerationFailure) {
    guard failure == .connection else {
      Task { await start() }
      return
    }

    reached = .waiting(failure: nil)
    waitRound += 1
  }

  private func read() async {
    guard let placement = try? await onboarding.placement(goalID: view.goal.id) else {
      return
    }

    show(placement)
  }

  private func waitForQuestions() async {
    guard case .waiting(failure: nil) = phase else {
      return
    }

    let followed = await PlacementWaitScreen.follow(
      generationID: view.generationId, store: onboarding, apply: { run.apply($0) },
      isWaiting: {
        guard case .waiting = phase else {
          return false
        }

        await read()
        return phase.isWaiting
      })

    if !followed, case .waiting = phase {
      reached = .waiting(failure: .connection)
    }
  }

  private func show(_ placement: GoalPlacement) {
    show(Phase(placement), from: placement)
  }

  private func show(_ next: Phase, from placement: GoalPlacement?) {
    if let placement {
      shown = (max(shown.answered, placement.answered), max(shown.spent, placement.dayBudgetSpent))
    }

    reached = next
  }

  private func submit(_ answer: PracticeAnswer, to question: PracticeQuestion) {
    guard !isSaving else {
      return
    }

    isSaving = true
    finishFailed = false
    let sent = SentAnswer(
      answer: answer, sender: answer.isDontKnow ? .notSure : .check,
      measuredMs: Int(shownAt.duration(to: .now).components.seconds * 1000), failed: failedAnswer)

    tasks.run {
      defer { isSaving = false }

      do {
        let result = try await onboarding.answerPlacement(
          goalID: view.goal.id, itemID: question.itemId, answer: answer,
          duration: .milliseconds(sent.durationMs))
        questionFailures = 0
        failedAnswer = nil
        shown.answered += 1
        let next = Phase(result.placement)

        guard next == .done else {
          show(next, from: result.placement)
          return
        }

        // The last answer goes straight on; only a finish that didn't save stops on a screen.
        do {
          try await finishAndGoOn(fromScratch: false)
        } catch is CancellationError {
        } catch {
          finishFailed = true
          reached = .done
        }
      } catch is CancellationError {
      } catch {
        failedAnswer = sent
        questionFailures += 1
      }
    }
  }

  private func finish(fromScratch: Bool) {
    guard !isSaving else {
      return
    }

    let fromQuestion = if case .question = phase { true } else { false }
    isSaving = true
    finishFailed = false

    tasks.run {
      defer { isSaving = false }

      do {
        try await finishAndGoOn(fromScratch: fromScratch)
        if fromQuestion {
          questionFailures = 0
        }
      } catch is CancellationError {
      } catch {
        if fromQuestion {
          questionFailures += 1
        } else {
          finishFailed = true
        }
      }
    }
  }

  /// Finishing is one save to the learner: it goes through once the step's save does too.
  private func finishAndGoOn(fromScratch: Bool) async throws {
    try await onboarding.finishPlacement(goalID: view.goal.id, fromScratch: fromScratch)
    try await goOnUnlessLeft { try await onDone(nil) }
  }
}

/// Main's `TestOutcome`: the end of a test, what it found and the way on. A save that failed is said
/// over the bar, and Continue tries again.
struct TestOutcome<Lead: View>: View {
  var subject: String?
  let title: Text
  var description: Text?
  var continueLabel: Text?
  var undo: PlacementResultUndo?
  var failureMessage: LocalizedStringResource?
  let isSaving: Bool
  let failed: Bool
  let onContinue: () -> Void
  @ViewBuilder var lead: () -> Lead

  var body: some View {
    ZoonkList {
      StepHeader(subject: subject, title: title, description: description)

      lead()
    }
    .bottomBar(
      note: undo?.failure
        ?? (failed && !isSaving ? BarNote(failureMessage ?? testSaveFailure) : nil)
    ) {
      undo?.button
      StepButtons(continueLabel: continueLabel, onContinue: onContinue)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, isSaving)
  }
}

extension TestOutcome where Lead == EmptyView {
  init(
    subject: String? = nil, title: Text, description: Text? = nil, continueLabel: Text? = nil,
    undo: PlacementResultUndo? = nil, failureMessage: LocalizedStringResource? = nil,
    isSaving: Bool, failed: Bool, onContinue: @escaping () -> Void
  ) {
    self.init(
      subject: subject, title: title, description: description, continueLabel: continueLabel,
      undo: undo, failureMessage: failureMessage, isSaving: isSaving, failed: failed,
      onContinue: onContinue, lead: { EmptyView() })
  }
}

/// No test could be made for the goal, which is fine: the first days show what the learner knows.
/// The short test's and the Focus test's.
struct PlacementUnavailable: View {
  let isSaving: Bool
  let failed: Bool
  let onContinue: () -> Void

  var body: some View {
    TestOutcome(
      title: Text(
        "We'll see what you know in your first few days", tableName: "Onboarding",
        comment: "Title when no test could be made for a goal; nothing is wrong"),
      isSaving: isSaving, failed: failed, onContinue: onContinue)
  }
}

private let testSaveFailure = LocalizedStringResource(
  "That didn't save. Try again.", table: "Onboarding", comment: "A change couldn't be saved")

/// A new question gets a fresh view (`.id`), so nothing picked carries over.
struct PlacementQuestionScreen<Media: View>: View {
  var subject: String?
  let number: Int
  /// The count promised up front, when the test has one.
  var total: Int?
  /// Where the question sits, in place of its number, such as a whole-course test's part.
  var position: Text?
  /// From 0 to 1.
  let progress: Double
  let question: PracticeQuestion
  var askedIn: String?
  var labels = PracticeTrueFalseLabels.trueFalse
  var dontKnowLabel = LocalizedStringResource(
    "I don't know yet", table: "Onboarding",
    comment: "Answers a placement question without guessing")
  let isSaving: Bool
  let failures: Int
  var saveFailure: LocalizedStringResource?
  /// Said right above Stop, when stopping is worth suggesting.
  var stopHint: LocalizedStringResource?
  let onReport: () -> Void
  let onAnswer: (PracticeAnswer) -> Void
  let onStop: () -> Void
  @ViewBuilder var media: () -> Media

  @State private var draft: PracticeAnswer?
  @State private var submission: Submission?

  private enum Submission { case confirm, dontKnow, stop }

  var body: some View {
    PracticeTaskLayout {
      if let subject {
        ChipRow(chip: Chip(Text(verbatim: subject)), position: shownPosition)
      }

      media()

      asked.stimulus
    } response: {
      asked.response

      if let saveFailure, !isSaving {
        FailureLine(message: saveFailure)
      }

      if failures > 0, !isSaving {
        SaveFailureNotice(failures: failures, onReport: onReport)
      }

      if number > 1 {
        if let stopHint {
          Text(stopHint)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }

        BusyButton(isBusy: isSaving && submission == .stop) {
          submission = .stop
          onStop()
        } label: {
          Text(
            "Stop and use my answers", tableName: "Onboarding",
            comment: "Ends a test early; the answers given so far count at once"
          )
          .underline()
        }
        .buttonStyle(.borderless)
        .disabled(isSaving && submission != .stop)
      }
    } actions: {
      let answer = question.answerToSubmit(draft)
      PracticeActionRow {
        PracticeSecondaryButton(
          title: dontKnowLabel, icon: .notSure, isBusy: isSaving && submission == .dontKnow,
          isDisabled: isSaving
        ) {
          submission = .dontKnow
          onAnswer(.dontKnow)
        }

        PracticeMainButton(
          title: LocalizedStringResource(
            "Confirm", table: "Onboarding", comment: "Sends a placement answer"),
          isBusy: isSaving && submission == .confirm,
          isDisabled: isSaving || answer == nil
        ) {
          if let answer {
            submission = .confirm
            onAnswer(answer)
          }
        }
      }
    }
    .preference(key: TestQuestionProgressKey.self, value: progress)
  }

  private var shownPosition: Text {
    if let position {
      position
    } else if let total {
      Text(
        "Question \(number) of \(total)", tableName: "Onboarding",
        comment: "Which question of a test with a promised count this is")
    } else {
      Text(
        "Question \(number)", tableName: "Onboarding",
        comment: "Which placement question this is")
    }
  }

  private var asked: PracticeQuestionView {
    PracticeQuestionView(
      question: question, labels: labels, isLocked: isSaving, askedIn: askedIn, draft: $draft
    ) {
      answer in
      guard !isSaving else { return }
      submission = .confirm
      onAnswer(answer)
    }
  }
}

extension PlacementQuestionScreen where Media == EmptyView {
  init(
    subject: String?,
    number: Int,
    total: Int? = nil,
    position: Text? = nil,
    progress: Double,
    question: PracticeQuestion,
    askedIn: String? = nil,
    labels: PracticeTrueFalseLabels,
    isSaving: Bool,
    failures: Int,
    saveFailure: LocalizedStringResource? = nil,
    stopHint: LocalizedStringResource? = nil,
    onReport: @escaping () -> Void,
    onAnswer: @escaping (PracticeAnswer) -> Void,
    onStop: @escaping () -> Void
  ) {
    self.init(
      subject: subject, number: number, total: total, position: position, progress: progress,
      question: question, askedIn: askedIn, labels: labels, isSaving: isSaving, failures: failures,
      saveFailure: saveFailure,
      stopHint: stopHint, onReport: onReport, onAnswer: onAnswer, onStop: onStop,
      media: { EmptyView() }
    )
  }
}
