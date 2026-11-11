import SwiftUI

/// Where the test runs: inside onboarding before the plan is shown, or on a plan already there.
enum FocusTestHost {
  case onboarding
  case plan
}

/// The button a save started from: it spins while the other waits.
enum FocusTestPress {
  case main
  case other
}

/// An exam goal's Focus test: its invitation, its questions, its resume screen and its checkpoint,
/// the same in onboarding's placement step and on a plan. Each answer saves at once; core decides
/// what to ask, how many and when a sitting is over, and the screen says it. Main's `FocusTestFlow`.
struct FocusTestFlow: View {
  let goalID: String
  /// The goal's name, over every screen but a question, which names its own subject.
  let subject: String
  let host: FocusTestHost
  /// The goal being set up, for its wait's run and deck; nil on a plan that's already there.
  var onboarding: GoalOnboarding?
  /// On a plan: the focus sheet, for the checkpoint's Change focus.
  var changeFocus: (() -> Void)?
  /// Leaves the test: onboarding saves its step, a plan goes back to itself.
  let onDone: () async throws -> Void

  @Environment(OnboardingStore.self) private var store
  @State private var opening: Resource<GoalPlacement>?
  /// Where the learner's saves and the wait took the test; until then it shows the opening read.
  @State private var reached: FocusTestPhase?
  @State private var pressed: FocusTestPress?
  @State private var failed = false
  @State private var isAnswering = false
  @State private var questionFailures = 0
  @State private var failedAnswer: SentAnswer?
  @State private var shownAt = ContinuousClock.now
  @State private var showsSaveReport = false
  @State private var waitRound = 0
  /// The goal's run while its questions are written, as the wait shows it.
  @State private var run = GenerationWait(kind: .placement).started

  var body: some View {
    Group {
      if let opening {
        test(opening)
          .loads(opening, refreshable: false)
      } else {
        StepLoading()
      }
    }
    .onAppear {
      if opening == nil {
        opening = store.openingPlacement(goalID: goalID)
      }
    }
    .feedbackSheet(
      isPresented: $showsSaveReport,
      context: FeedbackContext(screen: "focus-test-question", reportType: .saveFailure),
      isReport: true)
  }

  private var phase: FocusTestPhase {
    reached ?? opening?.value.map { FocusTestPhase($0, opening: true) } ?? .loading
  }

  @ViewBuilder
  private func test(_ opening: Resource<GoalPlacement>) -> some View {
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
    case .loading, .waiting:
      StepLoading()
    case .unavailable:
      FocusTestUnavailable(isSaving: pressed != nil, failed: failed) {
        save(.main) { try await leave(closing: host == .onboarding) }
      }
    case .invitation(let focusTest, let next):
      FocusTestInvitation(
        focusTest: focusTest, next: next, subject: subject, host: host, pressed: pressed,
        failed: failed
      ) {
        save(.main, start)
      } onSkip: {
        // Only onboarding has a skip to save: a plan that's already there just goes back to itself.
        save(.other) { try await leave(closing: host == .onboarding) }
      }
    case .resume(let asked):
      FocusTestResume(sitting: asked.sitting, subject: subject, pressed: pressed, failed: failed) {
        failed = false
        reached = .question(asked)
      } onUseAnswers: {
        save(.other) { try await leave(closing: true) }
      }
    case .question(let asked):
      question(asked)
    case .ended(let end):
      FocusTestEnded(end: end, subject: subject, isSaving: pressed != nil, failed: failed) {
        save(.main) { try await close(end) }
      }
    case .checkpoint(let focusTest, let end):
      FocusTestCheckpoint(
        focusTest: focusTest, end: end, subject: subject, host: host, goalID: goalID,
        changeFocus: changeFocus, pressed: pressed, failed: failed
      ) {
        save(.main) { try await onDone() }
      } onContinueTest: {
        save(.other, start)
      }
    }
  }

  private func question(_ asked: FocusTestQuestion) -> some View {
    let sitting = asked.sitting

    return PlacementQuestionScreen(
      subject: sitting.subject?.shown ?? subject, number: sitting.answered + 1,
      total: sitting.questions,
      progress: sitting.questions > 0 ? Double(sitting.answered) / Double(sitting.questions) : 0,
      question: asked.question, labels: asked.labels, isSaving: isAnswering,
      failures: questionFailures,
      stopLabel: LocalizedStringResource(
        "Stop and use my answers", table: "FocusTest",
        comment: "Ends a Focus test sitting early; its answers count at once"),
      stopHint: sitting.hint == .manyUnknown
        ? LocalizedStringResource(
          "Haven't studied most of this yet? That's fine. You can stop here and start learning.",
          table: "FocusTest",
          comment: "Above Stop, after five \"I don't know yet\" in a row in the Focus test")
        : nil,
      onReport: { showsSaveReport = true },
      onAnswer: { submit($0, to: asked) },
      onStop: { stop() }
    )
    .id(asked.question.itemId)
    // A question held behind the wait is timed from when it shows.
    .onAppear { shownAt = .now }
  }

  private func waiting(holding: WaitHolding?) -> some View {
    let (answered, failure): (Bool, GenerationFailure?) =
      if case .waiting(let answered, let failure) = phase { (answered, failure) } else {
        (false, nil)
      }

    return PlacementWaitScreen(
      onboarding: onboarding, goalID: goalID, run: run, failure: failure, holding: holding,
      isActing: false,
      skip: .init(
        label: answered
          ? Text(
            "Use my answers", tableName: "FocusTest",
            comment: "Leaves the Focus test with the answers given so far")
          : host == .onboarding
            ? Text(
              "Skip for now", tableName: "FocusTest",
              comment: "Postpones the Focus test; it can be taken later from the plan")
            : Text(
              "Not now", tableName: "FocusTest",
              comment: "Leaves the Focus test without taking it, back to the plan"),
        note: !answered && host == .onboarding
          ? Text(
            "You can take the test later, from your plan.", tableName: "FocusTest",
            comment: "Under Skip for now while the Focus test's questions are written")
          : nil,
        isBusy: pressed != nil, failed: failed
      ) {
        save(.other) { try await leave(closing: answered || host == .onboarding) }
      },
      onRetry: { _ in
        reached = .waiting(answered: answered, failure: nil)
        waitRound += 1
      }
    )
    .taskThroughPush(id: waitRound) { await waitForQuestions() }
  }

  // MARK: - Saves

  /// A button's save: it spins, the other waits, and a save that fails stays on screen to try again.
  private func save(_ button: FocusTestPress, _ action: @escaping () async throws -> Void) {
    guard pressed == nil, !isAnswering else {
      return
    }

    pressed = button
    failed = false

    Task {
      defer { pressed = nil }

      do {
        try await action()
      } catch is CancellationError {
      } catch {
        failed = true
      }
    }
  }

  /// Opens the next sitting; asked again, it answers with the one already open.
  private func start() async throws {
    try await show(try await store.startPlacementSitting(goalID: goalID))
  }

  /// A sitting that's over closes in the same save; if that fails, its screen holds the retry.
  private func show(_ placement: GoalPlacement) async throws {
    let next = FocusTestPhase(placement, opening: false)

    guard case .ended(let end) = next else {
      reached = next
      waitRound += next.isWaiting ? 1 : 0
      return
    }

    do {
      try await close(end)
    } catch {
      reached = next
      throw error
    }
  }

  /// Closing applies the answers; a test that still has none is only skipped, and the host moves on.
  private func close(_ end: FocusTest.Sitting.End?) async throws {
    let focusTest = try await store.finishPlacement(goalID: goalID)

    if let focusTest, focusTest.checkpoint != nil {
      reached = .checkpoint(focusTest, end: end)
    } else {
      try await onDone()
    }
  }

  /// Leaving onboarding's step with nothing answered still saves its skip ("Skip for now"); a plan
  /// that's already there only goes back to itself.
  private func leave(closing: Bool) async throws {
    if closing {
      try await close(nil)
    } else {
      try await onDone()
    }
  }

  private func submit(_ answer: PracticeAnswer, to asked: FocusTestQuestion) {
    guard !isAnswering, pressed == nil else {
      return
    }

    isAnswering = true
    failed = false
    let sent = SentAnswer(
      answer: answer, sender: answer.isDontKnow ? .notSure : .check,
      measuredMs: Int(shownAt.duration(to: .now).components.seconds * 1000), failed: failedAnswer)

    Task {
      defer { isAnswering = false }

      let result: Components.Schemas.PlacementAnswerResult

      do {
        result = try await store.answerPlacement(
          goalID: goalID, itemID: asked.question.itemId, answer: answer,
          duration: .milliseconds(sent.durationMs))
      } catch is CancellationError {
        return
      } catch {
        failedAnswer = sent
        questionFailures += 1
        return
      }

      questionFailures = 0
      failedAnswer = nil

      // The answer saved; a sitting it ended that didn't close holds its retry on its own screen.
      do {
        try await show(result.placement)
      } catch is CancellationError {
      } catch {
        failed = true
      }
    }
  }

  /// "Stop and use my answers": its answers count at once.
  private func stop() {
    guard !isAnswering, pressed == nil else {
      return
    }

    isAnswering = true

    Task {
      defer { isAnswering = false }

      do {
        try await close(nil)
        questionFailures = 0
      } catch is CancellationError {
      } catch {
        questionFailures += 1
      }
    }
  }

  private func waitForQuestions() async {
    guard case .waiting(let answered, failure: nil) = phase else {
      return
    }

    let followed = await PlacementWaitScreen.follow(
      generationID: onboarding?.generationId, store: store, apply: { run.apply($0) },
      isWaiting: {
        guard phase.isWaiting, pressed == nil else {
          return false
        }

        if let placement = try? await store.placement(goalID: goalID), phase.isWaiting {
          try? await show(placement)
        }

        return phase.isWaiting
      })

    if !followed, phase.isWaiting {
      reached = .waiting(answered: answered, failure: .connection)
    }
  }
}
