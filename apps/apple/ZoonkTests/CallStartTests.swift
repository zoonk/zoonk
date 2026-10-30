import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

@MainActor
final class CallStartTests: XCTestCase {
  func testASecondTapWhileStartingSendsNothing() async {
    let transport = HeldCallTransport()
    let voice = makeVoice(transport)
    let start = CallStart()
    let router = AppRouter()

    start.start(Self.mock, voice: voice, router: router)
    await transport.waitForHeldRequest()
    start.start(Self.mock, voice: voice, router: router)
    await transport.release()
    await waitUntilStarted(start)

    let requests = await transport.requests
    XCTAssertEqual(requests, 1)
    XCTAssertEqual(router.tasks, [.conversation(conversationId: HeldCallTransport.conversationID)])
  }

  func testAStartWhoseScreenLeftOpensNothing() async {
    let transport = HeldCallTransport()
    let start = CallStart()
    let router = AppRouter()

    start.start(Self.mock, voice: makeVoice(transport), router: router)
    await transport.waitForHeldRequest()
    start.cancel()
    await transport.release()
    await waitUntilStarted(start)

    XCTAssertEqual(router.tasks, [])
    XCTAssertNil(start.refusal)
  }

  private static let mock = Components.Schemas.LanguageConversationStartInput.case3(
    .init(goalId: "c3b30782-4de7-8386-83fa-934eee74e049", kind: .speakingMock))

  private func makeVoice(_ transport: HeldCallTransport) -> VoiceServices {
    VoiceServices(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: transport),
      cache: AppCache(session: .preview(account: .callStartTestFixture)))
  }

  /// It stops starting and opens the call in one main-actor turn, so once it isn't starting, it has
  /// done all it will.
  private func waitUntilStarted(_ start: CallStart) async {
    for _ in 0..<10_000 where start.isStarting {
      await Task.yield()
    }

    XCTAssertFalse(start.isStarting, "the start never answered")
  }
}

private actor HeldCallTransport: ClientTransport {
  static let conversationID = "01a18235-e60e-7dbb-a938-b0ae54987c58"

  private(set) var requests = 0
  private var held: CheckedContinuation<Void, Never>?

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    requests += 1
    await withCheckedContinuation { held = $0 }

    return (
      HTTPResponse(status: .created, headerFields: [.contentType: "application/json"]),
      HTTPBody(#"{"conversationId":"\#(Self.conversationID)"}"#)
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
  fileprivate static let callStartTestFixture = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      displayUsername: "learner", email: "learner@zoonk.test", id: "call-start-test-user",
      image: nil, name: "Learner", username: "learner"))
}
