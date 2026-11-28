import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class PlacementTestRenderTests: XCTestCase {
  private let goalID = "00000000-0000-4000-8000-0000000000a1"

  func testCloseAsksForTheWaysOutOnlyOnceStoppingGivesAResult() async throws {
    let question = PracticeQuestion(
      itemId: goalID, format: .multipleChoice, question: "Which fraction is smaller?",
      options: ["1/2", "1/3"])
    try await readsWhatVoiceOverReads()

    for number in 1...2 {
      var left = 0
      let window = try show(
        NavigationStack {
          PlacementQuestionScreen(
            subject: "Fractions", number: number, total: 8, question: question,
            labels: .trueFalse, isSaving: false, failures: 0, onReport: {}, onAnswer: { _ in },
            onStop: {}
          )
          .testTask(name: Text(verbatim: "Test what you know")) { left += 1 }
        }
        .environment(AppRouter())
        .zoonkStyles())

      try await waitForTestCondition("Missing the task's top: \(spoken(in: window))") {
        spoken(in: window).contains("Fractions")
          && spoken(in: window).contains("Question \(number) of 8")
      }
      XCTAssertFalse(
        spoken(in: window).contains { $0.contains("Stop and use my answers") },
        "Stopping lives behind ✕, never under the options")

      try await pressBarButton("Close", in: window)

      if number == 1 {
        XCTAssertEqual(left, 1, "Before stopping gives a result, ✕ just leaves")
        XCTAssertNil(presentedAlert(in: window))
      } else {
        try await waitForTestCondition("✕ didn't ask for the ways out") {
          presentedAlert(in: window) != nil
        }
        let titles = presentedAlert(in: window)?.actions.compactMap(\.title) ?? []
        XCTAssertTrue(titles.contains("Finish later"), "\(titles)")
        XCTAssertTrue(titles.contains("Stop and use my answers"), "\(titles)")
        XCTAssertEqual(left, 0, "Asking leaves nothing yet")
        presentedAlert(in: window)?.dismiss(animated: false)
      }

      window.isHidden = true
    }
  }

  func testTheFocusTestsHintComesWithItsWaysOut() async throws {
    let question = PracticeQuestion(
      itemId: goalID, format: .multipleChoice, question: "Which fraction is smaller?",
      options: ["1/2", "1/3"])
    let hint = LocalizedStringResource(
      "Haven't studied most of this yet? That's fine. You can stop here and start learning.",
      table: "FocusTest")
    try await readsWhatVoiceOverReads()
    let window = try show(
      NavigationStack {
        PlacementQuestionScreen(
          subject: "Fractions", number: 3, total: 6, question: question, labels: .trueFalse,
          isSaving: false, failures: 0, stopHint: hint, onReport: {}, onAnswer: { _ in },
          onStop: {}
        )
        .testTask(name: Text(verbatim: "Focus test")) {}
      }
      .environment(AppRouter())
      .zoonkStyles())

    try await waitForTestCondition("Missing the question: \(spoken(in: window))") {
      spoken(in: window).contains("Fractions")
    }
    try await pressBarButton("Close", in: window)
    try await waitForTestCondition("✕ didn't ask for the ways out") {
      presentedAlert(in: window) != nil
    }
    let alert = try XCTUnwrap(presentedAlert(in: window))
    XCTAssertEqual(
      [alert.title, alert.message].compactMap { $0 }.joined(), String(localized: hint),
      "The hint says why stopping now is fine, over the two ways out")
    alert.dismiss(animated: false)
  }

  func testAResultsRowsAreEachReadOnce() async throws {
    var result = PlacementTestResult(finishedAt: .now, lessonsSkipped: 0)
    result.ranges = ["reading": LevelRange(high: "B2", low: "B1")]
    try await readsWhatVoiceOverReads()

    for screen in [
      AnyView(
        LanguageTestResultView(
          result: result, targetLanguage: "en", testOutLevel: nil, pressed: nil, failed: false,
          onboarding: true, onContinue: {}, onTestOut: {})),
      AnyView(
        PlacementTestResultView(
          end: Self.startedPast, onboarding: true, pressed: nil, failed: false, onDone: {})),
    ] {
      let window = try show(
        NavigationStack { screen }
          .environment(AppRouter())
          .zoonkStyles())
      try await waitForTestCondition("The result didn't show: \(spoken(in: window))") {
        spoken(in: window).contains { $0.contains("B1–B2") || $0.contains("lessons skipped") }
      }
      try await waitForLayout(in: window)
      let words = spoken(in: window)

      for said in ["B1–B2", "Not tested yet", "4 of 9 lessons skipped"] {
        let readings = words.filter { $0.contains(said) }
        XCTAssertLessThanOrEqual(
          readings.count, 1, "\(said) is read \(readings.count) times: \(words)")
      }
      window.isHidden = true
    }
  }

  func testAButtonsIconStaysBesideItsWordsWhenTheyWrap() async throws {
    try await readsWhatVoiceOverReads()
    var heights: [CGFloat] = []

    for icon in [ActionIcon.play, nil] {
      let window = try show(
        BusyButton(isBusy: false, icon: icon) {
        } label: {
          Text(verbatim: "Responder mais perguntas")
        }
        .buttonStyle(.outline)
        .controlSize(.large)
        .frame(width: 300)
        .dynamicTypeSize(.accessibility3)
        .zoonkStyles())
      try await waitForLayout(in: window)
      heights.append(
        accessibilityElements(in: window).first {
          $0.accessibilityLabel == "Responder mais perguntas"
        }?.accessibilityFrame.height ?? -1)
      window.isHidden = true
    }

    XCTAssertEqual(
      heights[0], heights[1], accuracy: 1, "The icon took a line of its own: \(heights)")
  }

  func testAListeningQuestionsSecondButtonChangesWithoutMovingConfirm() async throws {
    XCTAssertEqual(
      LevelTestQuestionScreen.listeningLabel(skips: false, heard: false), TestCopy.cantListen)
    XCTAssertEqual(
      LevelTestQuestionScreen.listeningLabel(skips: false, heard: true),
      LevelTestQuestionScreen.didntUnderstand)
    XCTAssertEqual(
      LevelTestQuestionScreen.listeningLabel(skips: true, heard: true),
      LevelTestQuestionScreen.skipQuestion)

    let question = PracticeQuestion(
      itemId: goalID, format: .multipleChoice, question: "When does the train leave?",
      options: ["Monday", "Tuesday"])
    try await readsWhatVoiceOverReads()
    var confirmEdges: [CGFloat] = []

    for label in LevelTestQuestionScreen.listeningLabels {
      let window = try show(
        PlacementQuestionScreen(
          subject: "Listening", number: 5, total: 12, groups: [4, 4, 4], question: question,
          second: QuestionSecondAction(
            label: label, steadyAmong: LevelTestQuestionScreen.listeningLabels),
          isSaving: false, failures: 0, onReport: {}, onAnswer: { _ in }, onStop: nil,
          media: { EmptyView() }
        )
        .environment(AppRouter())
        .zoonkStyles())
      let shown = String(localized: label)

      try await waitForTestCondition("Missing \(shown): \(spoken(in: window))") {
        spoken(in: window).contains(shown)
      }
      try await waitForLayout(in: window)
      confirmEdges.append(
        accessibilityElements(in: window).first { $0.accessibilityLabel == "Confirm" }?
          .accessibilityFrame.minX ?? -1)
      window.isHidden = true
    }

    XCTAssertEqual(Set(confirmEdges).count, 1, "Confirm moved: \(confirmEdges)")
  }

  func testALevelTestOffersToStopOnlyOnceStoppingSavesALevel() async throws {
    let cache = AppCache(session: SessionStore.preview())
    let clients = APIClientFactory.live(baseURL: URL(string: "https://api.zoonk.test")!)
    let reading = LevelTest.Question(
      id: goalID, options: ["Monday", "Tuesday"], passage: "The train leaves on Monday.",
      question: "When does the train leave?", skill: .reading, audio: nil, audioPending: false)
    try await readsWhatVoiceOverReads()

    for (number, canStop) in [(2, false), (5, true)] {
      var left = 0
      let window = try show(
        NavigationStack {
          LevelTestQuestionScreen(
            question: reading, number: number, total: 12, canStop: canStop,
            targetLanguage: "en", isSaving: false, failures: 0, onReport: {},
            onAnswer: { _, _ in }, onDeferAudio: {}, onStop: {}
          )
          .testTask(name: Text(verbatim: "Level test")) { left += 1 }
        }
        .environment(VoiceServices(clients: clients, cache: cache))
        .environment(AppRouter())
        .zoonkStyles())

      try await waitForTestCondition("Missing the question: \(spoken(in: window))") {
        spoken(in: window).contains("Reading")
      }
      try await pressBarButton("Close", in: window)

      if canStop {
        try await waitForTestCondition("✕ didn't ask for the ways out") {
          presentedAlert(in: window) != nil
        }
        presentedAlert(in: window)?.dismiss(animated: false)
      } else {
        XCTAssertEqual(left, 1)
        XCTAssertNil(presentedAlert(in: window))
      }

      window.isHidden = true
    }
  }

  func testOfferAndResult() async throws {
    let offer = CoursePlacementOffer(estimatedMinutes: 4, questions: 8)
    try await capture(
      "placement-offer-onboarding", title: "Where would you like to start?",
      detail: "Why companies sell shares"
    ) {
      TestOffer(
        cards: [
          TestCopy.courseCard(offer),
          TestCopy.firstLessonCard(title: "Why companies sell shares"),
        ],
        title: Text(TestCopy.whereToStart), description: Text(TestCopy.findsSkips),
        preselected: .quick,
        context: .init(goalID: goalID, test: .course, surface: .onboarding), isSaving: false,
        failed: false, onStart: { _ in })
    }

    try await capture(
      "placement-offer-plan", title: "Skip what you already know", detail: "Up to 8 questions",
      absent: ["First lesson"]
    ) {
      TestOffer(
        cards: [TestCopy.courseCard(offer)], title: Text(TestCopy.skipWhatYouKnow),
        description: Text(TestCopy.findsSkips), preselected: .quick,
        context: .init(goalID: goalID, test: .course, surface: .plan), isSaving: false,
        failed: false, onNotNow: {}, onStart: { _ in })
    }

    let request = VisitRequest<Bool>()
    let store = PlanStore(api: PlanAPIStub(), cache: AppCache(session: .preview()))
    let undo = PlacementResultUndo(
      goalId: goalID, changeId: goalID, lessons: 4, request: request, plans: store, disabled: false)
    try await capture(
      "placement-result", title: "Why prices move", detail: "4 of 9 lessons skipped"
    ) {
      PlacementTestResultView(
        end: Self.startedPast, onboarding: false, pressed: nil,
        failed: false, undo: undo, onDone: {})
    }

    try await capture(
      "placement-result-no-course", title: "Why prices move", detail: "Start lesson",
      absent: ["lessons skipped", "Up next"]
    ) {
      PlacementTestResultView(
        end: PlacementTestEnd(
          lessonsSkipped: 0, chapter: "Why prices move",
          nextLesson: .init(id: goalID, title: "News, results and expectations")),
        onboarding: false, pressed: nil, failed: false, onDone: {})
    }
  }

  func testListeningQuestion() async throws {
    let session = SessionStore.preview()
    let cache = AppCache(session: session)
    let clients = APIClientFactory.live(baseURL: URL(string: "https://api.zoonk.test")!)
    try await capture(
      "placement-listening", title: "When does the train leave?", detail: "Can't listen now",
      absent: ["You got a voice message", "Fine-tuning your plan"]
    ) {
      LevelTestQuestionScreen(
        question: .init(
          id: goalID, options: ["Monday", "Tuesday"], passage: "The train leaves on Monday.",
          question: "When does the train leave?", skill: .listening,
          audio: .init(url: URL(string: "https://api.zoonk.test/a.mp3")!, durationMs: 9000),
          audioPending: false
        ),
        number: 6, total: 12, canStop: true, targetLanguage: "en", isSaving: false, failures: 0,
        onReport: {}, onAnswer: { _, _ in }, onDeferAudio: {}, onStop: {}
      )
      .environment(VoiceServices(clients: clients, cache: cache))
    }
  }

  func testOrderQuestionWithStepsMoved() async throws {
    try await capture(
      "placement-order", title: "Drag the steps into order", detail: "2. Boil the water"
    ) {
      OrderItemView(
        question: PracticeQuestion(
          itemId: goalID, format: .order, question: "How do you cook pasta?",
          options: ["Boil the water", "Add the pasta", "Drain the pasta"]), result: nil,
        isLocked: false, draft: .constant(.order([1, 0, 2]))
      )
      .padding()
    }
  }

  func testOrderWaitsForConfirmAndSendsOriginalOptionIndexes() async throws {
    let question = PracticeQuestion(
      itemId: goalID, format: .order, question: "How do you cook pasta?",
      options: ["Boil the water", "Drain the pasta", "Add the pasta"])
    var submitted: [PracticeAnswer] = []
    try await readsWhatVoiceOverReads()
    let window = try show(
      PlacementQuestionScreen(
        subject: "Cooking", number: 1, total: 12, question: question, labels: .trueFalse,
        isSaving: false, failures: 0, onReport: {}, onAnswer: { submitted.append($0) }, onStop: {}
      )
      .environment(AppRouter())
      .zoonkStyles())

    try await activate("Confirm", in: window)
    XCTAssertEqual(submitted, [.order([0, 1, 2])])
    try await activate("3. Add the pasta", in: window)
    try await activate("2. Drain the pasta", in: window)
    XCTAssertEqual(submitted.count, 1)
    try await activate("Confirm", in: window)
    XCTAssertEqual(submitted.last, .order([0, 2, 1]))
  }

  func testLessonEndOfferAndPlanRow() async throws {
    let clients = APIClientFactory.live(baseURL: URL(string: "https://api.zoonk.test")!)
    let learner = LearnerSummaryStore(
      api: LearnerSummaryAPI(clients: clients), cache: AppCache(session: .preview()))
    let mission = StudyMission(
      detail: nil, done: 1, kind: .practice, minutes: nil, opens: nil, status: .done,
      total: 1, waitReason: nil)
    let nextMission = StudyMission(
      detail: nil, done: 0, kind: .review, minutes: nil, opens: nil, status: .todo,
      total: 1, waitReason: nil)
    let moment = DayResult(
      ceremony: nil, certificates: [],
      missionMoment: .init(
        completed: [.practice], fullMeal: .init(bonus: 50, paid: false),
        missions: [mission, nextMission]),
      reached: nil)
    try await capture(
      "level-check-offer", title: "Mission done!", detail: "Take the test"
    ) {
      ZoonkList {
        DayMomentSections(result: moment)
        Section {
          LevelCheckOfferCard(
            offer: LevelCheckOffer(goalId: goalID, kind: .quick), isDismissing: false,
            dismissFailed: false, onCheck: {}, onDismiss: {})
        }
      }
      .environment(learner)
    }

    var plan = try goalPlanFixture()
    plan.placementTest = PlanPlacementTest(
      attempt: nil, estimatedMinutes: 20, kind: .learn,
      result: PlacementTestResult(finishedAt: .now, lessonsSkipped: 1127), state: .result)
    let row = try XCTUnwrap(PlanTestRow(goalId: goalID, plan: plan))
    try await capture("plan-test-row", title: "Test what you know", detail: "1,127") {
      ZoonkList { row }
    }
  }

  func testAResultOpenedFromThePlanGoesBackWithDoneAndOffersTheTestAgain() async throws {
    var revisited = Self.startedPast
    revisited.revisited = true

    try await capture(
      "placement-result-revisited", title: "Why prices move", detail: "Take the test again",
      absent: ["Start lesson"]
    ) {
      PlacementTestResultView(
        end: revisited, onboarding: false, pressed: nil, failed: false, onRetake: {},
        onDone: {})
    }
    try await capture(
      "placement-result-revisited-nothing-to-start", title: "Why prices move", detail: "Done",
      absent: ["Take the test again", "Start lesson"]
    ) {
      PlacementTestResultView(
        end: revisited, onboarding: false, pressed: nil, failed: false, onDone: {})
    }
  }

  func testAResultThatSkippedNothingHasNoCountLine() async throws {
    let nothing = PlacementTestEnd(
      lessonsSkipped: 0, chapter: "What a stock is",
      course: PlacementCourse(
        lessons: 9,
        chapters: [
          .init(lessons: 4, done: 0, skipped: 0, start: true),
          .init(lessons: 5, done: 0, skipped: 0, start: false),
        ]),
      nextLesson: .init(id: goalID, title: "Why companies sell shares", estimatedMinutes: 5))

    try await capture(
      "placement-result-nothing-skipped", title: "What a stock is",
      detail: "Why companies sell shares", absent: ["lessons", "lessons skipped"]
    ) {
      PlacementTestResultView(
        end: nothing, onboarding: false, pressed: nil, failed: false, onDone: {})
    }
  }

  func testAFailedMessagesNoteKeepsItsSentenceAndLeavesTheRetryToTheRow() async throws {
    try await capture(
      "listening-failed-note", title: "The audio didn't play.", detail: "The audio didn't play.",
      absent: ["Try again"]
    ) {
      ListeningFailedNote(limit: nil)
    }
  }

  func testTheOffersCardsAreNamedByWhatTheyShow() async throws {
    try await readsWhatVoiceOverReads()
    let window = try show(
      NavigationStack {
        TestOffer(
          cards: [
            TestCopy.courseCard(CoursePlacementOffer(estimatedMinutes: 4, questions: 8)),
            TestCopy.firstLessonCard(title: "Why companies sell shares"),
          ],
          title: Text(TestCopy.whereToStart), description: Text(TestCopy.findsSkips),
          preselected: .quick,
          context: .init(goalID: goalID, test: .course, surface: .onboarding), isSaving: false,
          failed: false, onStart: { _ in })
      }
      .environment(AppRouter())
      .zoonkStyles())

    try await waitForTestCondition("The cards didn't show: \(spoken(in: window))") {
      spoken(in: window).contains { $0.hasPrefix("First lesson") }
    }
    let elements = accessibilityElements(in: window)
    let test = try XCTUnwrap(
      elements.first { $0.accessibilityLabel?.hasPrefix("Test") == true },
      "\(spoken(in: window))")
    let firstLesson = try XCTUnwrap(
      elements.first { $0.accessibilityLabel?.hasPrefix("First lesson") == true })

    XCTAssertTrue(test.accessibilityLabel?.contains("Up to 8 questions") == true)
    XCTAssertTrue(firstLesson.accessibilityLabel?.contains("Why companies sell shares") == true)
    XCTAssertTrue(test.accessibilityTraits.contains(.selected), "The picked card says so")
    XCTAssertFalse(firstLesson.accessibilityTraits.contains(.selected))
    XCTAssertTrue(test.accessibilityTraits.contains(.button))
  }

  func testRetakeHeldUntilTomorrow() async throws {
    try await capture(
      "placement-retake-tomorrow", title: "What a stock is",
      detail: "You undid these today. Answer again tomorrow to skip them."
    ) {
      PlacementTestResultView(
        end: PlacementTestEnd(
          lessonsSkipped: 0, heldUntilTomorrow: true, chapter: "What a stock is"),
        onboarding: false, pressed: nil, failed: false, onDone: {})
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
    let row = try XCTUnwrap(PlanTestRow(goalId: goalID, plan: plan))
    try await capture(
      "plan-skill-ranges", title: "English level", detail: "Reading B1–B2 · Listening A2–B1",
      absent: ["B2+ → C1"]
    ) {
      ZoonkList {
        PlanNumbersSection(context: context, syllabus: nil)
        row
      }
      .environment(store)
    }
    try await capture(
      "language-result-ranges", title: "Your English level", detail: "Reading B1–B2"
    ) {
      LanguageTestResultView(
        result: result, targetLanguage: "en", testOutLevel: "B2", pressed: nil, failed: false,
        onContinue: {}, onTestOut: {})
    }

    var readingOnly = PlacementTestResult(finishedAt: .now, lessonsSkipped: 0)
    readingOnly.ranges = ["reading": LevelRange(high: "B2", low: "B1")]
    try await capture(
      "language-result-listening-not-tested", title: "Not tested yet",
      detail: "You can take the test again later, from your plan."
    ) {
      LanguageTestResultView(
        result: readingOnly, targetLanguage: "en", testOutLevel: nil, pressed: nil,
        failed: false, onboarding: true, onContinue: {}, onTestOut: {})
    }
  }

  func testResultsAfterUndo() async throws {
    let undo = try restored()
    let result = LevelTestOut.Result(changeId: goalID, finishedAt: .now, lessonsSkipped: 6)
    let testOut = LevelTestOut(
      answered: 8, attemptId: goalID, level: "B2", next: nil, preparing: false, result: result,
      total: 8)

    try await capture(
      "placement-undo", title: "No lessons skipped", detail: "The lessons are back in your plan.",
      absent: ["You start here", "Why prices move", "of 9 lessons skipped"]
    ) {
      PlacementTestResultView(
        end: Self.startedPast, onboarding: false, pressed: nil,
        failed: false, undo: undo, onDone: {})
    }
    try await capture(
      "placement-level-undo", title: "No lessons skipped", detail: "back in your plan"
    ) {
      LanguageTestResultView(
        result: .init(finishedAt: .now, lessonsSkipped: 6), targetLanguage: "en",
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

  /// A result that starts the learner in the third of four chapters, past four of nine lessons.
  static let startedPast = PlacementTestEnd(
    lessonsSkipped: 4, changeId: "00000000-0000-4000-8000-0000000000a1",
    chapter: "Why prices move",
    course: PlacementCourse(
      lessons: 9,
      chapters: [
        .init(lessons: 2, done: 0, skipped: 2, start: false),
        .init(lessons: 2, done: 0, skipped: 2, start: false),
        .init(lessons: 2, done: 0, skipped: 0, start: true),
        .init(lessons: 3, done: 0, skipped: 0, start: false),
      ]),
    nextLesson: .init(
      id: "00000000-0000-4000-8000-0000000000a1", title: "News, results and expectations",
      estimatedMinutes: 5, chapter: "Why prices move"),
    attemptId: "00000000-0000-4000-8000-0000000000a1")

  private func presentedAlert(in window: UIWindow) -> UIAlertController? {
    var shown = window.rootViewController?.presentedViewController

    while let controller = shown {
      if let alert = controller as? UIAlertController {
        return alert
      }

      shown = controller.presentedViewController
    }

    return nil
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

extension XCTestCase {
  /// Presses a bar button as a tap does: the bar's control under what VoiceOver reads as `label`.
  @MainActor
  func pressBarButton(_ label: String, in window: UIWindow) async throws {
    var control: UIControl?
    try await waitForTestCondition("No bar button reads \(label): \(spoken(in: window))") {
      control =
        requestViews(UIView.self, in: window)
        .filter { $0.accessibilityLabel == label }
        .lazy.compactMap { self.requestViews(UIControl.self, in: $0).first ?? ($0 as? UIControl) }
        .first
      return control != nil
    }
    let button = try XCTUnwrap(control)
    button.sendActions(
      for: button.allControlEvents.contains(.primaryActionTriggered)
        ? .primaryActionTriggered : .touchUpInside)
  }
}
