import SwiftUI

/// A course's test, in onboarding and from the plan: the plan's offer, its questions, the full
/// test's checkpoints, a part stopped midway and its result. Each answer saves at once; core decides
/// what to ask and when a part is over. Main's `PlacementTestFlow`.
struct PlacementTestFlow: View {
  /// How the flow opens: on the test as it stands, or by starting one the learner already chose.
  enum Opening: Equatable {
    case read
    case start(PlacementLength)
  }

  let goalID: String
  /// The goal's name, over a question with no chapter.
  let subject: String
  var opening = Opening.read
  /// The plan's offer before a test starts.
  var offer: CoursePlacementOffer?
  /// The goal being set up, for its wait's run and deck; nil on the plan.
  var onboarding: GoalOnboarding?
  /// Onboarding goes on with setup, with the test's attempt.
  var onOnboardingDone: ((String?) async throws -> Void)?
  /// The plan's result opens the next lesson.
  var onStartLesson: ((String) -> Void)?
  /// Leaves the test for the plan.
  let onDone: () async throws -> Void

  @Environment(OnboardingStore.self) private var store
  @Environment(PlanStore.self) private var plans
  @State private var undoRequest = VisitRequest<Bool>()
  @State private var read: Resource<GoalPlacement>?
  /// Where the learner's saves and the wait took the test; until then it shows the opening read.
  @State private var reached: PlacementTestPhase?
  @State private var pressed: FocusTestPress?
  @State private var failed = false
  @State private var startFailed = false
  @State private var isAnswering = false
  @State private var questionFailures = 0
  @State private var failedAnswer: SentAnswer?
  @State private var shownAt = ContinuousClock.now
  @State private var visit = TestVisit()
  /// The length the learner last started, which a wait for the course's questions opens.
  @State private var wanted = PlacementLength.quick
  @State private var showsSaveReport = false
  @State private var waitRound = 0
  @State private var waitStartedAt = Date.now
  @State private var run: GenerationWait?
  /// The saves and answers: a test left during one does nothing when it answers.
  @State private var tasks = ScreenTasks()

  private var isOnboarding: Bool { onOnboardingDone != nil }

  var body: some View {
    Group {
      if let read {
        test(read)
          .loads(read, refreshable: false)
          .id(ObjectIdentifier(read))
      } else if startFailed {
        PracticeLoadFailureView(error: .unavailable) {
          startFailed = false
          openOnAppear()
        }
      } else if reached != nil {
        testContent
      } else {
        StepLoading()
          .onAppear(perform: openOnAppear)
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
    reached ?? read?.value.map { phase(for: $0, asked: false) } ?? .loading
  }

  /// `asked`: the learner started the test in this visit, so a test that couldn't open waits.
  private func phase(for placement: GoalPlacement, asked: Bool = true) -> PlacementTestPhase {
    PlacementTestPhase(placement, onboarding: isOnboarding, asked: asked)
  }

  private func openOnAppear() {
    switch opening {
    case .read:
      if read == nil {
        read = store.openingPlacement(goalID: goalID)
      }
    case .start(let length):
      tasks.run {
        do {
          try await start(length)
        } catch is CancellationError {
        } catch {
          startFailed = true
        }
      }
    }
  }

  private var context: AnalyticsEvent.TestContext {
    let attempt = phase.attempt
    return AnalyticsEvent.TestContext(
      goalID: goalID, test: .course, surface: isOnboarding ? .onboarding : .plan,
      part: attempt?.part, parts: attempt?.parts ?? offer?.wholeCourse?.parts,
      questions: attempt?.questions ?? offer?.questions, attemptID: attempt?.id)
  }

  @ViewBuilder
  private func test(_ read: Resource<GoalPlacement>) -> some View {
    if reached == nil, case .failed(let error) = read.state {
      PracticeLoadFailureView(error: error) { Task { await read.refresh() } }
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
    case .loading, .waiting, .preparationFailed, .connectionLost:
      StepLoading()
    case .offer:
      if let offer {
        TestOffer(
          rows: TestCopy.courseRows(offer), chip: String(localized: PlacementTestCopy.learnName),
          title: Text(TestCopy.skipWhatYouKnow), description: Text(TestCopy.findsSkips),
          preselected: .quick, context: context, isSaving: pressed != nil, failed: failed,
          onNotNow: notNow
        ) { row in
          save(.main) { try await start(row == .wholeCourse ? .wholeCourse : .quick) }
        }
      } else {
        // Nothing is left ahead to check.
        PlacementUnavailable(
          continueLabel: Text(TestCopy.done), isSaving: pressed != nil, failed: failed
        ) {
          save(.main) { try await goOnUnlessLeft(onDone) }
        }
      }
    case .continueTest(let attempt):
      TestOffer(
        rows: [
          TestOfferRow(
            id: .continue, label: String(localized: TestCopy.continueTest),
            facts: PlacementTestCopy.standing(attempt))
        ],
        chip: String(localized: PlacementTestCopy.learnName), title: Text(TestCopy.continueTest),
        preselected: .continue, context: context,
        notNowLabel: TestCopy.finishLater,
        isSaving: pressed != nil, failed: failed,
        onNotNow: {
          if !isOnboarding {
            UsageAnalytics.track(.testSkipped(context))
          }
          save(.other) { try await leave(attemptId: attempt.id) }
        },
        // Going on with a full test, or past a quick one, opens the rest of the course.
        onStart: { _ in save(.main) { try await start(.wholeCourse) } })
    case .unavailable:
      PlacementUnavailable(
        continueLabel: isOnboarding ? nil : Text(TestCopy.done), isSaving: pressed != nil,
        failed: failed
      ) {
        save(.main) { try await leave(attemptId: nil) }
      }
    case .question(let asked):
      question(asked)
    case .partOver(let attempt):
      TestOutcome(
        title: Text(TestCopy.answersSaved), isSaving: pressed != nil, failed: failed
      ) {
        save(.main) { try await close(attempt) }
      }
    case .checkpoint(let stop):
      PlacementCheckpoint(
        stop: stop, pressed: pressed, failed: failed,
        undo: undo(changeId: stop.changeId, lessons: stop.undoLessons),
        onKeepGoing: { save(.main) { try await start(.wholeCourse) } },
        onFinishLater: { save(.other) { try await leave(attemptId: stop.attempt.id) } })
    case .stopped(let stop):
      PlacementStopped(
        stop: stop, onboarding: isOnboarding, pressed: pressed, failed: failed,
        undo: undo(changeId: stop.changeId, lessons: stop.undoLessons)
      ) {
        save(.main) { try await leave(attemptId: stop.attempt.id) }
      }
    case .result(let end):
      PlacementTestResultView(
        end: end, onboarding: isOnboarding, pressed: pressed, failed: failed,
        undo: undo(changeId: end.changeId, lessons: end.undoLessons),
        onTestTheRest: { save(.other) { try await start(.wholeCourse) } },
        onDone: { goOn(from: end) })
    }
  }

  /// The result's way on: on the plan its next lesson when it's known, else back.
  private func goOn(from end: PlacementTestEnd) {
    if !isOnboarding, undoRequest.outcome != true, let lesson = end.nextLesson, let onStartLesson {
      UsageAnalytics.track(.testLessonStarted(context, lessonID: lesson.id))
      onStartLesson(lesson.id)
    } else {
      save(.main) { try await leave(attemptId: end.attemptId) }
    }
  }

  private func undo(changeId: String?, lessons: Int) -> PlacementResultUndo? {
    PlacementResultUndo(
      goalId: goalID, changeId: changeId, lessons: lessons, request: undoRequest,
      plans: plans, disabled: pressed != nil)
  }

  private func question(_ asked: PlacementTestQuestion) -> some View {
    let attempt = asked.attempt

    return PlacementQuestionScreen(
      subject: attempt.chapter.map { $0.trimmingCharacters(in: .whitespaces) }
        .flatMap { $0.isEmpty ? nil : $0 } ?? subject,
      number: attempt.answered + 1, total: attempt.questions,
      part: attempt.length == .wholeCourse ? (attempt.part, attempt.parts) : nil,
      question: asked.question, labels: asked.labels, isSaving: isAnswering,
      failures: questionFailures, context: context, onReport: { showsSaveReport = true },
      onAnswer: { submit($0, to: asked) }, onStop: { stop(attempt) }
    )
    .id(asked.question.itemId)
    // A question held behind the wait is timed from when it shows.
    .onAppear {
      shownAt = .now
      visit.firstQuestion(
        context, number: attempt.answered + 1, sitting: "\(attempt.id):\(attempt.part)"
      ).map(UsageAnalytics.track)
    }
  }

  private var waitRun: GenerationWait {
    run
      ?? GenerationWait(kind: isOnboarding ? .placement : .placementQuestions, since: waitStartedAt)
      .started
  }

  private func waiting(holding: WaitHolding?) -> some View {
    PlacementWaitScreen(
      onboarding: onboarding, goalID: goalID, run: waitRun, failure: phase.waitFailure,
      holding: holding,
      isActing: pressed == .main,
      skip: .init(
        label: isOnboarding
          ? Text("Skip", tableName: "Onboarding", comment: "Skips an optional onboarding question")
          : Text(PlacementTestCopy.notNow),
        note: isOnboarding ? Text(PlacementWaitScreen.laterNote) : nil,
        isBusy: pressed == .other, failed: failed
      ) {
        save(.other) { try await leave(attemptId: nil) }
      },
      onRetry: { failure in
        // A writer that failed starts the same part, or the asked-for test, again; a lost
        // connection reads again.
        if failure == .generation {
          save(.main) { try await start(phase.attempt?.length ?? wanted) }
        } else {
          reached = .waiting
          waitRound += 1
        }
      }
    )
    .taskThroughPush(id: phase == .waiting ? waitRound : nil) { await waitForQuestions() }
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

  private func notNow() {
    UsageAnalytics.track(.testSkipped(context))
    save(.other) { try await goOnUnlessLeft(onDone) }
  }

  /// Leaves the test: onboarding goes on with setup, the plan goes back to itself.
  private func leave(attemptId: String?) async throws {
    if let onOnboardingDone {
      try await goOnUnlessLeft { try await onOnboardingDone(attemptId) }
    } else {
      try await goOnUnlessLeft(onDone)
    }
  }

  /// Opens a test of this length, or goes on with the open one. `arrived`: the questions a wait was
  /// for came, so the learner's earlier press still times the wait.
  private func start(_ length: PlacementLength, arrived: Bool = false) async throws {
    undoRequest.leave()
    wanted = length
    if !arrived {
      visit.started()
    }

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
  /// `stoppedAt`: a stop's answer count as the learner saw it, so a position another device moved
  /// past is refused and read again.
  private func close(_ attempt: PlacementAttempt, stoppedAt: Int? = nil) async throws {
    switch try await store.finishPlacementPart(
      goalID: goalID, attempt: attempt, stoppedAt: stoppedAt)
    {
    case .finished(let end):
      undoRequest.leave()
      reached = PlacementTestPhase(finished: end, attemptId: attempt.id)
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
        try await close(attempt, stoppedAt: attempt.answered)
        questionFailures = 0
      } catch is CancellationError {
      } catch {
        questionFailures += 1
      }
    }
  }

  private func waitForQuestions() async {
    guard phase == .waiting else {
      return
    }

    let followed = await PlacementWaitScreen.follow(
      generationID: onboarding?.generationId, store: store,
      apply: { event in
        var updated = waitRun
        updated.apply(event)
        run = updated
      },
      isWaiting: {
        guard phase == .waiting else {
          return false
        }

        // A save leaving the wait skips this read, and the wait goes on in case that save fails.
        guard pressed == nil else {
          return true
        }

        if let placement = try? await store.placement(goalID: goalID), phase == .waiting {
          // The questions of a test that couldn't open yet are written: the start the learner
          // asked for opens it now.
          let arrived =
            placement.activeTestAttempt == nil
            && (placement.status == .asking || placement.status == .done)
          try? await (arrived ? start(wanted, arrived: true) : show(placement))
        }

        return phase == .waiting
      })

    if !followed, phase == .waiting {
      reached = .connectionLost
    }
  }
}

extension PlacementTestPhase {
  /// The open test, for the screen's analytics.
  var attempt: PlacementAttempt? {
    switch self {
    case .continueTest(let attempt), .partOver(let attempt):
      attempt
    case .preparationFailed(let attempt):
      attempt
    case .question(let asked):
      asked.attempt
    case .checkpoint(let stop), .stopped(let stop):
      stop.attempt
    case .result(let end):
      end.rest
    case .loading, .offer, .waiting, .connectionLost, .unavailable:
      nil
    }
  }
}

/// A course's test taken from the plan.
struct PlacementTestScreen: View {
  let goalId: String

  @Environment(\.dismiss) private var dismiss
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var plans
  @Environment(SessionStore.self) private var session
  @State private var leaving: AnalyticsEvent?

  var body: some View {
    let goal = learner.summary.value?.goals.first { $0.id == goalId }
    let plan = plans.plan(goalId: goalId)

    NavigationStack {
      Group {
        // The offer's facts are the plan's, so the test waits for it.
        if let read = plan.value {
          PlacementTestFlow(
            goalID: goalId, subject: goal?.displayName ?? "",
            offer: read.plan.placementTest?.offer,
            onStartLesson: { lessonId in
              dismiss()
              router.open(.lesson(lessonId: lessonId))
            }
          ) {
            dismiss()
          }
          // A new session opens the test again from its own read.
          .id(session.authenticatedSession)
        } else if case .failed(let error) = plan.state {
          PracticeLoadFailureView(error: error) { Task { await plan.refresh() } }
        } else {
          StepLoading()
        }
      }
      .onPreferenceChange(TestLeaveKey.self) { leaving = $0 }
      .navigationTitle(Text(PlacementTestCopy.learnName))
      .navigationBarTitleDisplayMode(.inline)
      .testBar()
      .taskClose {
        Button(role: .close) {
          leaving.map(UsageAnalytics.track)
          dismiss()
        }
        .leavesOnEscape()
      }
    }
    .loads(plan, refreshable: false)
  }
}
