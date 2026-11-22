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
    var opened: [String] = []

    start.start(Self.mock, voice: voice) { opened.append($0) }
    await transport.waitForHeldRequest()
    start.start(Self.mock, voice: voice) { opened.append($0) }
    await transport.release()
    await waitUntilStarted(start)

    let requests = await transport.requests
    XCTAssertEqual(requests, 1)
    XCTAssertEqual(opened, [HeldCallTransport.conversationID])
  }

  func testAStartWhoseScreenLeftOpensNothing() async {
    let transport = HeldCallTransport()
    let start = CallStart()
    var opened: [String] = []

    start.start(Self.mock, voice: makeVoice(transport)) { opened.append($0) }
    await transport.waitForHeldRequest()
    start.leave()
    await transport.release()
    await waitUntilStarted(start)

    XCTAssertEqual(opened, [])
    XCTAssertNil(start.refusal)
  }

  func testClosingTheCallSetupOpensNothingItStarted() async {
    let transport = HeldCallTransport()
    let setup = PracticeCallSetup()
    var opened: [String] = []

    setup.isOpen = true
    setup.start.start(Self.mock, voice: makeVoice(transport)) { opened.append($0) }
    await transport.waitForHeldRequest()
    setup.isOpen = false
    await transport.release()
    await waitUntilStarted(setup.start)

    XCTAssertEqual(opened, [])
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
  private func waitUntilStarted(
    _ start: CallStart, file: StaticString = #filePath, line: UInt = #line
  ) async {
    _ = try? await waitForTestCondition("The start never answered", file: file, line: line) {
      !start.isStarting
    }
  }
}

private actor HeldCallTransport: ClientTransport {
  static let conversationID = "01a18235-e60e-7dbb-a938-b0ae54987c58"

  private(set) var requests = 0
  private var held: TestContinuation<Void>?

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    requests += 1
    await withTestVoidContinuation { held = $0 }

    return (
      HTTPResponse(status: .created, headerFields: [.contentType: "application/json"]),
      HTTPBody(#"{"conversationId":"\#(Self.conversationID)"}"#)
    )
  }

  func waitForHeldRequest(file: StaticString = #filePath, line: UInt = #line) async {
    _ = try? await waitForTestCondition("waitForHeldRequest did not arrive", file: file, line: line)
    { await self.held != nil }
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
      email: "learner@zoonk.test", id: "call-start-test-user",
      image: nil, name: "Learner", username: "learner"))
}
