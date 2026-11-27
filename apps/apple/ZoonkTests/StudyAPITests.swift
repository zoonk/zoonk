import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class StudyAPITests: XCTestCase {
  func testReviewMatchDecodesItsKeyAndKeepsTheOrderOfMisses() throws {
    let question = #"""
      {"answered":null,"capsuleKey":"review","citation":null,"context":null,"drill":null,
       "entry":null,"format":"matchPairs","image":null,"itemId":"item","key":[1,0],
       "left":["Mars","Moon"],"mistakeId":null,"options":null,"placement":false,
       "question":"Match the names.","quoted":false,"right":["Satellite","Planet"],
       "select":null,"set":null,"skillId":"skill","unit":null,"visual":null}
      """#
    let match = try JSONDecoder().decode(
      Components.Schemas.StudyBlockDetail.QuestionsPayloadPayload.self, from: Data(question.utf8))
    XCTAssertEqual(match.key, [1, 0])

    let answer = Components.Schemas.MatchAnswer(
      matches: [1, 0], misses: [.init(left: 1, right: 1), .init(left: 0, right: 0)])
    let sent = try XCTUnwrap(
      JSONSerialization.jsonObject(with: JSONEncoder().encode(answer)) as? NSDictionary)
    XCTAssertEqual(sent["matches"] as? [Int], [1, 0])
    XCTAssertEqual(
      sent["misses"] as? [[String: Int]],
      [
        ["left": 1, "right": 1], ["left": 0, "right": 0],
      ])
  }

  func testWritingRowUsesSavedDraftField() throws {
    let base = try XCTUnwrap(
      JSONSerialization.jsonObject(with: Data(Self.block.utf8)) as? [String: Any])
    let cases: [(String, Bool?, String?)] = [
      ("continue", nil, nil),
      ("continue", false, nil),
      ("continue", true, "Your draft is saved"),
      ("available", true, "Your draft is saved"),
    ]

    for (availability, hasDraft, expectedLine) in cases {
      var fixture = base
      fixture["kind"] = "produce"
      fixture["subject"] = nil
      fixture["canDo"] = nil
      fixture["writingAvailability"] = ["status": availability]
      fixture["hasWritingDraft"] = hasDraft
      let block = try JSONDecoder().decode(
        StudyBlock.self, from: JSONSerialization.data(withJSONObject: fixture))

      XCTAssertEqual(block.label(document: .notice), expectedLine)
      XCTAssertEqual(block.detail, expectedLine)
    }
  }

  /// A remedial row says only why it's in the day, in both of Today's places for a row's line.
  func testRemedialRowsSayWhyTheyAreInTheDay() throws {
    let base = try XCTUnwrap(
      JSONSerialization.jsonObject(with: Data(Self.block.utf8)) as? [String: Any])
    let cases: [([String: Any], String, String)] = [
      (["returning": "again"], "What you own when you buy a share", "Again: you keep missing this"),
      (["returning": "anotherWay"], "What you own when you buy a share", "Another way to see it"),
      (["returning": "missed"], "What you own when you buy a share", "You keep missing this"),
      (
        ["kind": "practice", "screen": "mistakesPractice", "questions": 3, "title": NSNull()],
        "Fix 3 mistakes", "Questions you missed before"
      ),
      (
        ["kind": "practice", "screen": "pattern", "patternId": "p1", "title": "Ser or estar"],
        "Practice: Ser or estar", "A pattern in your mistakes"
      ),
    ]

    for (changes, title, line) in cases {
      let fixture = base.merging(changes) { $1 }
      let block = try JSONDecoder().decode(
        StudyBlock.self, from: JSONSerialization.data(withJSONObject: fixture))

      XCTAssertEqual(block.displayTitle, title)
      XCTAssertEqual(block.label(document: .notice), line)
      XCTAssertEqual(block.detail, line)
      XCTAssertEqual(block.learnKind, block.kind == .learn ? .lesson : .mistakes)
    }
  }

  /// Opening a preview row names the same remedial work core showed, and leaves out what it isn't.
  func testOpeningARemedialRowEchoesWhatItIs() async throws {
    let base = try XCTUnwrap(
      JSONSerialization.jsonObject(with: Data(Self.block.utf8)) as? [String: Any])
    let rows: [[String: Any]] = [
      [:],
      ["returning": "anotherWay"],
      ["kind": "practice", "screen": "mistakesPractice"],
      ["kind": "practice", "screen": "pattern", "patternId": "p1"],
    ]
    var refs: [NSDictionary] = []

    for row in rows {
      let transport = StudyRecordingTransport()
      let api = StudyAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
      let block = try JSONDecoder().decode(
        StudyBlock.self,
        from: JSONSerialization.data(withJSONObject: base.merging(row) { $1 }))

      _ = try? await api.openDay(
        token: "token", goalID: "56adb511-8f30-426f-b358-fb4a556aaeb1", shownDate: "2026-10-28",
        timeZone: "America/Sao_Paulo", target: .ref(DayBlockRef(block)))

      let sent = try XCTUnwrap(transport.sent.value.first)
      let target = try XCTUnwrap(sent.json["target"] as? NSDictionary)
      refs.append(try XCTUnwrap(target["ref"] as? NSDictionary))
    }

    let flags = try refs.map { try XCTUnwrap($0["flags"] as? NSDictionary) }
    XCTAssertNil(flags[0]["mistakesPractice"])
    XCTAssertNil(flags[0]["returning"])
    XCTAssertNil(refs[0]["patternId"])
    XCTAssertEqual(flags[1]["returning"] as? String, "anotherWay")
    XCTAssertEqual(flags[2]["mistakesPractice"] as? Bool, true)
    XCTAssertEqual(refs[3]["patternId"] as? String, "p1")
  }

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
    let flags = try XCTUnwrap(shown["flags"] as? NSDictionary)
    XCTAssertNil(
      flags["mockPreparationReview"], "core refuses a null for a flag it reads as absent")
  }

  func testTheReviewOfferedWhileTheMockIsPreparedSaysSoInItsRef() async throws {
    let transport = StudyRecordingTransport()
    let api = StudyAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    let review = Self.block.replacingOccurrences(
      of: #""kind": "learn""#, with: #""kind": "review", "mockPreparationReview": true"#)
    let block = try JSONDecoder().decode(StudyBlock.self, from: Data(review.utf8))

    _ = try? await api.openDay(
      token: "token", goalID: "56adb511-8f30-426f-b358-fb4a556aaeb1", shownDate: "2026-10-28",
      timeZone: "America/Sao_Paulo", target: .ref(DayBlockRef(block)))

    let sent = try XCTUnwrap(transport.sent.value.first)
    let target = try XCTUnwrap(sent.json["target"] as? NSDictionary)
    let ref = try XCTUnwrap(target["ref"] as? NSDictionary)
    let flags = try XCTUnwrap(ref["flags"] as? NSDictionary)
    XCTAssertEqual(flags["mockPreparationReview"] as? Bool, true)
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
    {"answered": 0, "areaId": null, "brainPower": 0, "canDo": "You'll explain what you really own when you buy a share, and what you don't.", "areas": [], "topics": [], "canTestOut": true, "capsules": [], "chapterId": "01a14c5e-bbc7-7f60-a0d7-9f3ed9dc83c1", "checkpoint": null, "estimatedBrainPower": 24, "estimatedMinutes": 5, "extra": false, "fullReview": false, "kind": "learn", "lessonId": "bf2cf2eb-ea8d-8423-8d56-c97287bf412e", "mistakesOnly": false, "netScored": false, "opensInPlayer":false,"oftenTested": false, "planItemId": "01a182f3-64b4-7b61-82d2-47d32878c251", "planItemKey": "lesson:bf2cf2eb-ea8d-8423-8d56-c97287bf412e", "position": 0, "preparing": false, "questions": 0, "refresh": false, "reinforcement": false, "screen": "session", "status": "pending", "subject": "Shares and companies", "title": "What you own when you buy a share", "waitReason": null, "weakest": false}
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
