import SwiftUI

/// What a language course's test taken from the plan shows. Main's `useLanguagePlanTest` phases.
enum LanguageTestPhase: Equatable {
  enum Completion { case levelTest, testOut }

  case loading
  case loadFailed
  case choose
  /// The test's questions are being written; `generationID` once the learner's Start joined the run.
  case preparing(attemptID: String, generationID: String?)
  case question(
    attemptID: String, LevelTest.Question, selectsAll: Bool, number: Int, progress: Double)
  case finish(attemptID: String, completion: Completion = .levelTest)
  case result(length: PlacementLength, PlacementTestResult?)
  /// A level's test-out whose questions are still being written.
  case testOutPreparing(LevelTestOut)
  case testOut(LevelTestOut, PracticeQuestion)
  case testOutResult(LevelTestOut)
  /// The whole-course test goes on through the course's topics.
  case walk(GoalPlacement)

  /// A page load goes on with an open test; otherwise the learner chooses one.
  init(opened test: LevelTest, onboarding: Bool) {
    guard let attemptID = test.attemptId, let length = test.length else {
      self = .choose
      return
    }

    if let result = test.result, result.attemptId == attemptID {
      self = onboarding ? .result(length: length, result) : .choose
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

    let answered = test.answered ?? 0
    self = .question(
      attemptID: attemptID, question, selectsAll: next.kind == "confirmation",
      number: answered + 1, progress: Double(answered) / Double(max(1, test.total ?? 1)))
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

/// A language course's level test taken from the plan: its length choice, its questions, the
/// ranges it found and its level test-outs. Main's `LanguagePlanTestFlow`.
struct LevelTestFlow: View {
  let goalID: String
  let targetLanguage: String
  let wholeCourseMinutes: Int
  /// The next level the learner can test out of; nil when none is left.
  let testOutLevel: String?
  /// Opened from a lesson's "Test out of" offer: the choice starts on the test-out.
  var testOutFirst = false
  /// The goal's name, over the whole-course walk's questions.
  let subject: String
  let nextTopic: () -> String?
  var initialTest: LevelTest?
  var generationId: String?
  var onOnboardingDone: ((String) async throws -> Void)?
  let onDone: () async throws -> Void

  @Environment(OnboardingStore.self) private var store
  @Environment(PlanStore.self) private var plans
  @State private var undoRequest = VisitRequest<Bool>()
  @State private var phase = LanguageTestPhase.loading
  /// The open test's length, which its result reads.
  @State private var length = PlacementLength.quick
  @State private var pressed: FocusTestPress?
  @State private var failed = false
  @State private var isAnswering = false
  @State private var answerFailures = 0
  @State private var failedAnswer: SentAnswer?
  @State private var shownAt = ContinuousClock.now
  @State private var showsSaveReport = false
  @State private var tasks = ScreenTasks()

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
    case .choose:
      PlacementLengthChoice(
        wholeCourseMinutes: wholeCourseMinutes, testOutLevel: testOutLevel,
        initialChoice: testOutFirst && testOutLevel != nil ? .testOut : .length(.quick),
        isSaving: pressed != nil, failed: failed
      ) { choice in
        switch choice {
        case .length(let length): save(.main) { try await start(length) }
        case .testOut: testOut()
        }
      }
    case .preparing(let attemptID, let generationID):
      preparing(attemptID: attemptID, generationID: generationID)
    case .question(let attemptID, let question, let selectsAll, let number, let progress):
      LevelTestQuestionScreen(
        question: question, selectsAll: selectsAll, number: number, progress: progress,
        targetLanguage: targetLanguage, isSaving: isAnswering || pressed != nil,
        failures: answerFailures, onReport: { showsSaveReport = true },
        onAnswer: { answer(question, attemptID: attemptID, with: $0, skips: $1) },
        onStop: { save(.other) { try await finish(attemptID) } }
      )
      .id(question.id)
      .onAppear { shownAt = .now }
      .task(id: question.id) { await waitForAudio(question, attemptID: attemptID) }
    case .finish(let attemptID, let completion):
      TestOutcome(
        title: Text("Your answers are saved", tableName: "Onboarding"),
        failureMessage: LocalizedStringResource(
          "That didn't go through. Try again in a moment.", table: "Plan"),
        isSaving: isAnswering || pressed != nil, failed: failed
      ) {
        save(.main) { try await finish(attemptID, completion: completion) }
      }
    case .result(let length, let result):
      LanguageTestResultView(
        length: length, result: result, targetLanguage: targetLanguage, testOutLevel: testOutLevel,
        pressed: pressed, failed: failed,
        undo: undo(changeId: result?.changeId, lessons: result?.lessonsSkipped ?? 0),
        onboarding: onOnboardingDone != nil
      ) {
        if length == .wholeCourse, result?.wholeCourseReady == true {
          save(.main) { try await walk() }
        } else {
          save(.main) { try await goOnUnlessLeft(onDone) }
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
        total: view.total,
        progress: view.total > 0 ? Double(view.answered) / Double(view.total) : 0,
        question: question, askedIn: "\(view.attemptId):\(question.itemId)", labels: .trueFalse,
        isSaving: isAnswering, failures: answerFailures,
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
    case .walk(let placement):
      PlacementTestFlow(
        goalID: goalID, subject: subject, wholeCourseMinutes: wholeCourseMinutes,
        nextTopic: nextTopic, initialPlacement: placement, onOnboardingDone: onOnboardingDone,
        onDone: onDone)
    }
  }

  private func undo(changeId: String?, lessons: Int) -> PlacementResultUndo? {
    PlacementResultUndo(
      goalId: goalID, changeId: changeId, lessons: lessons, request: undoRequest,
      plans: plans, disabled: pressed != nil)
  }

  private func preparing(attemptID: String, generationID: String?) -> some View {
    GenerationWaitView(
      title: LocalizedStringResource(
        "Preparing your level test", table: "Onboarding",
        comment: "Title while a language's level test questions are written"),
      description: LocalizedStringResource(
        "Getting the \(Locale.current.languageName(targetLanguage)) test ready takes a minute or two, and only this once.",
        table: "Onboarding", comment: "Why the level test waits: the language's name"),
      generationID: generationID,
      kind: .levelTestBank,
      restart: { try await store.prepareLevelTest(goalID: goalID) },
      readResult: { await read(attemptID: attemptID) },
      trailing: {
        if onOnboardingDone != nil {
          // The bar holds the way out; what skipping does is said at the end of the wait.
          Section {
            Text(
              "Your plan starts from the level you gave, and your first days fine-tune it.",
              tableName: "Onboarding", comment: "What skipping the level test does"
            )
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
            .listRowBackground(Color.clear)
          }
        }
      }
    )
    .bottomBar(note: failed && pressed == nil ? BarNote(saveFailureMessage) : nil) {
      BusyButton(isBusy: pressed == .other, icon: onOnboardingDone != nil ? .skip : nil) {
        save(.other) { try await goOnUnlessLeft(onDone) }
      } label: {
        if onOnboardingDone != nil {
          Text(
            "Skip the test", tableName: "Onboarding",
            comment: "Skips a language goal's level test")
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
      let test: LevelTest
      if let initialTest {
        test = initialTest
      } else {
        test = try await store.languageTest(goalID: goalID)
      }

      length = test.length ?? length
      if let generationId, test.status == .preparing, let attemptId = test.attemptId {
        phase = .preparing(attemptID: attemptId, generationID: generationId)
      } else {
        phase = LanguageTestPhase(opened: test, onboarding: onOnboardingDone != nil)
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
      case .question(_, let current, let selectsAll, let number, let progress) = phase,
      current.id == shown.id
    else {
      return
    }

    phase = .question(
      attemptID: attemptID, shown, selectsAll: selectsAll, number: number, progress: progress)
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

  private var saveFailureMessage: LocalizedStringResource {
    LocalizedStringResource(
      "That didn't save. Try again.", table: "Onboarding", comment: "A change couldn't be saved")
  }

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

  private func start(_ length: PlacementLength) async throws {
    let test = try await store.startLanguageTest(goalID: goalID, length: length)
    self.length = test.length ?? length

    guard let attemptID = test.attemptId else {
      throw APIError.unavailable
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
        phase = .result(length: length, result)
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

  /// The whole-course test's walk through the course's topics, from its first part.
  private func walk() async throws {
    let placement = try await store.startPlacementTest(goalID: goalID, length: .wholeCourse)
    guard placement.resumesOnboardingTopics else { throw APIError.unavailable }

    phase = .walk(placement)
  }

  private func answer(
    _ question: LevelTest.Question, attemptID: String, with answer: PracticeAnswer, skips: Bool
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
          answerIndices: answer.levelTestIndices, skipped: skipped,
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

/// A language course's level test taken from the plan, its test-outs and its whole-course walk.
struct LevelTestScreen: View {
  let goalId: String
  var testOutFirst = false

  @Environment(\.dismiss) private var dismiss
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var plans
  @Environment(SessionStore.self) private var session

  var body: some View {
    let goal = learner.summary.value?.goals.first { $0.id == goalId }
    let plan = plans.plan(goalId: goalId)
    let standing = plans.languageStanding(goalId: goalId)

    NavigationStack {
      Group {
        switch standing.state {
        case .loaded(let standing):
          LevelTestFlow(
            goalID: goalId, targetLanguage: standing.goal.targetLanguage,
            wholeCourseMinutes: plan.value?.plan.placementTest?.estimatedMinutes ?? 0,
            testOutLevel: plan.value?.plan.placementTest?.nextTestOutLevel,
            testOutFirst: testOutFirst, subject: goal?.displayName ?? "",
            nextTopic: { plan.value?.plan.nextTopic }
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
      .navigationTitle(Text(PlacementTestCopy.languageName))
      .navigationBarTitleDisplayMode(.inline)
      .testBar()
      .taskClose {
        Button(role: .close) { dismiss() }
          .leavesOnEscape()
      }
    }
    .loads(plan, standing, refreshable: false)
  }
}
