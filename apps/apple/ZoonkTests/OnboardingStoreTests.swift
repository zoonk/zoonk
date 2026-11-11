import Foundation
import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

@MainActor
final class OnboardingStoreTests: XCTestCase {
  func testAFreshReadyDeckOverridesTheFollowingRunsEarlierFailure() async throws {
    let store = makeStore(event: #"{"status":"completed","step":"warmUpFailed"}"#)
    let followed = await store.followDeck(generationID: "follower-run")
    XCTAssertNil(followed)

    let ready = try view(status: "ready")
    XCTAssertEqual(store.waitDeck(for: ready).id, "shared-deck")
    XCTAssertFalse(store.waitDeck(for: ready).isComing)
    XCTAssertNil(store.waitDeck(for: try view(status: "writing")).id)
    XCTAssertFalse(store.waitDeck(for: try view(status: "writing")).isComing)
  }

  func testAStreamReadyDeckOverridesAnOlderWritingRead() async throws {
    let store = makeStore(
      event: #"{"status":"completed","step":"warmUpReady","warmUpId":"shared-deck"}"#)
    let followed = await store.followDeck(generationID: "follower-run")
    XCTAssertEqual(followed, "shared-deck")
    XCTAssertEqual(store.waitDeck(for: try view(status: "writing")).id, "shared-deck")
    XCTAssertFalse(store.waitDeck(for: try view(status: "writing")).isComing)
  }

  func testAnEditSavedWhileTheCardWasReadShowsTheEditAndReadsTheCardAgain() async throws {
    let server = DraftServer(Self.draft(prompt: "Spanish", goalsLeft: 2))
    let store = makeStore(transport: server)
    let card = store.draft(id: Self.draftID)
    await card.load()

    await server.holdNextEdit(answering: Self.draft(prompt: "Spanish, fixed", goalsLeft: 2))
    let saving = Task {
      try await store.revise(draftID: Self.draftID, field: .displayName, goal: 0, value: "Fixed")
    }
    await server.waitForHeldEdit()
    // Meanwhile another goal took a free slot, and a read without the fix landed.
    await server.serve(Self.draft(prompt: "Spanish", goalsLeft: 1))
    await card.refresh()
    await server.serve(Self.draft(prompt: "Spanish, fixed", goalsLeft: 1))
    await server.releaseHeldEdit()
    try await saving.value

    XCTAssertEqual(card.value?.prompt, "Spanish, fixed", "The read doesn't hide the fix")
    XCTAssertEqual(card.freshState, .loading, "The edit's room may be older than the read's")

    await card.load()

    XCTAssertEqual(card.value, Self.draft(prompt: "Spanish, fixed", goalsLeft: 1))
  }

  func testAnEditThatFailedReadsTheCardAgainInCaseItLanded() async {
    let server = DraftServer(Self.draft(prompt: "Spanish", goalsLeft: 2))
    let store = makeStore(transport: server)
    let card = store.draft(id: Self.draftID)
    await card.load()
    await server.failEdits()

    do {
      try await store.revise(draftID: Self.draftID, field: .displayName, goal: 0, value: "Fixed")
      XCTFail("The failed save is thrown")
    } catch {
      XCTAssertEqual(error as? OnboardingError, .failed(.unavailable))
    }

    XCTAssertEqual(card.freshState, .loading)
  }

  private func makeStore(transport: some ClientTransport) -> OnboardingStore {
    let session = SessionStore.preview(account: .onboardingStoreTest)
    return OnboardingStore(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: transport),
      cache: AppCache(session: session), session: session)
  }

  private static let draftID = "00000000-0000-4000-8000-0000000000d1"

  private static func draft(prompt: String, goalsLeft: Int) -> OnboardingDraft {
    OnboardingDraft(
      activeGoalsLeft: goalsLeft, generationId: nil, goalId: nil, id: draftID, prompt: prompt,
      status: .failed, timeZone: "America/Sao_Paulo", understanding: nil)
  }

  private func makeStore(event: String) -> OnboardingStore {
    let session = SessionStore.preview()
    return OnboardingStore(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!,
        transport: DeckEventTransport(event: event)),
      cache: AppCache(session: session), session: session)
  }

  private func view(status: String) throws -> GoalOnboarding {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601

    return try decoder.decode(
      GoalOnboarding.self,
      from: Data(
        #"""
        {"profile":{"memoryEnabled":true,"questions":[]},"dateProblem":null,"examChoices":[],"examDays":null,"examSubjects":[],"firstLesson":null,"followUps":[],"generationId":"follower-run","goal":{"createdAt":"2026-11-08T00:00:00Z","dailyMinutes":15,"details":{},"examBlueprintId":null,"id":"00000000-0000-0000-0000-000000000001","isActive":true,"kind":"learn","language":"en","languageFlag":null,"plan":null,"primaryCourseId":null,"prompt":"Vaccines","regionChoices":[],"status":"active","studyDays":[],"studyTime":null,"targetDate":null,"targetLanguage":null,"targetRegion":null,"timezone":null,"title":"Vaccines","displayName":"Vaccines"},"goalIds":[],"languageAim":null,"libraryCourse":null,"planReadiness":{"readingNotice":false,"ready":false},"planRevealed":false,"quickTestMinutes":0,"recommendedMinutes":15,"startsOnRecommended":false,"steps":[],"timeChoices":[],"warmUp":{"id":"shared-deck","status":"\#(status)"}}
        """#.utf8))
  }
}

private struct DeckEventTransport: ClientTransport {
  let event: String

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var headers = HTTPFields()
    if operationID == "getGeneration" {
      headers[.contentType] = "application/json"
      return (
        HTTPResponse(status: .ok, headerFields: headers),
        HTTPBody(#"{"id":"follower-run","status":"completed"}"#)
      )
    }

    headers[.contentType] = "text/event-stream"
    return (HTTPResponse(status: .ok, headerFields: headers), HTTPBody("data: \(event)\n\n"))
  }
}

/// Answers draft reads with the draft it serves now. A held edit waits to answer until released, so
/// a read can land meanwhile.
private actor DraftServer: ClientTransport {
  private var served: OnboardingDraft
  private var editAnswer: OnboardingDraft?
  private var heldEdit: CheckedContinuation<Void, Never>?
  private var editsFail = false

  init(_ draft: OnboardingDraft) {
    served = draft
  }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var answer = served

    if operationID == "reviseGoalUnderstanding" {
      if editsFail {
        return (HTTPResponse(status: .internalServerError), nil)
      }

      if let editAnswer {
        await withCheckedContinuation { heldEdit = $0 }
        answer = editAnswer
      }
    }

    return (
      HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
      HTTPBody(try JSONEncoder().encode(answer))
    )
  }

  func serve(_ draft: OnboardingDraft) {
    served = draft
  }

  func holdNextEdit(answering draft: OnboardingDraft) {
    editAnswer = draft
  }

  func waitForHeldEdit() async {
    while heldEdit == nil {
      await Task.yield()
    }
  }

  func releaseHeldEdit() {
    heldEdit?.resume()
    heldEdit = nil
  }

  func failEdits() {
    editsFail = true
  }
}

extension CurrentAccount {
  fileprivate static let onboardingStoreTest = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "onboarding-store-test-user",
      image: nil, name: "Learner", username: "learner"))
}
