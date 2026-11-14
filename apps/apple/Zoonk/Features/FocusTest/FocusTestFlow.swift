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
  /// The goal's name, over a question with no subject of its own.
  let subject: String
  let host: FocusTestHost
  /// The goal being set up, for its wait's run and deck; nil on a plan that's already there.
  var onboarding: GoalOnboarding?
  /// On a plan: the focus sheet, for the checkpoint's Change focus.
  var changeFocus: (() -> Void)?
  /// The focus sheet is open over the checkpoint. Coming back from it opens the checkpoint again,
  /// as a new visit, since the focus it explains may have changed.
  var isChoosingFocus = false
  /// The learner already chose to start, such as on Today: the test opens on its first question
  /// instead of offering itself again.
  var startsTest = false
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
  /// `startsTest`'s start ran; one that failed offers the test with its Start to try again.
  @State private var triedStart = false
  /// The goal's run while its questions are written, as the wait shows it.
  @State private var run = GenerationWait(kind: .placement).started

  var body: some View {
    Group {
      if let opening {
        test(opening)
          .loads(opening, refreshable: false)
          .id(ObjectIdentifier(opening))
      } else {
        StepLoading()
      }
    }
    .onAppear {
      if opening == nil {
        opening = store.openingPlacement(goalID: goalID)
      }
    }
    .onChange(of: isChoosingFocus) {
      if !isChoosingFocus, case .checkpoint = phase {
        reached = nil
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
      PlacementUnavailable(isSaving: pressed != nil, failed: failed) {
        save(.main) { try await leave(closing: host == .onboarding) }
      }
    case .invitation(let focusTest):
      if startsTest, !triedStart {
        StepLoading()
          .task { await startOnOpen() }
      } else {
        FocusTestInvitation(focusTest: focusTest, host: host, pressed: pressed, failed: failed) {
          save(.main, start)
        } onSkip: {
          // Only onboarding has a skip to save: a plan that's already there just goes back to
          // itself.
          save(.other) { try await leave(closing: host == .onboarding) }
        }
      }
    case .resume(let asked, let answered):
      FocusTestResume(
        sitting: asked.sitting, answered: answered, pressed: pressed, failed: failed
      ) {
        failed = false
        reached = .question(asked)
      } onSeeResult: {
        save(.other) { try await leave(closing: true) }
      }
    case .question(let asked):
      question(asked)
    case .ended:
      FocusTestEnded(isSaving: pressed != nil, failed: failed) {
        save(.main) { try await close() }
      }
    case .checkpoint(let focusTest):
      FocusTestCheckpoint(
        focusTest: focusTest, host: host, goalID: goalID, changeFocus: changeFocus,
        pressed: pressed, failed: failed
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
          ? Text(FocusTestCopy.seeResult)
          : host == .onboarding
            ? Text(
              "Skip for now", tableName: "FocusTest",
              comment: "Postpones the Focus test; it can be taken later from the plan")
            : Text(FocusTestCopy.notNow),
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

  private func startOnOpen() async {
    do {
      try await start()
    } catch is CancellationError {
      return
    } catch {
      failed = true
    }

    triedStart = true
  }

  /// A sitting that's over closes in the same save; if that fails, its screen holds the retry.
  private func show(_ placement: GoalPlacement) async throws {
    let next = FocusTestPhase(placement, opening: false)

    guard next == .ended else {
      reached = next
      return
    }

    do {
      try await close()
    } catch {
      reached = next
      throw error
    }
  }

  /// Closing applies the answers; a test that still has none is only skipped, and the host moves on.
  private func close() async throws {
    let focusTest = try await store.finishPlacement(goalID: goalID)

    if let focusTest, focusTest.checkpoint != nil {
      reached = .checkpoint(focusTest)
    } else {
      try await onDone()
    }
  }

  /// Leaving onboarding's step with nothing answered still saves its skip ("Skip for now"); a plan
  /// that's already there only goes back to itself.
  private func leave(closing: Bool) async throws {
    if closing {
      try await close()
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
        try await close()
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
        guard phase.isWaiting else {
          return false
        }

        // A save leaving the wait skips this read, and the wait goes on in case that save fails.
        guard pressed == nil else {
          return true
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
