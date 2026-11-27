import SwiftUI

/// What a language's level test shows. Main's `useLanguagePlanTest` phases.
enum LanguageTestPhase: Equatable {
  enum Completion { case levelTest, testOut }

  case loading
  case loadFailed
  /// No test is open: the offer, with the test's facts.
  case offer(LevelTest)
  /// The test's questions are being written; `generationID` once the learner's Start joined the run.
  case preparing(attemptID: String, generationID: String?)
  /// `canStop`: "Stop and use my answers" shows only once stopping saves something.
  case question(
    attemptID: String, LevelTest.Question, selectsAll: Bool, number: Int, total: Int,
    canStop: Bool)
  case finish(attemptID: String, completion: Completion = .levelTest)
  case result(PlacementTestResult?)
  /// A level's test-out whose questions are still being written.
  case testOutPreparing(LevelTestOut)
  case testOut(LevelTestOut, PracticeQuestion)
  case testOutResult(LevelTestOut)

  /// A test opened from a read goes on where it stopped; onboarding comes back to its result;
  /// otherwise the learner is offered the test.
  init(opened test: LevelTest, onboarding: Bool) {
    guard let attemptID = test.attemptId else {
      self = .offer(test)
      return
    }

    if let result = test.result, result.attemptId == attemptID {
      self = onboarding ? .result(result) : .offer(test)
    } else if test.status == .preparing {
      self = .preparing(attemptID: attemptID, generationID: nil)
    } else {
      self = Self(test, attemptID: attemptID) ?? .finish(attemptID: attemptID)
    }
  }

  /// The test's next question; nil while it's written or once it asks nothing more.
  init?(_ test: LevelTest, attemptID: String) {
    guard test.status == .ready, let next = test.next, next.isQuestion,
      let question = next.question
    else {
      return nil
    }

    self = .question(
      attemptID: attemptID, question, selectsAll: next.kind == "confirmation",
      number: (test.answered ?? 0) + 1, total: test.total, canStop: test.canStop == true)
  }

  init(testOut: LevelTestOut) {
    if testOut.preparing {
      self = .testOutPreparing(testOut)
    } else if let next = testOut.next, next.question.format != .typed,
      next.question.format != .numeric
    {
      self = .testOut(testOut, next.question)
    } else if testOut.next == nil, testOut.result == nil, testOut.total > 0 {
      self = .finish(attemptID: testOut.attemptId, completion: .testOut)
    } else {
      self = .testOutResult(testOut)
    }
  }
}

/// A language's level test, in onboarding and from the plan: the offer, its questions, the levels
/// it found and, on the plan, the level test-outs. Main's `LanguagePlanTestFlow`.
struct LevelTestFlow: View {
  enum Opening: Equatable {
    case read
    /// The learner already asked for the test: its start goes first.
    case start
  }

  let goalID: String
  let targetLanguage: String
  /// The next level the learner can test out of; nil when none is left, and in onboarding.
  let testOutLevel: String?
  /// Opened from a lesson's "Test out of" offer: the offer picks the test-out.
  var testOutFirst = false
  var opening = Opening.read
  /// The plan's result opens the next lesson.
  var onStartLesson: ((String) -> Void)?
  /// Onboarding's: the learner's own language, which the result offers to switch the app to.
  var appLanguage: String?
  /// Onboarding's "First lesson".
  var onFirstLesson: (() async throws -> Void)?
  var onOnboardingDone: ((String?) async throws -> Void)?
  let onDone: () async throws -> Void

  @Environment(OnboardingStore.self) private var store
  @Environment(PlanStore.self) private var plans
  @State private var undoRequest = VisitRequest<Bool>()
  @State private var phase = LanguageTestPhase.loading
  @State private var pressed: FocusTestPress?
  @State private var failed = false
  @State private var isAnswering = false
  @State private var answerFailures = 0
  @State private var failedAnswer: SentAnswer?
  @State private var shownAt = ContinuousClock.now
  @State private var visitStart = ContinuousClock.now
  @State private var firstQuestionShown = false
  /// The open test's facts, for the analytics of its screens.
  @State private var total: Int?
  @State private var showsSaveReport = false
  @State private var tasks = ScreenTasks()

  private var isOnboarding: Bool { onOnboardingDone != nil }

  var body: some View {
    content
      .task { await open() }
      .onDisappear {
        tasks.cancel()
        undoRequest.leave()
      }
      .feedbackSheet(
        isPresented: $showsSaveReport,
        context: FeedbackContext(screen: "level-test", reportType: .saveFailure), isReport: true)
  }

  private var context: AnalyticsEvent.TestContext {
    var attemptID: String?
    var test = AnalyticsEvent.TestContext.Test.language
    var questions = total

    switch phase {
    case .preparing(let id, _), .question(let id, _, _, _, _, _), .finish(let id, _):
      attemptID = id
    case .result(let result):
      attemptID = result?.attemptId
    case .testOutPreparing(let view), .testOut(let view, _), .testOutResult(let view):
      attemptID = view.attemptId
      test = .levelTestOut
      questions = view.total
    case .loading, .loadFailed, .offer:
      break
    }

    return AnalyticsEvent.TestContext(
      goalID: goalID, test: test, surface: isOnboarding ? .onboarding : .plan,
      questions: questions, attemptID: attemptID)
  }

  @ViewBuilder
  private var content: some View {
    switch phase {
    case .loading:
      StepLoading()
    case .loadFailed:
      PracticeLoadFailureView(error: .unavailable) {
        phase = .loading
        Task { await open() }
      }
    case .offer(let test):
      offer(test)
    case .preparing(let attemptID, let generationID):
      preparing(attemptID: attemptID, generationID: generationID)
    case .question(let attemptID, let question, let selectsAll, let number, let total, let canStop):
      LevelTestQuestionScreen(
        question: question, selectsAll: selectsAll, number: number, total: total,
        canStop: canStop,
        targetLanguage: targetLanguage, isSaving: isAnswering || pressed != nil,
        failures: answerFailures, context: context, onReport: { showsSaveReport = true },
        onAnswer: { answer(question, attemptID: attemptID, with: $0, skips: $1) },
        onDeferAudio: {
          answer(question, attemptID: attemptID, with: .dontKnow, skips: false, defersAudio: true)
        },
        onStop: { save(.other) { try await finish(attemptID) } }
      )
      .id(question.id)
      .onAppear {
        shownAt = .now
        trackFirstQuestion(number: number)
      }
      .task(id: question.id) { await waitForAudio(question, attemptID: attemptID) }
    case .finish(let attemptID, let completion):
      TestOutcome(
        title: Text(TestCopy.answersSaved),
        failureMessage: LocalizedStringResource(
          "That didn't go through. Try again in a moment.", table: "Plan"),
        isSaving: isAnswering || pressed != nil, failed: failed
      ) {
        save(.main) { try await finish(attemptID, completion: completion) }
      }
    case .result(let result):
      let undo = undo(changeId: result?.changeId, lessons: result?.lessonsSkipped ?? 0)
      LanguageTestResultView(
        result: result, targetLanguage: targetLanguage, testOutLevel: testOutLevel,
        pressed: pressed, failed: failed, undo: undo, onboarding: isOnboarding,
        appLanguage: appLanguage
      ) {
        if !isOnboarding, undoRequest.outcome != true, let lesson = result?.nextLesson,
          let onStartLesson
        {
          UsageAnalytics.track(.testLessonStarted(context, lessonID: lesson.id))
          onStartLesson(lesson.id)
        } else {
          save(.main) { try await leave() }
        }
      } onTestOut: {
        testOut()
      }
    case .testOutPreparing(let view):
      PlacementWaitScreen(
        onboarding: nil, goalID: goalID, run: GenerationWait(kind: .placementQuestions).started,
        failure: nil, holding: nil, isActing: false,
        skip: .init(
          label: Text(PlacementTestCopy.notNow), note: nil, isBusy: pressed != nil,
          failed: failed
        ) {
          save(.other) { try await goOnUnlessLeft(onDone) }
        },
        onRetry: { _ in }
      )
      .task(id: view.attemptId) { await waitForTestOut(view) }
    case .testOut(let view, let question):
      PlacementQuestionScreen(
        subject: PlacementTestCopy.testOut(view.level), number: view.answered + 1,
        total: view.total, question: question, askedIn: "\(view.attemptId):\(question.itemId)",
        labels: .trueFalse, isSaving: isAnswering, failures: answerFailures, context: context,
        onReport: { showsSaveReport = true },
        onAnswer: { answerTestOut($0, view: view, question: question) },
        onStop: { stopTestOut(view) }
      )
      .id(question.itemId)
      .onAppear { shownAt = .now }
    case .testOutResult(let view):
      LevelTestOutResult(
        view: view, isSaving: pressed != nil || undoRequest.isRunning, failed: failed,
        undo: undo(changeId: view.result?.changeId, lessons: view.result?.lessonsSkipped ?? 0)
      ) {
        save(.main) { try await goOnUnlessLeft(onDone) }
      }
    }
  }

  /// Onboarding's "First lesson" or the level test; on the plan the level test, with the next
  /// level's test-out beside it when there is one.
  private func offer(_ test: LevelTest) -> some View {
    let levelTest = TestOfferRow(
      id: .quick, label: String(localized: PlacementTestCopy.languageName),
      facts: TestCopy.testFacts(questions: test.total, minutes: test.estimatedMinutes))
    let testOutRow = testOutLevel.map { level in
      TestOfferRow(
        id: .testOut, label: PlacementTestCopy.testOut(level),
        facts: [
          String(
            localized: "Skip \(level) if you already know it", table: "Onboarding",
            comment:
              "What a language level's test-out does, such as \"Skip B2 if you already know it\"")
        ])
    }
    let rows =
      isOnboarding
      ? [TestCopy.firstLessonRow, levelTest] : [levelTest] + (testOutRow.map { [$0] } ?? [])

    return TestOffer(
      rows: rows, chip: String(localized: PlacementTestCopy.languageName),
      title: Text(isOnboarding ? TestCopy.whereToStart : TestCopy.skipWhatYouKnow),
      description: Text(TestCopy.findsSkips),
      preselected: testOutFirst && testOutRow != nil ? .testOut : .quick,
      context: AnalyticsEvent.TestContext(
        goalID: goalID, test: .language, surface: isOnboarding ? .onboarding : .plan,
        questions: test.total),
      isSaving: pressed != nil, failed: failed,
      onNotNow: isOnboarding
        ? nil
        : {
          UsageAnalytics.track(.testSkipped(context))
          save(.other) { try await goOnUnlessLeft(onDone) }
        }
    ) { row in
      switch row {
      case .firstLesson:
        if let onFirstLesson {
          save(.main) { try await goOnUnlessLeft(onFirstLesson) }
        }
      case .testOut:
        testOut()
      default:
        save(.main) { try await start() }
      }
    }
  }

  private func undo(changeId: String?, lessons: Int) -> PlacementResultUndo? {
    PlacementResultUndo(
      goalId: goalID, changeId: changeId, lessons: lessons, request: undoRequest,
      plans: plans, disabled: pressed != nil)
  }

  private func trackFirstQuestion(number: Int) {
    guard !firstQuestionShown else { return }
    firstQuestionShown = true
    let waited = visitStart.duration(to: .now).components
    UsageAnalytics.track(
      .testFirstQuestionShown(
        context, questionNumber: number,
        waitMs: Int(waited.seconds * 1000 + waited.attoseconds / 1_000_000_000_000_000),
        resumed: number > 1))
  }

  /// "Getting your test ready", with the way on available at once: onboarding's "Skip" and its
  /// note, the plan's "Not now". A run that failed offers "Try again".
  private func preparing(attemptID: String, generationID: String?) -> some View {
    GenerationWaitView(
      title: LocalizedStringResource(
        "Getting your test ready", table: "Onboarding"),
      description: LocalizedStringResource(
        "This takes a minute or two.", table: "Onboarding",
        comment:
          "Shown while the learner waits for their first questions to be prepared. “This” is the wait."
      ),
      generationID: generationID,
      kind: .levelTestBank,
      restart: { try await store.prepareLevelTest(goalID: goalID) },
      readResult: { await read(attemptID: attemptID) },
      trailing: {
        if isOnboarding {
          Section {
            Text(PlacementWaitScreen.laterNote)
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
              .listRowBackground(Color.clear)
          }
        }
      }
    )
    .bottomBar(note: failed && pressed == nil ? BarNote(TestCopy.saveFailure) : nil) {
      BusyButton(isBusy: pressed == .other, icon: isOnboarding ? .skip : nil) {
        save(.other) { try await leave() }
      } label: {
        if isOnboarding {
          Text("Skip", tableName: "Onboarding", comment: "Skips an optional onboarding question")
        } else {
          Text(PlacementTestCopy.notNow)
        }
      }
      .buttonStyle(.outline)
      .buttonSizing(.flexible)
    }
    .onboardingColumn()
    // Without the run's id, as when the learner comes back to a test still being written, the
    // wait reads the test until it's ready.
    .task(id: generationID == nil ? attemptID : nil) {
      guard generationID == nil else {
        return
      }

      while case .preparing = phase, !Task.isCancelled {
        try? await Task.sleep(for: .seconds(3))
        _ = await read(attemptID: attemptID)
      }
    }
  }

  // MARK: - Reads

  private func open() async {
    guard phase == .loading else {
      return
    }

    do {
      switch opening {
      case .start:
        try await start()
      case .read:
        let test = try await store.languageTest(goalID: goalID)
        total = test.total
        phase = LanguageTestPhase(opened: test, onboarding: isOnboarding)
      }
    } catch is CancellationError {
    } catch {
      phase = .loadFailed
    }
  }

  /// Shows the test once it's ready; false when it couldn't be read.
  private func read(attemptID: String) async -> Bool {
    guard let test = try? await store.languageTest(goalID: goalID, attemptID: attemptID) else {
      return false
    }

    if test.status == .ready, case .preparing = phase {
      try? await show(test, attemptID: attemptID)
    }

    return true
  }

  private func waitForAudio(_ question: LevelTest.Question, attemptID: String) async {
    guard question.audioPending,
      let shown = try? await question.waitingForAudio(read: {
        try await store.languageTest(goalID: goalID, attemptID: attemptID)
      }),
      case .question(_, let current, let selectsAll, let number, let total, let canStop) = phase,
      current.id == shown.id
    else {
      return
    }

    phase = .question(
      attemptID: attemptID, shown, selectsAll: selectsAll, number: number, total: total,
      canStop: canStop)
  }

  private func waitForTestOut(_ view: LevelTestOut) async {
    while case .testOutPreparing = phase, !Task.isCancelled {
      try? await Task.sleep(for: .seconds(3))

      if let read = try? await store.levelTestOut(goalID: goalID, attemptID: view.attemptId),
        case .testOutPreparing = phase
      {
        phase = LanguageTestPhase(testOut: read)
      }
    }
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

  /// Leaves the test: onboarding goes on with setup, the plan goes back to itself. Onboarding's
  /// step takes a course's attempt only, so the level test goes on without one.
  private func leave() async throws {
    if let onOnboardingDone {
      try await goOnUnlessLeft { try await onOnboardingDone(nil) }
    } else {
      try await goOnUnlessLeft(onDone)
    }
  }

  /// The accepted start, which opens the test or goes on with the open one.
  private func start() async throws {
    let test = try await store.startLanguageTest(goalID: goalID)
    total = test.total

    guard let attemptID = test.attemptId else {
      throw APIError.unavailable
    }

    if let result = test.result, result.attemptId == attemptID {
      phase = .result(result)
      return
    }

    guard test.status == .ready else {
      // The learner's Start joins the run writing the questions, so the wait can follow it.
      let generationID = try? await store.prepareLevelTest(goalID: goalID)
      phase = .preparing(attemptID: attemptID, generationID: generationID)

      if generationID == nil {
        _ = await read(attemptID: attemptID)
      }
      return
    }

    try await show(test, attemptID: attemptID)
  }

  /// A test that asks nothing more closes in the same save.
  private func show(_ test: LevelTest, attemptID: String) async throws {
    if let next = LanguageTestPhase(test, attemptID: attemptID) {
      shownAt = .now
      phase = next
    } else if test.status == .ready {
      phase = .finish(attemptID: attemptID)
      try await finish(attemptID)
    }
  }

  private func finish(
    _ attemptID: String, completion: LanguageTestPhase.Completion = .levelTest
  ) async throws {
    switch completion {
    case .levelTest:
      do {
        let result = try await store.finishLanguageTest(goalID: goalID, attemptID: attemptID)
        undoRequest.leave()
        phase = .result(result)
      } catch is CancellationError {
        throw CancellationError()
      } catch {
        phase = .finish(attemptID: attemptID)
        failed = true
      }
    case .testOut:
      phase = LanguageTestPhase(
        testOut: try await store.finishLevelTestOut(goalID: goalID, attemptID: attemptID))
    }
  }

  /// `defersAudio`: "Can't listen now", which ends listening without scoring the question; the
  /// test goes straight to its result.
  private func answer(
    _ question: LevelTest.Question, attemptID: String, with answer: PracticeAnswer, skips: Bool,
    defersAudio: Bool = false
  ) {
    guard !isAnswering, pressed == nil else {
      return
    }

    isAnswering = true
    let sent = SentAnswer(
      answer: answer, sender: answer.isDontKnow ? .notSure : .check,
      measuredMs: Int(shownAt.duration(to: .now).components.seconds * 1000), failed: failedAnswer)

    tasks.run {
      defer { isAnswering = false }

      do {
        let skipped = if skips, case .dontKnow = answer { true } else { false }
        let test = try await store.answerLevelTest(
          goalID: goalID, questionID: question.id, answerIndex: answer.levelTestIndex,
          answerIndices: answer.levelTestIndices, skipped: skipped, audioDeferred: defersAudio,
          duration: .milliseconds(sent.durationMs), attemptID: attemptID)
        answerFailures = 0
        failedAnswer = nil
        try await show(test, attemptID: attemptID)
      } catch is CancellationError {
      } catch {
        failedAnswer = sent
        answerFailures += 1
      }
    }
  }

  private func testOut() {
    guard let testOutLevel else {
      return
    }

    save(.other) {
      undoRequest.leave()
      phase = LanguageTestPhase(
        testOut: try await store.startLevelTestOut(goalID: goalID, level: testOutLevel))
    }
  }

  private func answerTestOut(
    _ answer: PracticeAnswer, view: LevelTestOut, question: PracticeQuestion
  ) {
    guard !isAnswering else {
      return
    }

    isAnswering = true
    let sent = SentAnswer(
      answer: answer, sender: answer.isDontKnow ? .notSure : .check,
      measuredMs: Int(shownAt.duration(to: .now).components.seconds * 1000), failed: failedAnswer)

    tasks.run {
      defer { isAnswering = false }

      do {
        let answered = try await store.answerLevelTestOut(
          goalID: goalID, attemptID: view.attemptId, itemID: question.itemId, answer: answer,
          duration: .milliseconds(sent.durationMs))
        answerFailures = 0
        failedAnswer = nil
        phase = LanguageTestPhase(testOut: answered)
        if case .finish(let attemptID, let completion) = phase {
          isAnswering = false
          save(.main) { try await finish(attemptID, completion: completion) }
        }
      } catch is CancellationError {
      } catch {
        failedAnswer = sent
        answerFailures += 1
      }
    }
  }

  private func stopTestOut(_ view: LevelTestOut) {
    guard !isAnswering else {
      return
    }

    isAnswering = true

    tasks.run {
      defer { isAnswering = false }

      do {
        try await finish(view.attemptId, completion: .testOut)
        answerFailures = 0
      } catch is CancellationError {
      } catch {
        answerFailures += 1
      }
    }
  }
}

/// A language's level test and its level test-outs, taken from the plan.
struct LevelTestScreen: View {
  let goalId: String
  var testOutFirst = false

  @Environment(\.dismiss) private var dismiss
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var plans
  @Environment(SessionStore.self) private var session
  @State private var leaving: AnalyticsEvent?

  var body: some View {
    let plan = plans.plan(goalId: goalId)
    let standing = plans.languageStanding(goalId: goalId)

    NavigationStack {
      Group {
        switch standing.state {
        case .loaded(let standing):
          LevelTestFlow(
            goalID: goalId, targetLanguage: standing.goal.targetLanguage,
            testOutLevel: plan.value?.plan.placementTest?.nextTestOutLevel,
            testOutFirst: testOutFirst,
            onStartLesson: { lessonId in
              dismiss()
              router.open(.lesson(lessonId: lessonId))
            }
          ) {
            dismiss()
          }
          .id(session.authenticatedSession)
        case .failed(let error):
          PracticeLoadFailureView(error: error) { Task { await standing.refresh() } }
        case .empty:
          NotFoundView()
        case .idle, .loading:
          StepLoading()
        }
      }
      .onPreferenceChange(TestLeaveKey.self) { leaving = $0 }
      .navigationTitle(Text(PlacementTestCopy.languageName))
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
    .loads(plan, standing, refreshable: false)
  }
}
