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

  func testAnEditSavedWhileTheShownCardWasBeingReadReadsItAgain() async throws {
    let server = DraftServer(Self.draft(prompt: "Spanish", goalsLeft: 2))
    let store = makeStore(transport: server)
    let card = store.draft(id: Self.draftID)
    card.beginViewing()
    defer { card.endViewing() }
    await card.load()

    await server.holdNextEdit(answering: Self.draft(prompt: "Spanish, fixed", goalsLeft: 2))
    let saving = Task {
      try await store.revise(draftID: Self.draftID, field: .displayName, goal: 0, value: "Fixed")
    }
    await server.waitForHeldEdit()
    // Meanwhile another goal took a free slot, and the shown card started reading its draft again.
    await server.serve(Self.draft(prompt: "Spanish, fixed", goalsLeft: 1))
    await server.holdNextRead()
    card.invalidate()
    await server.waitForHeldRead()
    await server.releaseHeldEdit()
    try await saving.value
    let readAgain = await server.waitForReadAfterEdit()
    await server.releaseHeldRead()
    await card.load()

    XCTAssertTrue(readAgain, "The edit doesn't drop the read it replaced")
    XCTAssertEqual(card.value, Self.draft(prompt: "Spanish, fixed", goalsLeft: 1))
  }

  /// Back to a draft whose goal was just made, before its read: the card offers no second create,
  /// so the draft makes one goal.
  func testADraftReadAgainAfterItsGoalWasMadeOffersNoSecondCreate() async throws {
    let server = DraftServer(Self.draft(prompt: "Why is the sky blue?", goalsLeft: 2))
    let store = makeStore(transport: server)
    let card = store.draft(id: Self.draftID)
    await card.load()
    let shown = try XCTUnwrap(card.value)
    var made: String?

    await DraftCreation().create(from: card) {
      try await store.createExplanation(draft: shown, question: "Why?")
    } then: {
      made = $0
    }?.value

    // A new visit to the draft before its read says the goal is made.
    let second = DraftCreation().create(from: card) {
      try await store.createExplanation(draft: shown, question: "Why?")
    } then: { _ in
    }
    let creates = await server.creates

    XCTAssertNotNil(made)
    XCTAssertNil(second, "the stale card offers no create")
    XCTAssertEqual(creates, 1)
  }

  /// A read after the create that names its goal leads to the goal's setup, and offers no create.
  func testADraftReadThatNamesItsGoalOffersNoCreate() async throws {
    let server = DraftServer(Self.draft(prompt: "Why is the sky blue?", goalsLeft: 2))
    let store = makeStore(transport: server)
    let card = store.draft(id: Self.draftID)
    await card.load()
    let shown = try XCTUnwrap(card.value)

    await DraftCreation().create(from: card) {
      try await store.createExplanation(draft: shown, question: "Why?")
    } then: { _ in
    }?.value
    await server.serve(
      Self.draft(prompt: "Why is the sky blue?", goalsLeft: 1, goalID: Self.goalID))
    await card.load()

    let again = DraftCreation().create(from: card) {
      try await store.createExplanation(draft: shown, question: "Why?")
    } then: { _ in
    }
    let creates = await server.creates

    XCTAssertEqual(card.freshValue?.goalId, Self.goalID, "the card goes on with the goal's setup")
    XCTAssertNil(again)
    XCTAssertEqual(creates, 1)
  }

  private func makeStore(transport: some ClientTransport) -> OnboardingStore {
    let session = SessionStore.preview(account: .onboardingStoreTest)
    return OnboardingStore(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: transport),
      cache: AppCache(session: session), session: session)
  }

  private static let draftID = "00000000-0000-4000-8000-0000000000d1"

  private static let goalID = "00000000-0000-4000-8000-0000000000a1"

  private static func draft(prompt: String, goalsLeft: Int, goalID: String? = nil)
    -> OnboardingDraft
  {
    OnboardingDraft(
      activeGoalsLeft: goalsLeft, generationId: nil, goalId: goalID, id: draftID, prompt: prompt,
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
        {"profile":{"memoryEnabled":true,"questions":[]},"contentCountry":{"defaultCountry":{"code":"US","name":"United States"},"suggested":[]},"dateProblem":null,"examChoices":[],"examDays":null,"examSubjects":[],"firstLesson":null,"followUps":[],"generationId":"follower-run","goal":{"contentCountry":null,"countryDependent":false,"createdAt":"2026-11-08T00:00:00Z","dailyMinutes":15,"details":{},"examBlueprintId":null,"examCountry":null,"examplesCountry":null,"id":"00000000-0000-0000-0000-000000000001","isActive":true,"kind":"learn","language":"en","languageCountry":{"code":"US","name":"United States"},"languageFlag":null,"plan":null,"primaryCourseId":null,"prompt":"Vaccines","regionChoices":[],"status":"active","studyDays":[],"suggested":[],"studyTime":null,"targetDate":null,"targetLanguage":null,"targetRegion":null,"timezone":null,"title":"Vaccines","displayName":"Vaccines"},"goalIds":[],"languageAim":null,"libraryCourse":null,"planReadiness":{"readingNotice":false,"ready":false},"planRevealed":false,"quickTestMinutes":0,"recommendedMinutes":15,"startsOnRecommended":false,"steps":[],"timeChoices":[],"warmUp":{"id":"shared-deck","status":"\#(status)"}}
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

/// Answers draft reads with the draft it serves now. A held edit or read waits to answer until
/// released, so another request can land meanwhile.
actor DraftServer: ClientTransport {
  enum CreateAnswer {
    case created
    case refused
    case unavailable
  }

  private var served: OnboardingDraft
  private var editAnswer: OnboardingDraft?
  private var heldEdit: CheckedContinuation<Void, Never>?
  private var editsFail = false
  private var holdsRead = false
  private var heldRead: CheckedContinuation<Void, Never>?
  private var editAnswered = false
  private var readsAfterEdit = 0
  private(set) var creates = 0
  private(set) var reads = 0
  private var createAnswer = CreateAnswer.created
  private var holdsCreate = false
  private var heldCreate: CheckedContinuation<Void, Never>?

  init(_ draft: OnboardingDraft) {
    served = draft
  }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var answer = served

    if operationID == "getGoalUnderstanding" {
      reads += 1

      if editAnswered {
        readsAfterEdit += 1
      }

      if holdsRead {
        holdsRead = false
        await withCheckedContinuation { heldRead = $0 }
      }
    }

    if operationID == "createGoals" {
      creates += 1

      if holdsCreate {
        holdsCreate = false
        await withCheckedContinuation { heldCreate = $0 }
      }

      switch createAnswer {
      case .created: break
      case .refused:
        return (
          HTTPResponse(status: .tooManyRequests, headerFields: [.contentType: "application/json"]),
          HTTPBody(#"{"error":{"code":"SLOW_DOWN","message":"Slow down"}}"#)
        )
      case .unavailable:
        return (HTTPResponse(status: .internalServerError), nil)
      }

      return (
        HTTPResponse(status: .created, headerFields: [.contentType: "application/json"]),
        HTTPBody(
          #"{"generations":[],"goals":[\#(createdGoal)],"refused":[],"research":[]}"#)
      )
    }

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
    editAnswered = true
    heldEdit?.resume()
    heldEdit = nil
  }

  func answerCreates(_ answer: CreateAnswer) {
    createAnswer = answer
  }

  func holdNextCreate() {
    holdsCreate = true
  }

  func waitForHeldCreate() async {
    while heldCreate == nil {
      await Task.yield()
    }
  }

  func releaseHeldCreate() {
    heldCreate?.resume()
    heldCreate = nil
  }

  func holdNextRead() {
    holdsRead = true
  }

  func waitForHeldRead() async {
    while heldRead == nil {
      await Task.yield()
    }
  }

  func releaseHeldRead() {
    heldRead?.resume()
    heldRead = nil
  }

  /// False when no read starts within two seconds of the held edit's answer.
  func waitForReadAfterEdit() async -> Bool {
    for _ in 0..<200 where readsAfterEdit == 0 {
      try? await Task.sleep(for: .milliseconds(10))
    }

    return readsAfterEdit > 0
  }

  func failEdits() {
    editsFail = true
  }
}

extension CurrentAccount {
  static let onboardingStoreTest = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "onboarding-store-test-user",
      image: nil, name: "Learner", username: "learner"))
}

/// The client reads dates with fractional seconds, as the API writes them.
private let createdGoal =
  #"{"contentCountry":null,"countryDependent":false,"createdAt":"2026-11-08T00:00:00.000Z","dailyMinutes":15,"details":{},"examBlueprintId":null,"examCountry":null,"examplesCountry":null,"id":"00000000-0000-0000-0000-000000000001","isActive":true,"kind":"learn","language":"en","languageCountry":{"code":"US","name":"United States"},"languageFlag":null,"plan":null,"primaryCourseId":null,"prompt":"Vaccines","regionChoices":[],"status":"active","studyDays":[],"suggested":[],"studyTime":null,"targetDate":null,"targetLanguage":null,"targetRegion":null,"timezone":null,"title":"Vaccines","displayName":"Vaccines"}"#
