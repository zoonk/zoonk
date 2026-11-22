import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class PlacementTestRenderTests: XCTestCase {
  private let goalID = "00000000-0000-4000-8000-0000000000a1"

  func testStopAppearsOnlyOnceAnAnswerIsSaved() async throws {
    let question = PracticeQuestion(
      itemId: goalID, format: .multipleChoice, question: "Which fraction is smaller?",
      options: ["1/2", "1/3"])

    for number in 1...2 {
      try await capture(
        "placement-question-\(number)", title: "Question \(number)",
        detail: number == 1 ? "Which fraction is smaller?" : "Stop and use my answers",
        absent: number == 1 ? ["Stop and use my answers"] : []
      ) {
        PlacementQuestionScreen(
          subject: "Fractions", number: number, progress: Double(number - 1) / 4,
          question: question, labels: .trueFalse, isSaving: false, failures: 0,
          onReport: {}, onAnswer: { _ in }, onStop: {})
      }
    }
  }

  func testBackFromLanguageResultReturnsToThePreviousQuestionWithoutWriting() async throws {
    let server = LevelTestBackServer(goalID: goalID)
    let dependencies = AppDependencies(
      clients: APIClientFactory(baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live())
    let store = dependencies.onboardingStore
    let onboarding = store.onboarding(goalID: goalID)
    await onboarding.load()
    XCTAssertEqual(try XCTUnwrap(onboarding.value).steps.first, .placement)
    let result = try await store.languageTest(goalID: goalID)
    XCTAssertEqual(result.result?.attemptId, result.attemptId)

    try await readsWhatVoiceOverReads()
    let window = try show(
      GoalSetupScreen(goalId: goalID)
        .appDependencies(dependencies)
        .environment(AppRouter())
        .zoonkStyles())

    try await waitForTestCondition("The saved language result did not open: \(spoken(in: window))")
    {
      spoken(in: window).contains { $0.contains("Your English level") }
    }
    let back = try XCTUnwrap(
      requestViews(UIView.self, in: window)
        .filter { $0.accessibilityLabel == "Back" }
        .lazy.compactMap { self.requestViews(UIControl.self, in: $0).first }.first)
    back.sendActions(
      for: back.allControlEvents.contains(.primaryActionTriggered)
        ? .primaryActionTriggered : .touchUpInside)
    try await waitForTestCondition(
      "Back did not return to the previous question: \(spoken(in: window))"
    ) {
      spoken(in: window).contains { $0.contains("How much do you already know?") }
    }
    let writes = await server.writes
    XCTAssertEqual(writes, [])
  }

  func testLengthChoiceAndResult() async throws {
    try await capture(
      "placement-length", title: "Skip what you already know",
      detail: "How much do you want to check?"
    ) {
      PlacementLengthChoice(
        wholeCourseMinutes: 25, isSaving: false, failed: false, onSkip: {}, onStart: { _ in })
    }

    let request = VisitRequest<Bool>()
    let store = PlanStore(api: PlanAPIStub(), cache: AppCache(session: .preview()))
    let undo = PlacementResultUndo(
      goalId: goalID, changeId: goalID, lessons: 6, request: request, plans: store, disabled: false)
    try await capture("placement-result", title: "6 lessons skipped", detail: "Fractions") {
      PlacementTestResultView(
        length: .quick, lessonsSkipped: 6, nextTopic: "Fractions", isSaving: false, failed: false,
        undo: undo, onDone: {})
    }
  }

  func testListeningQuestion() async throws {
    let session = SessionStore.preview()
    let cache = AppCache(session: session)
    let clients = APIClientFactory.live(baseURL: URL(string: "https://api.zoonk.test")!)
    try await capture(
      "placement-listening", title: "Question 2", detail: "Play the message",
      absent: ["Fine-tuning your plan"]
    ) {
      LevelTestQuestionScreen(
        question: .init(
          id: goalID, options: ["Monday", "Tuesday"], passage: "The train leaves on Monday.",
          question: "When does the train leave?", skill: .listening, audio: nil, audioPending: false
        ),
        number: 2, progress: 0.25, targetLanguage: "en", isSaving: false, failures: 0,
        onReport: {}, onAnswer: { _, _ in }, onStop: {}
      )
      .environment(VoiceServices(clients: clients, cache: cache))
    }
  }

  func testOrderQuestionWithStepsSelected() async throws {
    try await capture(
      "placement-order", title: "Tap the steps in order.", detail: "Boil the water"
    ) {
      OrderItemView(
        steps: ["Boil the water", "Add the pasta", "Drain the pasta"], result: nil,
        isLocked: false, draft: .constant(.order([0, 1]))
      )
      .padding()
    }
  }

  func testRetakeHeldUntilTomorrow() async throws {
    try await capture(
      "placement-retake-tomorrow", title: "No lessons skipped",
      detail: "You undid these today. Answer again tomorrow to skip them.",
      absent: ["Your plan stays as it is."]
    ) {
      PlacementTestResultView(
        length: .quick, lessonsSkipped: 0, nextTopic: "Fractions", isSaving: false, failed: false,
        heldUntilTomorrow: true, onDone: {})
    }
  }

  func testRetakeThatSkipsOtherLessonsSaysWhatItSkipped() async throws {
    try await capture(
      "placement-retake-skipped-others", title: "23 lessons skipped",
      detail: "You already know them. They stay in your practice.",
      absent: ["You undid these today. Answer again tomorrow to skip them."]
    ) {
      PlacementTestResultView(
        length: .quick, lessonsSkipped: 23, nextTopic: "Fractions", isSaving: false,
        failed: false, heldUntilTomorrow: true, onDone: {})
    }
  }

  func testPlanShowsTheTestedSkillRanges() async throws {
    let standing = LanguageStanding(
      goal: .init(targetLanguage: "en"), level: .init(label: "B2+", target: "C1"), levels: [])
    let api = PlanAPIStub()
    await api.setLanguageStanding(standing)
    let store = PlanStore(api: api, cache: AppCache(session: .preview(account: .planTestAccount)))
    await store.languageStanding(goalId: goalID).load()

    var result = PlacementTestResult(finishedAt: .now, lessonsSkipped: 0)
    result.ranges = [
      "reading": LevelRange(high: "B2", low: "B1"),
      "listening": LevelRange(high: "B1", low: "A2"),
    ]
    var plan = try goalPlanFixture()
    plan.placementTest = PlanPlacementTest(
      attempt: nil, estimatedMinutes: 20, kind: .language, result: result, state: .result)
    let goal = LearnerGoal(
      dailyMinutes: 30, id: goalID, kind: .language, language: "en", status: .active,
      targetDate: nil, displayName: "English", title: "English")
    let context = PlanContext(goal: goal, plan: plan, adjust: { _ in }, show: { _ in })
    try await capture(
      "plan-skill-ranges", title: "English level", detail: "Reading B1–B2 · Listening A2–B1",
      absent: ["B2+ → C1"]
    ) {
      ZoonkList {
        PlanNumbersSection(context: context, syllabus: nil)
      }
      .environment(store)
    }
  }

  func testResultsAfterUndo() async throws {
    let undo = try restored()
    let result = LevelTestOut.Result(changeId: goalID, finishedAt: .now, lessonsSkipped: 6)
    let testOut = LevelTestOut(
      answered: 8, attemptId: goalID, level: "B2", next: nil, preparing: false, result: result,
      total: 8)

    try await capture("placement-undo", title: "No lessons skipped", detail: "back in your plan") {
      PlacementTestResultView(
        length: .quick, lessonsSkipped: 6, nextTopic: "Fractions", isSaving: false, failed: false,
        undo: undo, onDone: {})
    }
    try await capture(
      "placement-part-undo", title: "No lessons skipped", detail: "back in your plan"
    ) {
      PlacementBetweenParts(
        lessonsSkipped: 6, minutesLeft: 25, pressed: nil, failed: false, onKeepGoing: {},
        undo: undo,
        onFinishForToday: {})
    }
    try await capture(
      "placement-level-undo", title: "No lessons skipped", detail: "back in your plan"
    ) {
      LanguageTestResultView(
        length: .quick, result: .init(finishedAt: .now, lessonsSkipped: 6), targetLanguage: "en",
        testOutLevel: "B2", pressed: nil, failed: false, undo: undo, onContinue: {}, onTestOut: {})
    }
    try await capture(
      "placement-test-out-undo", title: "No lessons skipped", detail: "back in your plan"
    ) {
      LevelTestOutResult(view: testOut, isSaving: false, failed: false, undo: undo, onDone: {})
    }
  }

  func testTestOutWithoutQuestions() async throws {
    let testOut = LevelTestOut(
      answered: 0, attemptId: goalID, level: "B2", next: nil, preparing: false, result: nil,
      total: 0)
    try await capture(
      "placement-unavailable-b2", title: "B2 stays in your plan",
      detail: "There aren't enough questions for B2 yet."
    ) {
      LevelTestOutResult(view: testOut, isSaving: false, failed: false, onDone: {})
    }
  }

  func testWaitForAnExistingPlan() async throws {
    let session = SessionStore.preview()
    let cache = AppCache(session: session)
    let clients = APIClientFactory.live(baseURL: URL(string: "https://api.zoonk.test")!)
    try await capture(
      "placement-plan-wait", title: "Getting your test ready", detail: "Writing your questions",
      absent: ["Reading your goal", "Choosing what to learn"]
    ) {
      PlacementWaitScreen(
        onboarding: nil, goalID: goalID, run: GenerationWait(kind: .placementQuestions).started,
        failure: nil, holding: nil, isActing: false,
        skip: .init(label: Text("Not now"), note: nil, isBusy: false, failed: false, action: {}),
        onRetry: { _ in }
      )
      .environment(session)
      .environment(WaitVisit(surface: .placementWait))
      .environment(WarmUpStore(api: WarmUpAPI(clients: clients), cache: cache))
      .environment(OnboardingStore(clients: clients, cache: cache, session: session))
    }
  }

  private func restored() throws -> PlacementResultUndo {
    let request = VisitRequest<Bool>()
    request.outcome = true
    let store = PlanStore(api: PlanAPIStub(), cache: AppCache(session: .preview()))
    return try XCTUnwrap(
      PlacementResultUndo(
        goalId: goalID, changeId: goalID, lessons: 6, request: request, plans: store,
        disabled: false))
  }

  private func capture(
    _ name: String, title: String, detail: String, absent: [String] = [],
    @ViewBuilder content: () -> some View
  ) async throws {
    try await readsWhatVoiceOverReads()
    for scheme in [ColorScheme.light, .dark] {
      let window = try show(
        NavigationStack { content() }
          .environment(AppRouter())
          .zoonkStyles()
          .preferredColorScheme(scheme))

      try await waitForTestCondition(
        "Missing \(title) or \(detail): \(spoken(in: window) + spokenValues(in: window))"
      ) {
        let words = spoken(in: window) + spokenValues(in: window)
        return words.contains { $0.contains(title) } && words.contains { $0.contains(detail) }
      }
      let words = spoken(in: window) + spokenValues(in: window)
      XCTAssertFalse(words.contains { word in absent.contains { word.contains($0) } })

      let image = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in
        window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
      }
      let attachment = XCTAttachment(image: image)
      attachment.name = "\(name)-\(scheme == .dark ? "dark" : "light")"
      attachment.lifetime = .keepAlways
      add(attachment)
      window.isHidden = true
    }
  }
}

private actor LevelTestBackServer: ClientTransport {
  let goalID: String
  private(set) var writes: [String] = []

  init(goalID: String) { self.goalID = goalID }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    if request.method != .get {
      writes.append(operationID)
    }

    let payload: String
    switch operationID {
    case "getOnboarding":
      payload = #"""
        {"profile":{"memoryEnabled":true,"questions":[]},"contentCountry":{"defaultCountry":{"code":"US","name":"United States"},"suggested":[]},"dateProblem":null,"examChoices":[],"examDays":null,"examSubjects":[],"firstLesson":null,"followUps":[],"generationId":null,"goal":{"contentCountry":null,"countryDependent":false,"createdAt":"2026-11-08T00:00:00.000Z","dailyMinutes":15,"details":{"answered":["level","followUps"]},"examBlueprintId":null,"examCountry":null,"examplesCountry":null,"id":"\#(goalID)","isActive":true,"kind":"language","language":"en","languageCountry":{"code":"US","name":"United States"},"languageFlag":null,"plan":null,"primaryCourseId":null,"prompt":"Learn English","regionChoices":[],"status":"active","studyDays":[],"studyTime":null,"suggested":[],"targetDate":null,"targetLanguage":"en","targetRegion":null,"timezone":null,"title":"Learn English","displayName":"Learn English"},"goalIds":[],"languageAim":null,"libraryCourse":null,"planReadiness":{"readingNotice":false,"ready":false},"planRevealed":false,"quickTestMinutes":4,"recommendedMinutes":15,"startsOnRecommended":false,"steps":["placement","plan"],"timeChoices":[],"warmUp":null}
        """#
    case "getGoalPlacement":
      payload =
        #"{"answered":0,"areas":[],"complete":false,"dayBudgetSpent":0,"dayBudgetUsed":false,"knownSkillIds":[],"needsItems":[],"next":null,"phases":[],"started":false,"status":"unavailable","trueFalseLabels":"trueFalse","focusTest":null}"#
    case "getLanguageLevelTest":
      payload = #"""
        {"status":"ready","answered":4,"lastCorrect":null,"levels":[],"next":{"kind":"done"},"showAlphabetNote":false,"targetLanguage":"en","total":4,"attemptId":"\#(goalID)","length":"quick","result":{"attemptId":"\#(goalID)","finishedAt":"2026-11-21T16:23:39.000Z","lessonsSkipped":0,"levelsSkipped":[],"ranges":{"reading":{"low":"A2","high":"B1"}}}}
        """#
    default: return (HTTPResponse(status: .notFound), nil)
    }

    var response = HTTPResponse(status: .ok)
    response.headerFields[.contentType] = "application/json"
    return (response, HTTPBody(payload))
  }
}
