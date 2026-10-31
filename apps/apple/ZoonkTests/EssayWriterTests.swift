import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

@MainActor
final class EssayWriterTests: XCTestCase {
  private let blockId = UUID().uuidString.lowercased()

  override func tearDown() {
    UnsentEssay.clear(blockId)
    super.tearDown()
  }

  func testTheDailyTimeLimitStopsASendAndKeepsTheText() async {
    let writer = makeWriter()
    writer.text = "My essay about it."

    await writer.send()

    XCTAssertEqual(writer.status, .dailyLimitReached)
    XCTAssertEqual(writer.text, "My essay about it.")
    XCTAssertEqual(makeWriter().text, "My essay about it.", "Opened again, it's still there")
  }

  private func makeWriter() -> EssayWriter {
    let api = ExamAPI(
      clients: APIClientFactory(baseURL: Self.baseURL, transport: DailyLimitTransport()))
    let store = ExamStore(api: api, cache: AppCache(session: .preview(account: .essayWriterTest)))
    return EssayWriter(store: store, blockId: blockId)
  }

  private static let baseURL = URL(string: "https://api.zoonk.test")!
}

private struct DailyLimitTransport: ClientTransport {
  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    (
      HTTPResponse(status: .forbidden, headerFields: [.contentType: "application/json"]),
      HTTPBody(#"{"error":{"code":"DAILY_LIMIT_REACHED","message":"Daily time limit reached"}}"#)
    )
  }
}

extension CurrentAccount {
  fileprivate static let essayWriterTest = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      displayUsername: "learner", email: "learner@zoonk.test", id: "essay-writer-test-user",
      image: nil, name: "Learner", username: "learner"))
}
