import SwiftUI

/// The test of what the learner already knows, taken from the plan: its length choice, its
/// questions, the stop between a whole-course test's parts and its result. Each answer saves at
/// once; core decides what to ask and when a part is over. Main's `PlacementTestFlow`.
struct PlacementTestFlow: View {
  let goalID: String
  /// The goal's name, over each question.
  let subject: String
  /// The whole-course test's length before it starts.
  let wholeCourseMinutes: Int
  /// The topic the plan goes on with, read once a test is over.
  let nextTopic: () -> String?
  /// Goes back to the plan.
  var initialPlacement: GoalPlacement?
  var onOnboardingDone: ((String) async throws -> Void)?
  let onDone: () async throws -> Void

  @Environment(OnboardingStore.self) private var store
  @Environment(PlanStore.self) private var plans
  @State private var undoRequest = VisitRequest<Bool>()
  @State private var opening: Resource<GoalPlacement>?
  /// Where the learner's saves and the wait took the test; until then it shows the opening read.
  @State private var reached: PlacementTestPhase?
  @State private var pressed: FocusTestPress?
  @State private var failed = false
  @State private var isAnswering = false
  @State private var questionFailures = 0
  @State private var failedAnswer: SentAnswer?
  @State private var shownAt = ContinuousClock.now
  @State private var showsSaveReport = false
  @State private var waitRound = 0
  @State private var waitStartedAt = Date.now
  /// The saves and answers: a test left during one does nothing when it answers.
  @State private var tasks = ScreenTasks()

  var body: some View {
    Group {
      if let opening {
        test(opening)
          .loads(opening, refreshable: false)
          .id(ObjectIdentifier(opening))
      } else if let initialPlacement {
        testContent
          .onAppear {
            if reached == nil {
              reached = phase(for: initialPlacement)
            }
          }
      } else {
        StepLoading()
          .onAppear { opening = store.openingPlacement(goalID: goalID) }
      }
    }
    .onDisappear {
      tasks.cancel()
      undoRequest.leave()
    }
    .feedbackSheet(
      isPresented: $showsSaveReport,
      context: FeedbackContext(screen: "placement-test-question", reportType: .saveFailure),
      isReport: true)
  }

  private var phase: PlacementTestPhase {
    reached ?? (initialPlacement ?? opening?.value).map { phase(for: $0) } ?? .loading
  }

  private func phase(for placement: GoalPlacement) -> PlacementTestPhase {
    PlacementTestPhase(placement, onboarding: onOnboardingDone != nil)
  }

  @ViewBuilder
  private func test(_ opening: Resource<GoalPlacement>) -> some View {
    if reached == nil, case .failed(let error) = opening.state {
      PracticeLoadFailureView(error: error) { Task { await opening.refresh() } }
    } else {
      testContent
    }
  }

  private var testContent: some View {
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

  @ViewBuilder
  private var ready: some View {
    switch phase {
    case .loading, .waiting:
      StepLoading()
    case .choose:
      PlacementLengthChoice(
        wholeCourseMinutes: wholeCourseMinutes, isSaving: pressed != nil, failed: failed
      ) { choice in
        if case .length(let length) = choice {
          save(.main) { try await start(length) }
        }
      }
    case .question(let asked):
      question(asked)
    case .partOver(let attempt):
      TestOutcome(
        title: Text(
          "Your answers are saved", tableName: "Onboarding",
          comment: "Title once the short test is over and its answers wait to be saved"),
        isSaving: pressed != nil, failed: failed
      ) {
        save(.main) { try await close(attempt) }
      }
    case .between(let attempt, let lessonsSkipped, let changeId, let heldUntilTomorrow):
      let onboarding = onOnboardingDone != nil
      let undo = undo(changeId: changeId, lessons: lessonsSkipped ?? 0)
      PlacementBetweenParts(
        lessonsSkipped: lessonsSkipped, minutesLeft: attempt.estimatedMinutes,
        pressed: undoRequest.isRunning ? .other : pressed,
        failed: failed, heldUntilTomorrow: heldUntilTomorrow,
        onKeepGoing: {
          save(.main) {
            if let onOnboardingDone {
              try await goOnUnlessLeft { try await onOnboardingDone(attempt.id) }
            } else {
              try await start(attempt.length)
            }
          }
        }, undo: undo, onboarding: onboarding,
        onFinishForToday: onboarding ? nil : { save(.other) { try await goOnUnlessLeft(onDone) } })
    case .result(
      _, let lessonsSkipped, let attemptId, let changeId, let changeLessons,
      let heldUntilTomorrow):
      let undo = undo(changeId: changeId, lessons: changeLessons)
      PlacementTestResultView(
        lessonsSkipped: lessonsSkipped, nextTopic: nextTopic(),
        isSaving: pressed != nil || undoRequest.isRunning, failed: failed,
        heldUntilTomorrow: heldUntilTomorrow, undo: undo, onboarding: onOnboardingDone != nil
      ) {
        save(.main) {
          if let onOnboardingDone, let attemptId {
            try await goOnUnlessLeft { try await onOnboardingDone(attemptId) }
          } else {
            try await goOnUnlessLeft(onDone)
          }
        }
      }
    }
  }

  private func undo(changeId: String?, lessons: Int) -> PlacementResultUndo? {
    PlacementResultUndo(
      goalId: goalID, changeId: changeId, lessons: lessons, request: undoRequest,
      plans: plans, disabled: pressed != nil)
  }

  private func question(_ asked: PlacementTestQuestion) -> some View {
    PlacementQuestionScreen(
      subject: subject, number: asked.answered + 1,
      position: asked.attempt.length == .wholeCourse
        ? Text(
          "Part \(asked.attempt.part)", tableName: "Onboarding",
          comment: "Over a whole-course test's question: which of its parts this is")
        : nil,
      progress: asked.progress,
      question: asked.question, labels: asked.labels, isSaving: isAnswering,
      failures: questionFailures, onReport: { showsSaveReport = true },
      onAnswer: { submit($0, to: asked) }, onStop: { stop(asked.attempt) }
    )
    .id(asked.question.itemId)
    // A question held behind the wait is timed from when it shows.
    .onAppear { shownAt = .now }
  }

  private func waiting(holding: WaitHolding?) -> some View {
    let kind: GenerationWait.Kind = onOnboardingDone == nil ? .placementQuestions : .placement
    return PlacementWaitScreen(
      onboarding: nil, goalID: goalID,
      run: GenerationWait(kind: kind, since: waitStartedAt).started,
      failure: nil,
      holding: holding,
      isActing: false,
      skip: .init(
        label: Text(PlacementTestCopy.notNow), note: nil, isBusy: pressed != nil, failed: failed
      ) {
        save(.other) { try await goOnUnlessLeft(onDone) }
      },
      onRetry: { _ in waitRound += 1 }
    )
    .taskThroughPush(id: waitRound) { await waitForQuestions() }
  }

  // MARK: - Saves

  /// A button's save: it spins, the other waits, and a save that fails stays on screen to try again.
  private func save(_ button: FocusTestPress, _ action: @escaping () async throws -> Void) {
    guard pressed == nil, !isAnswering, !undoRequest.isRunning else {
      return
    }

    pressed = button
    failed = false

    tasks.run {
      defer { pressed = nil }

      do {
        try await action()
      } catch is CancellationError {
      } catch {
        failed = true
      }
    }
  }

  /// Opens a test of this length, or the next part of the open one.
  private func start(_ length: PlacementLength) async throws {
    try await show(try await store.startPlacementTest(goalID: goalID, length: length))
  }

  /// A part that's over closes in the same save; if that fails, its screen holds the retry.
  private func show(_ placement: GoalPlacement) async throws {
    let next = phase(for: placement)

    guard case .partOver(let attempt) = next else {
      reached = next
      return
    }

    do {
      try await close(attempt)
    } catch {
      reached = next
      throw error
    }
  }

  /// Closing a part applies what it skipped; another device that closed it first wins.
  private func close(_ attempt: PlacementAttempt) async throws {
    switch try await store.finishPlacementPart(goalID: goalID, attempt: attempt) {
    case .finished(let end):
      undoRequest.leave()
      reached = PlacementTestPhase(finished: end, length: attempt.length, attemptId: attempt.id)
    case .stale:
      reached = phase(for: try await store.placement(goalID: goalID))
    }
  }

  private func submit(_ answer: PracticeAnswer, to asked: PlacementTestQuestion) {
    guard !isAnswering, pressed == nil else {
      return
    }

    isAnswering = true
    failed = false
    let sent = SentAnswer(
      answer: answer, sender: answer.isDontKnow ? .notSure : .check,
      measuredMs: Int(shownAt.duration(to: .now).components.seconds * 1000), failed: failedAnswer)

    tasks.run {
      defer { isAnswering = false }

      let result: Components.Schemas.PlacementAnswerResult

      do {
        result = try await store.answerPlacement(
          goalID: goalID, itemID: asked.question.itemId, answer: answer,
          duration: .milliseconds(sent.durationMs), attempt: asked.attempt)
      } catch is CancellationError {
        return
      } catch {
        failedAnswer = sent
        questionFailures += 1
        return
      }

      questionFailures = 0
      failedAnswer = nil

      do {
        try await show(result.placement)
      } catch is CancellationError {
      } catch {
        failed = true
      }
    }
  }

  /// "Stop and use my answers": this part closes with what it has.
  private func stop(_ attempt: PlacementAttempt) {
    guard !isAnswering, pressed == nil else {
      return
    }

    isAnswering = true

    tasks.run {
      defer { isAnswering = false }

      do {
        try await close(attempt)
        questionFailures = 0
      } catch is CancellationError {
      } catch {
        questionFailures += 1
      }
    }
  }

  private func waitForQuestions() async {
    guard phase.isWaiting else {
      return
    }

    _ = await PlacementWaitScreen.follow(
      generationID: nil, store: store, apply: { _ in },
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
  }
}

/// The test taken from a learn course's plan, or a language course's walk through its topics.
struct PlacementTestScreen: View {
  let goalId: String

  @Environment(\.dismiss) private var dismiss
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var plans
  @Environment(SessionStore.self) private var session

  var body: some View {
    let goal = learner.summary.value?.goals.first { $0.id == goalId }
    let plan = plans.plan(goalId: goalId)

    NavigationStack {
      PlacementTestFlow(
        goalID: goalId, subject: goal?.displayName ?? "",
        wholeCourseMinutes: plan.value?.plan.placementTest?.estimatedMinutes ?? 0,
        nextTopic: { plan.value?.plan.nextTopic }
      ) {
        dismiss()
      }
      // A new session opens the test again from its own read.
      .id(session.authenticatedSession)
      .navigationTitle(Text(PlacementTestCopy.learnName))
      .navigationBarTitleDisplayMode(.inline)
      .testBar()
      .taskClose {
        Button(role: .close) { dismiss() }
      }
    }
    .loads(plan, refreshable: false)
  }
}

extension GoalPlan {
  /// The first topic still to study, where the plan goes on after a test; nil when none is left.
  var nextTopic: String? {
    let title = phases.lazy.flatMap(\.chapters).first { $0.state != .done && !$0.isSkipped }?.title
    return title?.isEmpty == false ? title : nil
  }
}
