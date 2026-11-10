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
        {"profile":{"memoryEnabled":true,"questions":[]},"dateProblem":null,"examChoices":[],"examDays":null,"examSubjects":[],"firstLesson":null,"followUps":[],"generationId":"follower-run","goal":{"createdAt":"2026-11-08T00:00:00Z","dailyMinutes":15,"details":{},"examBlueprintId":null,"id":"00000000-0000-0000-0000-000000000001","isActive":true,"kind":"learn","language":"en","languageFlag":null,"plan":null,"primaryCourseId":null,"prompt":"Vaccines","status":"active","studyDays":[],"studyTime":null,"targetDate":null,"targetLanguage":null,"timezone":null,"title":"Vaccines","displayName":"Vaccines"},"goalIds":[],"languageAim":null,"libraryCourse":null,"planReadiness":{"readingNotice":false,"ready":false},"planRevealed":false,"quickTestMinutes":0,"recommendedMinutes":15,"startsOnRecommended":false,"steps":[],"timeChoices":[],"warmUp":{"id":"shared-deck","status":"\#(status)"}}
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
