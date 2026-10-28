import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class ExamAPITests: XCTestCase {
  private let blockId = "01a18235-e60e-7dbb-a938-b0ae54987c58"
  private let goalId = "c3b30782-4de7-8386-83fa-934eee74e049"
  private let itemId = "01a12229-b961-72ae-a802-006ceef4fd0d"

  func testStartingAMockSendsItsShapesNullsWithTheBodysOwnLength() async throws {
    let transport = RecordingTransport(answer: #"{"id": "x", "status": "needsQuestions"}"#)
    let api = ExamAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))

    let outcome = try await api.startMock(
      token: "token", goalId: goalId, choice: .practice(MockShape(kind: .half)),
      acceptFewer: false)

    XCTAssertEqual(outcome, .needsQuestions)
    let sent = try XCTUnwrap(transport.sent.value.first)
    XCTAssertEqual(sent.contentLength, sent.body.count, "A server would wait for missing bytes")
    let shape = try XCTUnwrap(sent.json["shape"] as? NSDictionary)
    XCTAssertEqual(shape, ["area": NSNull(), "day": NSNull(), "kind": "half"])
  }

  func testABlankDraftSavesAnExplicitNullAnswer() async throws {
    let transport = RecordingTransport(status: .noContent)
    let api = ExamAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    let draft = MockDraft(answer: nil, durationMs: 4200, flagged: true, itemId: itemId)

    let saved = try await api.saveAnswer(token: "token", blockId: blockId, draft: draft)

    XCTAssertTrue(saved)
    let sent = try XCTUnwrap(transport.sent.value.first)
    XCTAssertEqual(sent.contentLength, sent.body.count)
    XCTAssertEqual(
      sent.json,
      ["answer": NSNull(), "durationMs": 4200, "flagged": true, "itemId": itemId] as NSDictionary)
  }

  func testAPickSavesInTheAPIsShape() async throws {
    let transport = RecordingTransport(status: .noContent)
    let api = ExamAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    let draft = MockDraft(answer: .choice(3), durationMs: 0, flagged: false, itemId: itemId)

    _ = try await api.saveAnswer(token: "token", blockId: blockId, draft: draft)

    let sent = try XCTUnwrap(transport.sent.value.first)
    XCTAssertEqual(sent.contentLength, sent.body.count)
    XCTAssertEqual(sent.json["answer"] as? NSDictionary, ["selectedIndex": 3])
  }

  private static let baseURL = URL(string: "https://api.zoonk.test")!
}

/// Records each request's body and Content-Length, and answers with one response.
private struct RecordingTransport: ClientTransport {
  struct Sent {
    var body: Data
    var contentLength: Int?

    var json: NSDictionary {
      (try? JSONSerialization.jsonObject(with: body) as? NSDictionary) ?? [:]
    }
  }

  var status: HTTPResponse.Status = .ok
  var answer: String?
  let sent = Recorded()

  init(status: HTTPResponse.Status = .ok, answer: String? = nil) {
    self.status = status
    self.answer = answer
  }

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var data = Data()
    if let body {
      data = try await Data(collecting: body, upTo: 100_000)
    }

    sent.append(
      Sent(body: data, contentLength: request.headerFields[.contentLength].flatMap { Int($0) }))

    return (
      HTTPResponse(status: status, headerFields: [.contentType: "application/json"]),
      answer.map { HTTPBody($0) }
    )
  }
}

private final class Recorded: @unchecked Sendable {
  private let lock = NSLock()
  private var items: [RecordingTransport.Sent] = []

  var value: [RecordingTransport.Sent] {
    lock.withLock { items }
  }

  func append(_ item: RecordingTransport.Sent) {
    lock.withLock { items.append(item) }
  }
}
