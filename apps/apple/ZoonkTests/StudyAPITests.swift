import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class StudyAPITests: XCTestCase {
  func testResendingARecordingKeepsItsAttemptID() async throws {
    let transport = StudyRecordingTransport()
    let api = VoiceAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    let take = VoiceRecording(audio: Data([1]), durationMs: 800)
    let next = VoiceRecording(audio: Data([1]), durationMs: 800)
    let stepId = UUID().uuidString
    for recording in [take, take, next] {
      _ = try? await api.answerSpokenStep(
        stepId: stepId, studySessionId: nil, recording: recording, token: "token")
    }
    XCTAssertNotEqual(take.attemptId, next.attemptId)
    XCTAssertEqual(transport.sent.value.count, 3)
    for (sent, id) in zip(transport.sent.value, [take.attemptId, take.attemptId, next.attemptId]) {
      XCTAssertTrue(String(decoding: sent.body, as: UTF8.self).contains(id))
    }
  }

  func testASpokenAnswerSendsItsMicrophoneStartOnlyWhenMeasured() async throws {
    let transport = StudyRecordingTransport()
    let api = VoiceAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    let measured = VoiceRecording(audio: Data([1]), durationMs: 800, micStartupMs: 640)
    let unmeasured = VoiceRecording(audio: Data([1]), durationMs: 800)

    for recording in [measured, unmeasured] {
      _ = try? await api.answerSpokenStep(
        stepId: UUID().uuidString, studySessionId: nil, recording: recording, token: "token")
    }

    let bodies = transport.sent.value.map { String(decoding: $0.body, as: UTF8.self) }
    XCTAssertEqual(bodies.count, 2)
    let part = bodies[0].components(separatedBy: "name=\"micStartupMs\"").dropFirst().first
    let value = part?.components(separatedBy: "\r\n\r\n").dropFirst().first
    XCTAssertEqual(value?.components(separatedBy: "\r\n").first, "640")
    XCTAssertFalse(bodies[1].contains("micStartupMs"))
  }

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

      XCTAssertEqual(block.label, expectedLine)
      XCTAssertEqual(block.detail, expectedLine)
    }
  }

  /// A remedial row says only why it's in the day, in both of Today's places for a row's line.
  func testRemedialRowsSayWhyTheyAreInTheDay() throws {
    let base = try XCTUnwrap(
      JSONSerialization.jsonObject(with: Data(Self.block.utf8)) as? [String: Any])
    let cases: [([String: Any], String, String)] = [
      (
        ["returning": "again"], "What you own when you buy a share",
        "Once more: this one's been tricky"
      ),
      (["returning": "anotherWay"], "What you own when you buy a share", "Another way to see it"),
      (["returning": "missed"], "What you own when you buy a share", "This one's been tricky"),
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
      XCTAssertEqual(block.label, line)
      XCTAssertEqual(block.detail, line)
      XCTAssertEqual(block.learnKind, block.kind == .learn ? .lesson : .mistakes)
    }
  }

  /// A reason a newer server gives for a lesson being back keeps the lesson's own row, without a
  /// line this version can't say.
  func testAnUnknownReturningReasonKeepsAnOrdinaryLessonRow() throws {
    let base = try XCTUnwrap(
      JSONSerialization.jsonObject(with: Data(Self.block.utf8)) as? [String: Any])
    let wire = try JSONDecoder().decode(
      Components.Schemas.StudyBlock.self,
      from: JSONSerialization.data(
        withJSONObject: base.merging([
          "id": "01a182f3-64b4-7b61-82d2-47d32878c252", "practiceNumber": NSNull(),
          "returning": "lastChance",
        ]) { $1 })
    )
    let block: StudyBlock = try StudyJSON.recode(wire)
    let plain = try JSONDecoder().decode(StudyBlock.self, from: Data(Self.block.utf8))

    XCTAssertNil(block.returning)
    XCTAssertEqual(block.displayTitle, plain.displayTitle)
    XCTAssertEqual(block.label, plain.label)
  }

  /// A day's mistakes all fixed elsewhere since it opened: the row says so, with no line, until
  /// opening it marks it done; a finished row keeps the count it recorded.
  func testAMistakesRowWithNothingLeftReadsAlreadyFixed() throws {
    let base = try XCTUnwrap(
      JSONSerialization.jsonObject(with: Data(Self.block.utf8)) as? [String: Any])
    func row(status: String) throws -> StudyBlock {
      let fixture = base.merging([
        "kind": "practice", "screen": "mistakesPractice", "questions": 0, "title": NSNull(),
        "status": status,
      ]) { $1 }
      return try JSONDecoder().decode(
        StudyBlock.self, from: JSONSerialization.data(withJSONObject: fixture))
    }

    let pending = try row(status: "pending")
    XCTAssertTrue(pending.isAlreadyFixed)
    XCTAssertEqual(pending.displayTitle, "Already fixed")
    XCTAssertNil(pending.label)
    XCTAssertNil(pending.detail)

    let done = try row(status: "completed")
    XCTAssertFalse(done.isAlreadyFixed)
    XCTAssertNotEqual(done.displayTitle, "Already fixed")
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

  /// A mock's run names only its mock, so it works after the learner switched goals, and its finish
  /// names the run's scope and formats so the answer says whether more is left to practice.
  func testAMockRunNamesOnlyItsMock() async throws {
    let transport = StudyRecordingTransport()
    let api = PracticeAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    let mock = MistakePracticeScope.mock("6f0b5a52-63a8-4c1e-9a52-1d1d0c6c9e11")

    _ = try? await api.answerMistake(
      token: "token", mistakeId: "m1", itemId: "i1", showing: "mistake:m1:1", answer: .choice(0),
      durationMs: 1000, attemptId: "a1", runAnswerIds: [], goalId: "g1", scope: mock)
    _ = try? await api.finishMistakePractice(
      token: "token", answerIds: ["a1"], goalId: "g1", scope: mock)
    _ = try? await api.finishMistakePractice(
      token: "token", answerIds: [], goalId: "g1", scope: .skill("s1"))

    let sent = transport.sent.value.map(\.json)
    let run = try XCTUnwrap(sent.first?["run"] as? NSDictionary)
    XCTAssertEqual(run["mockId"] as? String, mock.mockId)
    XCTAssertNil(run["goalId"])

    XCTAssertEqual(sent[1]["mockId"] as? String, mock.mockId)
    XCTAssertNil(sent[1]["goalId"])
    XCTAssertEqual(sent[1]["ended"] as? Bool, true)
    XCTAssertEqual(sent[2]["skillId"] as? String, "s1")
    XCTAssertEqual(sent[2]["goalId"] as? String, "g1")
    XCTAssertEqual(sent[2]["includeAllFormats"] as? Bool, true)
  }

  /// A question's answer names the order its entry showed, so a tab left open after a miss elsewhere
  /// is graded in that order; a lesson screen's answer names its option instead.
  func testAMistakeAnswerSendsTheOrderItsEntryShowed() async throws {
    let transport = StudyRecordingTransport()
    let api = PracticeAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))

    _ = try? await api.answerMistake(
      token: "token", mistakeId: "m1", itemId: "i1", showing: "mistake:m1:1", answer: .choice(0),
      durationMs: 1000, attemptId: "a1", runAnswerIds: [], goalId: "g1", scope: .notebook)
    _ = try? await api.answerLessonMistake(
      token: "token", mistakeId: "m1", stepId: "s1", answer: nil, durationMs: 1000,
      attemptId: "a2", runAnswerIds: [], goalId: "g1", scope: .notebook)

    let sent = transport.sent.value.map(\.json)
    XCTAssertEqual(sent.first?["showing"] as? String, "mistake:m1:1")
    XCTAssertEqual(sent.first?["itemId"] as? String, "i1")
    XCTAssertNil(sent.last?["showing"])
    XCTAssertEqual(sent.last?["stepId"] as? String, "s1")
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

    XCTAssertEqual(
      opening, .StudyBlockOpeningLesson(.init(kind: .lesson, lessonId: "l1", sessionId: "s1")))
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
