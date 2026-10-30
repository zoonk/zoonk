import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

@MainActor
final class GoalContentStoreTests: XCTestCase {
  func testAPracticeAnsweredAfterItsLearnerLeftChangesNothing() async throws {
    let transport = HeldPracticeTransport()
    let cache = AppCache(session: .preview(account: .goalContentTestFixture))
    let store = GoalContentStore(
      api: GoalContentAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport)),
      cache: cache)

    let practicing = Task { await store.practice(goalId: "g1", areaId: "c1") }
    await transport.waitForHeldRequest()
    await cache.session.expire(try XCTUnwrap(cache.session.authenticatedSession))
    await transport.release()
    let result = await practicing.value

    guard case .obsolete = result else {
      return XCTFail("the next learner's chapter must not show the last one's practice")
    }
  }

  func testACancelledPracticeChangesNothing() async {
    let transport = HeldPracticeTransport()
    let store = GoalContentStore(
      api: GoalContentAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport)),
      cache: AppCache(session: .preview(account: .goalContentTestFixture)))

    let practicing = Task { await store.practice(goalId: "g1", areaId: "c1") }
    await transport.waitForHeldRequest()
    practicing.cancel()
    await transport.release()
    let result = await practicing.value

    guard case .obsolete = result else {
      return XCTFail("a chapter the learner left must not open its practice")
    }
  }

  private static let baseURL = URL(string: "https://api.zoonk.test")!
}

private actor HeldPracticeTransport: ClientTransport {
  private var held: CheckedContinuation<Void, Never>?

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    await withCheckedContinuation { held = $0 }

    return (
      HTTPResponse(status: .conflict, headerFields: [.contentType: "application/json"]),
      HTTPBody(#"{"error":{"code":"EXTRA_TIME_UNAVAILABLE","message":"No more time today"}}"#)
    )
  }

  func waitForHeldRequest() async {
    while held == nil {
      await Task.yield()
    }
  }

  func release() {
    held?.resume()
    held = nil
  }
}

extension CurrentAccount {
  fileprivate static let goalContentTestFixture = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      displayUsername: "learner", email: "learner@zoonk.test", id: "goal-content-test-user",
      image: nil, name: "Learner", username: "learner"))
}
