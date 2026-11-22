import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class PlacementTestRenderTests: XCTestCase {
  private let goalID = "00000000-0000-4000-8000-0000000000a1"

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
    let window = try show(
      NavigationStack { content() }
        .environment(AppRouter())
        .zoonkStyles()
        .preferredColorScheme(.light))

    try await waitForTestCondition("Missing \(title) or \(detail): \(spoken(in: window))") {
      let words = spoken(in: window)
      return words.contains { $0.contains(title) } && words.contains { $0.contains(detail) }
    }
    XCTAssertFalse(spoken(in: window).contains { word in absent.contains { word.contains($0) } })

    let image = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
    }
    let attachment = XCTAttachment(image: image)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    window.isHidden = true
  }
}
