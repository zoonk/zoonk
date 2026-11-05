import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

@MainActor
final class CheckpointCallTests: XCTestCase {
  func testACallOpenedAgainShowsWhatTheServerSaysNow() async {
    let transport = CheckpointCallTransport(bodies: [
      #"{"status":"earlierFirst","reason":"lessons"}"#,
      #"{"status":"preparing","unitTitle":"At the café"}"#,
    ])
    let voice = VoiceServices(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: transport),
      cache: AppCache(session: .preview(account: .checkpointCallTestFixture)))

    let first = voice.checkpointCall(blockId: Self.blockId)
    await first.show()
    guard case .earlierFirst? = first.value else {
      return XCTFail("the first open didn't read earlier blocks first")
    }

    let reopened = voice.checkpointCall(blockId: Self.blockId)
    XCTAssertNil(reopened.value, "the reopened call had the last open's status to act on")
    await reopened.show()
    guard case .preparing(let preparing)? = reopened.value else {
      return XCTFail("the reopened call didn't show the server's status")
    }
    XCTAssertEqual(preparing.unitTitle, "At the café")
  }

  private static let blockId = "4f0f2a62-55a1-4c55-9f7e-0f7a7f9d5a10"
}

private actor CheckpointCallTransport: ClientTransport {
  private var bodies: [String]

  init(bodies: [String]) {
    self.bodies = bodies
  }

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    (
      HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
      HTTPBody(bodies.removeFirst())
    )
  }
}

extension CurrentAccount {
  fileprivate static let checkpointCallTestFixture = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "checkpoint-call-test-user",
      image: nil, name: "Learner", username: "learner"))
}
