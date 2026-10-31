import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class StudyAPITests: XCTestCase {
  /// Core reads the shown block's missing values as `null` and refuses a body that leaves them out.
  func testOpeningADaySendsTheShownBlocksNullsWithTheBodysOwnLength() async throws {
    let transport = StudyRecordingTransport()
    let api = StudyAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    let block = try JSONDecoder().decode(StudyBlock.self, from: Data(Self.block.utf8))

    _ = try? await api.openDay(
      token: "token", goalID: "56adb511-8f30-426f-b358-fb4a556aaeb1", shownDate: "2026-10-28",
      timeZone: "America/Sao_Paulo", target: .next(DayBlockRef(block)))

    let sent = try XCTUnwrap(transport.sent.value.first)
    XCTAssertEqual(sent.contentLength, sent.body.count, "A server would wait for missing bytes")
    let target = try XCTUnwrap(sent.json["target"] as? NSDictionary)
    let shown = try XCTUnwrap(target["shown"] as? NSDictionary)
    XCTAssertEqual(shown["areaId"] as? NSNull, NSNull())
    XCTAssertEqual(shown["checkpoint"] as? NSNull, NSNull())
    XCTAssertEqual(shown["lessonId"] as? String, "bf2cf2eb-ea8d-8423-8d56-c97287bf412e")
  }

  func testAPlanThatChangedWhileTheDayOpenedIsAskedOnceMore() async throws {
    let transport = StudyRecordingTransport(responses: [
      (.conflict, #"{"error":{"code":"STUDY_DAY_RETRYABLE","message":"Try again."}}"#),
      (.ok, #"{"kind":"lesson","lessonId":"l1","sessionId":"s1"}"#),
    ])
    let api = StudyAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))

    let opening = try await api.openBlock(
      token: "token", target: .next(.init(expectedBlockId: "b1", kind: .next, sessionId: "s1")),
      timeZone: "America/Sao_Paulo")

    XCTAssertEqual(opening, .lesson(.init(kind: .lesson, lessonId: "l1", sessionId: "s1")))
    XCTAssertEqual(transport.sent.value.count, 2, "once more, in a request of its own")
    let target = try XCTUnwrap(transport.sent.value.first?.json["target"] as? NSDictionary)
    XCTAssertEqual(target["kind"] as? String, "next")
    XCTAssertEqual(target["expectedBlockId"] as? String, "b1")
  }

  func testASecondLostRaceFailsTheOpening() async throws {
    let retryable = #"{"error":{"code":"STUDY_DAY_RETRYABLE","message":"Try again."}}"#
    let transport = StudyRecordingTransport(responses: [
      (.conflict, retryable), (.conflict, retryable),
    ])
    let api = StudyAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))

    do {
      _ = try await api.openBlock(
        token: "token", target: .block(.init(blockId: "b1", kind: .block)), timeZone: "UTC")
      XCTFail("a second lost race is a failure")
    } catch {
      XCTAssertEqual(error as? APIError, .unavailable)
    }

    XCTAssertEqual(transport.sent.value.count, 2)
  }

  private static let baseURL = URL(string: "https://api.zoonk.test")!

  private static let block = #"""
    {"answered": 0, "areaId": null, "brainPower": 0, "canDo": "You'll explain what you really own when you buy a share, and what you don't.", "canTestOut": true, "capsules": [], "chapterId": "01a14c5e-bbc7-7f60-a0d7-9f3ed9dc83c1", "checkpoint": null, "estimatedBrainPower": 24, "estimatedMinutes": 5, "extra": false, "fullReview": false, "kind": "learn", "lessonId": "bf2cf2eb-ea8d-8423-8d56-c97287bf412e", "mistakesOnly": false, "netScored": false, "oftenTested": false, "planItemId": "01a182f3-64b4-7b61-82d2-47d32878c251", "planItemKey": "lesson:bf2cf2eb-ea8d-8423-8d56-c97287bf412e", "position": 0, "questions": 0, "refresh": false, "reinforcement": false, "screen": "session", "status": "pending", "subject": "Shares and companies", "title": "What you own when you buy a share", "waitReason": null, "weakest": false}
    """#
}

private struct StudyRecordingTransport: ClientTransport {
  struct Sent {
    var body: Data
    var contentLength: Int?

    var json: NSDictionary {
      (try? JSONSerialization.jsonObject(with: body) as? NSDictionary) ?? [:]
    }
  }

  let sent = StudyRecorded()
  var responses: [(HTTPResponse.Status, String)] = []

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

    let index = sent.append(
      Sent(body: data, contentLength: request.headerFields[.contentLength].flatMap { Int($0) }))

    guard index < responses.count else {
      return (HTTPResponse(status: .internalServerError), nil)
    }

    let (status, json) = responses[index]
    return (
      HTTPResponse(status: status, headerFields: [.contentType: "application/json"]), HTTPBody(json)
    )
  }
}

private final class StudyRecorded: @unchecked Sendable {
  private let lock = NSLock()
  private var items: [StudyRecordingTransport.Sent] = []

  var value: [StudyRecordingTransport.Sent] {
    lock.withLock { items }
  }

  @discardableResult
  func append(_ item: StudyRecordingTransport.Sent) -> Int {
    lock.withLock {
      items.append(item)
      return items.count - 1
    }
  }
}
