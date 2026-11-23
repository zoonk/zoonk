import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class ExamAPITests: XCTestCase {
  private let blockId = "01a18235-e60e-7dbb-a938-b0ae54987c58"
  private let goalId = "c3b30782-4de7-8386-83fa-934eee74e049"
  private let itemId = "01a12229-b961-72ae-a802-006ceef4fd0d"

  func testStartingAMockSendsOnlyItsShapeWithItsNullsAndTheBodysOwnLength() async throws {
    for kind in [MockShape.Kind.half, .objective, .written] {
      let transport = RecordingTransport(answer: #"{"id": null, "status": "preparing"}"#)
      let api = ExamAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))

      let outcome = try await api.startMock(
        token: "token", goalId: goalId, shape: MockShape(kind: kind))

      XCTAssertEqual(outcome, .preparing)
      let sent = try XCTUnwrap(transport.sent.value.first)
      XCTAssertEqual(sent.contentLength, sent.body.count, "A server would wait for missing bytes")
      XCTAssertEqual(
        sent.json,
        ["shape": ["area": NSNull(), "day": NSNull(), "kind": kind.rawValue]] as NSDictionary)
    }
  }

  func testWrittenMockRefusalsDoNotBecomePreparation() async throws {
    let cases: [(HTTPResponse.Status, String, MockStartOutcome)] = [
      (.conflict, Self.choiceRequired, .needsChoice(choiceGroups: ["Specialty"])),
      (
        .tooManyRequests,
        """
        {"returnsOn":"2026-11-23","status":"limitReached","error":{
          "code":"USAGE_LIMIT_REACHED","details":{"returnsOn":"2026-11-23"},"message":"Try tomorrow"
        }}
        """,
        .writingLimitReached(returnsOn: "2026-11-23")
      ),
      (.forbidden, Self.signUpRequired, .refused(.signUpRequired)),
    ]

    for (status, body, expected) in cases {
      let transport = RecordingTransport(status: status, answer: body)
      let api = ExamAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))

      let outcome = try await api.startMock(
        token: "token", goalId: goalId, shape: MockShape(kind: .written))

      XCTAssertEqual(outcome, expected)
      XCTAssertEqual(transport.sent.value.count, 1)
    }
  }

  func testSkippingScheduledMockSendsExplicitNullDate() async throws {
    let transport = RecordingTransport(answer: #"{"changeId":"changed","planItemId":"scheduled"}"#)
    let api = PracticeAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    let change = try await api.changeMockSchedule(token: "token", itemId: itemId, date: nil)

    XCTAssertEqual(change, "changed")
    let sent = try XCTUnwrap(transport.sent.value.first)
    XCTAssertEqual(sent.json["date"] as? NSNull, NSNull())
  }

  func testScheduledMockStartDistinguishesPreparationFromRefusals() async throws {
    let preparing = RecordingTransport(status: .accepted, answer: #"{"status":"preparing"}"#)
    let api = PracticeAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: preparing))
    let outcome = try await api.startChallenge(
      token: "token", planItemId: itemId, afterWriting: false)
    XCTAssertNil(outcome)
    XCTAssertNil(preparing.sent.value.first?.json["afterWriting"])

    let refusals: [(HTTPResponse.Status, String, PracticeAPIError)] = [
      (.conflict, Self.choiceRequired, .needsExamChoice(["Specialty"])),
      (.forbidden, Self.signUpRequired, .limit(.signUpRequired)),
    ]

    for (status, body, expected) in refusals {
      let transport = RecordingTransport(status: status, answer: body)
      let api = PracticeAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))

      do {
        _ = try await api.startChallenge(token: "token", planItemId: itemId, afterWriting: false)
        XCTFail("The start should return its refusal")
      } catch {
        XCTAssertEqual(error as? PracticeAPIError, expected)
      }
      XCTAssertEqual(transport.sent.value.count, 1)
    }
  }

  func testABlankDraftSavesAnExplicitNullAnswer() async throws {
    let transport = RecordingTransport(status: .noContent)
    let api = ExamAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    let draft = MockDraft(answer: nil, durationMs: 4200, unsure: true, itemId: itemId)

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
    let draft = MockDraft(answer: .choice(3), durationMs: 0, unsure: false, itemId: itemId)

    _ = try await api.saveAnswer(token: "token", blockId: blockId, draft: draft)

    let sent = try XCTUnwrap(transport.sent.value.first)
    XCTAssertEqual(sent.contentLength, sent.body.count)
    XCTAssertEqual(sent.json["answer"] as? NSDictionary, ["selectedIndex": 3])
  }

  private static let choiceRequired = """
    {"error":{"code":"EXAM_CHOICE_REQUIRED","message":"Choose a specialty",
      "details":{"choiceGroups":["Specialty"]}}}
    """
  private static let signUpRequired =
    #"{"error":{"code":"SIGN_UP_REQUIRED","message":"Create an account"}}"#

  private static let baseURL = URL(string: "https://api.zoonk.test")!
}

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
