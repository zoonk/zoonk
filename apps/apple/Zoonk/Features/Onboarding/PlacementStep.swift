import SwiftUI

/// "I don't know yet" is welcome and there's no score. It ends when every area has a starting point,
/// when nothing more can be asked today, or whenever the learner stops.
struct PlacementStep: View {
  let view: GoalOnboarding
  let subject: String
  let onDone: () async throws -> Void

  @Environment(OnboardingStore.self) private var onboarding
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

  enum Phase: Equatable {
    case loading
    case intro
    case waiting(failure: GenerationFailure?)
    case question(PracticeQuestion, labels: PracticeTrueFalseLabels)
    case done(forToday: Bool)
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
        self = .done(forToday: placement.dayBudgetUsed)
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
      if let opening {
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
    .feedbackSheet(
      isPresented: $showsSaveReport,
      context: FeedbackContext(screen: "placement-question", reportType: .saveFailure),
      isReport: true)
  }

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
        saveFailure: finishFailed ? Self.saveFailureMessage : nil,
        onReport: { showsSaveReport = true },
        onAnswer: { submit($0, to: question) }, onStop: { finish(fromScratch: false) }
      )
      .id(question.itemId)
      // A question held behind the warm-up's wait is timed from when it shows.
      .onAppear { shownAt = .now }
    case .done(let forToday):
      outcome(
        title: forToday
          ? Text(
            "That's enough questions for today", tableName: "Onboarding",
            comment: "Placement paused for the day: it has enough answers for now")
          : Text(
            "Your starting point is set", tableName: "Onboarding", comment: "Placement ended"),
        description: forToday
          ? Text(
            "Your first sessions ask a few more to fine-tune your plan.", tableName: "Onboarding",
            comment: "Under placement ended for the day")
          : Text(
            "It gets more accurate every day.", tableName: "Onboarding",
            comment: "Under placement ended"))
    case .unavailable:
      outcome(
        title: Text(
          "Let's skip the questions", tableName: "Onboarding",
          comment: "No placement question could be written"),
        description: Text(
          "We couldn't prepare questions for this goal. Your first sessions will find your starting point instead.",
          tableName: "Onboarding", comment: "Why placement is skipped"))
    }
  }

  @ViewBuilder private var saveFailure: some View {
    if finishFailed, !isSaving {
      Section {
        FailureLine(message: Self.saveFailureMessage)
      }
    }
  }

  private static let saveFailureMessage = LocalizedStringResource(
    "That didn't save. Try again.", table: "Onboarding",
    comment: "A change couldn't be saved")

  private var intro: some View {
    ZoonkList {
      StepHeader(
        subject: subject,
        title: Text(
          "Let's see what you already know", tableName: "Onboarding",
          comment: "Title of placement's start"),
        description: Text(
          "A few quick questions, so your plan skips what you already know. There's no score, and “I don't know yet” is a fine answer.",
          tableName: "Onboarding", comment: "What placement is"))

      saveFailure

      StepButtons(
        continueLabel: Text(
          "Start", tableName: "Onboarding", comment: "Starts placement's questions"),
        continueIcon: .play,
        skipLabel: Text(
          "Skip and start from the basics", tableName: "Onboarding",
          comment: "Skips placement; the plan starts at the beginning")
      ) {
        Task { await start() }
      } onSkip: {
        finish(fromScratch: true)
      }
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, isStarting || isSaving)
  }

  private func waiting(holding: WaitHolding?) -> some View {
    let failure: GenerationFailure? = if case .waiting(let failure) = phase { failure } else { nil }

    return PlacementWaitScreen(
      onboarding: view, goalID: view.goal.id, run: run, failure: failure, holding: holding,
      isActing: isStarting,
      skip: .init(
        label: Text(
          "Skip for now", tableName: "Onboarding",
          comment: "Skips placement while its questions are written"),
        note: Text(
          "Your first sessions will ask a few of these instead.", tableName: "Onboarding",
          comment: "Under Skip for now"),
        isBusy: isSaving, failed: finishFailed
      ) {
        finish(fromScratch: false)
      },
      onRetry: retry
    )
    .taskThroughPush(id: waitRound) { await waitForQuestions() }
  }

  private func outcome(title: Text, description: Text) -> some View {
    ZoonkList {
      StepHeader(title: title, description: description)

      saveFailure

      StepButtons(
        continueLabel: Text(
          "See my plan", tableName: "Onboarding", comment: "Ends placement and shows the plan")
      ) {
        finish(fromScratch: false)
      }
      .environment(\.isSavingAnswer, isSaving)
    }
    .onboardingColumn()
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

    Task {
      defer { isSaving = false }

      do {
        let result = try await onboarding.answerPlacement(
          goalID: view.goal.id, itemID: question.itemId, answer: answer,
          duration: .milliseconds(sent.durationMs))
        questionFailures = 0
        failedAnswer = nil
        shown.answered += 1
        show(result.placement)
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

    Task {
      defer { isSaving = false }

      do {
        try await onboarding.finishPlacement(goalID: view.goal.id, fromScratch: fromScratch)
        try await onDone()
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
}

/// A new question gets a fresh view (`.id`), so nothing picked carries over.
struct PlacementQuestionScreen<Media: View>: View {
  var subject: String?
  let number: Int
  /// The count promised up front, when the test has one.
  var total: Int?
  /// From 0 to 1.
  let progress: Double
  let question: PracticeQuestion
  var labels = PracticeTrueFalseLabels.trueFalse
  var dontKnowLabel = LocalizedStringResource(
    "I don't know yet", table: "Onboarding",
    comment: "Answers a placement question without guessing")
  let isSaving: Bool
  let failures: Int
  var saveFailure: LocalizedStringResource?
  var stopLabel = LocalizedStringResource(
    "Stop here and see my plan", table: "Onboarding", comment: "Ends placement early")
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
      VStack(alignment: .leading, spacing: 4) {
        if let subject {
          Text(subject)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }

        Group {
          if let total {
            Text(
              "Question \(number) of \(total)", tableName: "Onboarding",
              comment: "Which question of a test with a promised count this is")
          } else {
            Text(
              "Question \(number)", tableName: "Onboarding",
              comment: "Which placement question this is")
          }
        }
        .typeStyle(.body.weight(.semibold))
      }

      Meter(value: progress, fill: .success)
        .accessibilityHidden(true)

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
    } actions: {
      PracticeMainButton(
        title: LocalizedStringResource(
          "Confirm", table: "Onboarding", comment: "Sends a placement answer"),
        icon: .check, isBusy: isSaving && submission == .confirm,
        isDisabled: isSaving || draft?.complete == nil
      ) {
        if let answer = draft?.complete {
          submission = .confirm
          onAnswer(answer)
        }
      }

      PracticeSecondaryButton(
        title: dontKnowLabel, icon: .notSure, isBusy: isSaving && submission == .dontKnow,
        isDisabled: isSaving
      ) {
        submission = .dontKnow
        onAnswer(.dontKnow)
      }

      if let stopHint {
        Text(stopHint)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity)
      }

      BusyButton(isBusy: isSaving && submission == .stop) {
        submission = .stop
        onStop()
      } label: {
        Text(stopLabel)
      }
      .disabled(isSaving && submission != .stop)
    }
  }

  private var asked: PracticeQuestionView {
    PracticeQuestionView(question: question, labels: labels, draft: $draft) { answer in
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
    progress: Double,
    question: PracticeQuestion,
    labels: PracticeTrueFalseLabels,
    isSaving: Bool,
    failures: Int,
    saveFailure: LocalizedStringResource? = nil,
    stopLabel: LocalizedStringResource? = nil,
    stopHint: LocalizedStringResource? = nil,
    onReport: @escaping () -> Void,
    onAnswer: @escaping (PracticeAnswer) -> Void,
    onStop: @escaping () -> Void
  ) {
    self.init(
      subject: subject, number: number, total: total, progress: progress, question: question,
      labels: labels, isSaving: isSaving, failures: failures, saveFailure: saveFailure,
      stopHint: stopHint, onReport: onReport, onAnswer: onAnswer, onStop: onStop,
      media: { EmptyView() }
    )

    if let stopLabel {
      self.stopLabel = stopLabel
    }
  }
}
