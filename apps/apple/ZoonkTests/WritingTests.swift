import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

/// Core's `countWritingLines` gives these counts and offsets; the writer, the result and the
/// server must agree on where the board stops reading.
final class WritingLinesTests: XCTestCase {
  /// Core's shared cases (`packages/core/src/exams/essays/_test-utils/writing-lines.json`).
  func testMatchesCoresSharedCases() {
    let cases: [(text: String, perLine: Int, limit: Int?, lines: Int, ignoredFrom: Int?)] = [
      ("e\u{301}🙂\r\n\r\nnext", 2, 2, 4, 8),
      ("aaaaaaaaaa\n", 10, 1, 1, nil),
      ("aaaaaaaaaa\r\n", 10, 1, 1, nil),
      ("aaaaaaaaaa\r", 10, 1, 1, nil),
      ("aaaaaaaaaa\u{2028}", 10, 1, 1, nil),
      ("aaaaaaaaaa\u{2029}", 10, 1, 1, nil),
      ("aaaaaaaaaa\r\n\r\n", 10, 1, 2, 12),
      ("", 10, 1, 0, nil),
    ]

    for item in cases {
      let count = WritingLines.count(item.text, charactersPerLine: item.perLine, limit: item.limit)
      XCTAssertEqual(count.estimatedLines, item.lines, "lines of \(item.text.debugDescription)")
      XCTAssertEqual(count.ignoredFrom, item.ignoredFrom, "limit of \(item.text.debugDescription)")
    }
  }

  func testCountsLinesAsCoreDoes() {
    let cases: [(text: String, perLine: Int, limit: Int?, lines: Int, ignoredFrom: Int?)] = [
      ("", 5, 3, 0, nil),
      ("abc", 5, 3, 1, nil),
      ("abcde", 5, 3, 1, nil),
      ("abcdef", 5, 3, 2, nil),
      ("ab\ncd", 5, 3, 2, nil),
      ("ab\r\ncd", 5, 1, 2, 4),
      ("abcde\nf", 5, 3, 2, nil),
      ("a\n\n\nb", 5, 2, 4, 3),
      ("👍🏽👨‍👩‍👧e\u{301}x", 2, 1, 2, 12),
      ("line\u{2028}two\u{2029}three", 10, nil, 3, nil),
      ("\n", 5, nil, 1, nil),
      ("abcdefghijkl", 3, 2, 4, 6),
    ]

    for item in cases {
      let count = WritingLines.count(item.text, charactersPerLine: item.perLine, limit: item.limit)
      XCTAssertEqual(count.estimatedLines, item.lines, "lines of \(item.text.debugDescription)")
      XCTAssertEqual(count.ignoredFrom, item.ignoredFrom, "limit of \(item.text.debugDescription)")
    }
  }

  func testTheFirstCharacterPastTheLimitIsWhereTheBoardStopsReading() {
    let text = String(repeating: "a", count: 55 * 30) + "b"

    let count = WritingLines.count(text, charactersPerLine: 55, limit: 30)

    XCTAssertEqual(count, .init(estimatedLines: 31, ignoredFrom: 1650))
  }

  func testTheWordALimitSplitsIsMarkedPastItWhole() throws {
    let grade = try decode(WritingResult.self, Self.levels(ignoredFrom: 6, errors: "[]"))

    let pieces = WritingMarks.pieces(grade: grade, text: "abc defghij")

    XCTAssertEqual(pieces.map(\.ignored), [false, true])
    XCTAssertEqual(pieces.last?.start, 4)
  }

  func testAnErrorAfterAnEmojiIsMarkedAtItsUTF16Offset() throws {
    let grade = try decode(
      WritingResult.self,
      Self.levels(
        ignoredFrom: nil,
        errors: #"[{"correction":"two","kind":"spelling","quote":"tow","start":3}]"#))

    let pieces = WritingMarks.pieces(grade: grade, text: "👍 tow cats")

    XCTAssertEqual(pieces.first { $0.error == 0 }.map { ($0.start, $0.end) }?.0, 3)
    XCTAssertEqual(pieces.first { $0.error == 0 }.map { ($0.start, $0.end) }?.1, 6)
  }

  static func levels(ignoredFrom: Int?, errors: String) -> String {
    """
    {"kind":"levels","criteria":[{"comment":"Clear.","id":"c1","level":"strong","name":"Content",\
    "quote":null}],"errors":\(errors),"ignoredFrom":\(ignoredFrom.map(String.init) ?? "null"),\
    "nextStep":null,"progress":null}
    """
  }
}

/// Every result is one shape: levels carry no numbers; points carry ranges.
final class WritingResultDecodingTests: XCTestCase {
  func testALevelsResultHasNoTotal() throws {
    let grade = try decode(
      WritingResult.self, WritingLinesTests.levels(ignoredFrom: nil, errors: "[]"))

    XCTAssertNil(grade.points)
    XCTAssertEqual(grade.criteria.first?.level, .strong)
  }

  func testAPointsResultKeepsItsRangesAndRows() throws {
    let grade = try decode(WritingResult.self, Self.points(zeroReason: "null"))

    XCTAssertEqual(grade.points?.total, WritingRange(high: 19.4, low: 16.2))
    XCTAssertEqual(grade.points?.deduction, WritingRange(high: 0.35, low: 0.35))
    XCTAssertEqual(grade.points?.rows.first?.max, 9.5)
    XCTAssertNil(grade.points?.zeroReason)
    XCTAssertEqual(grade.nextStepCriterion?.name, "Powers of the Court")
  }

  func testAZeroedResultSaysTheNoticesRule() throws {
    let grade = try decode(
      WritingResult.self, Self.points(zeroReason: #""An answer off the topic gets zero.""#))

    XCTAssertEqual(grade.points?.zeroReason, "An answer off the topic gets zero.")
  }

  func testAnUnknownKindIsAFailedReadNotAMadeUpGrade() {
    XCTAssertThrowsError(
      try decode(
        WritingResult.self,
        WritingLinesTests.levels(ignoredFrom: nil, errors: "[]")
          .replacingOccurrences(of: #""levels""#, with: #""stars""#)))
  }

  func testAStartReadsEachOfItsAnswers() throws {
    XCTAssertEqual(
      try WritingStartWire.recode(Wire(status: "ready", admissionId: "a1")),
      .ready(admissionId: "a1"))
    XCTAssertEqual(
      try WritingStartWire.recode(Wire(status: "writing", runId: "wrun_1")),
      .writing(generationId: "wrun_1"))
    XCTAssertEqual(
      try WritingStartWire.recode(Wire(status: "limitReached", returnsOn: "2026-11-21")),
      .limitReached(returnsOn: "2026-11-21", task: nil))
  }

  static func points(zeroReason: String) -> String {
    """
    {"kind":"points","criteria":[{"comment":"Names two powers.","id":"a2","level":"partial",\
    "name":"Powers of the Court","quote":"The Court matters."}],"errors":[],"ignoredFrom":null,\
    "nextStep":{"criterionId":"a2","example":null,"quote":"The Court matters.",\
    "text":"Name at least two powers."},"progress":{"fixed":[],"persists":["a2"]},\
    "content":{"high":19.75,"low":16.55},"deduction":{"high":0.35,"low":0.35},"max":30,\
    "rows":[{"earned":4.75,"id":"a2","max":9.5}],"total":{"high":19.4,"low":16.2},\
    "zeroReason":\(zeroReason)}
    """
  }

  private struct Wire: Encodable {
    var status: String
    var admissionId: String?
    var runId: String?
    var returnsOn: String?
  }
}

/// Typing goes to the block's saved draft; a draft saved on another device never takes away what
/// this one typed and hasn't sent.
@MainActor
final class WritingDraftTests: XCTestCase {
  private let blockId = "01a1fac7-1f8c-7827-b3b7-6f5f50afc190"

  override func tearDown() {
    KeptWriting.clear(blockId)
    super.tearDown()
  }

  func testATypedDraftWinsOnlyOverTheRevisionItWasTypedOn() {
    let saved = WritingDraft(admissionId: "a1", revision: 2, text: "Saved elsewhere.")

    XCTAssertEqual(
      KeptWriting.choose(kept: .init(base: 2, text: "Typed here."), saved: saved), "Typed here.")
    XCTAssertEqual(
      KeptWriting.choose(kept: .init(base: 1, text: "Typed here."), saved: saved),
      "Saved elsewhere.")
    XCTAssertEqual(
      KeptWriting.choose(kept: .init(base: 2, text: "  "), saved: saved), "Saved elsewhere.")
    XCTAssertEqual(KeptWriting.choose(kept: nil, saved: nil), "")
  }

  func testASaveThatFindsANewerDraftSavesTheUnsentEditOverIt() async {
    let transport = DraftTransport(conflictRevision: 3)
    let writer = makeWriter(transport)

    writer.write("My edit, typed offline.")
    await writer.flush()

    let saves = await transport.saves
    XCTAssertEqual(saves.map(\.revision), [1, 3])
    XCTAssertEqual(saves.last?.text, "My edit, typed offline.")
    XCTAssertEqual(writer.text, "My edit, typed offline.")
  }

  func testAnAnswerSentIsGradedUnderItsAdmissionAndOpensTheResult() async {
    let transport = DraftTransport(conflictRevision: nil)
    let writer = makeWriter(transport)

    writer.write("My answer.")
    await writer.send()

    let submitted = await transport.submittedAdmissions
    XCTAssertEqual(submitted, ["00000000-0000-4000-8000-0000000000a1"])
    XCTAssertEqual(writer.mode, .result)
    XCTAssertNil(writer.latest?.grade.points)
    XCTAssertNil(KeptWriting.read(blockId), "What was sent leaves this device")
  }

  private func makeWriter(_ transport: DraftTransport) -> EssayWriter {
    let api = ExamAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    let store = ExamStore(api: api, cache: AppCache(session: .preview(account: .writingTest)))
    let view = try! decode(EssayView.self, Self.essay(blockId: blockId))
    return EssayWriter(store: store, view: view, admissionId: nil)
  }

  private static let baseURL = URL(string: "https://api.zoonk.test")!

  static func essay(blockId: String) -> String {
    """
    {"blockId":"\(blockId)","context":null,"drafts":[],\
    "draft":{"admissionId":"00000000-0000-4000-8000-0000000000a1","revision":1,"text":"Started."},\
    "gradesLeft":6,"pacing":{"minutes":70,"source":"estimated"},"question":"Write it.",\
    "rubric":"points","sessionId":"01a1fac7-1f46-7548-a88d-e54152b01cad","status":"active",\
    "writing":{"charactersPerLine":55,"criteria":[{"id":"c1","name":"Content","points":null}],\
    "keySource":"practiceKey","lines":30,"minimumWords":30,"points":30,"taskKey":"short",\
    "title":"Internal and external control","unit":"answer"}}
    """
  }
}

/// Saves the draft, answering the first save with a newer one when `conflictRevision` is set, and
/// grades a submission with levels.
private actor DraftTransport: ClientTransport {
  struct Save: Decodable {
    let revision: Int
    let text: String
  }

  private let conflictRevision: Int?
  private(set) var saves: [Save] = []
  private(set) var submittedAdmissions: [String] = []

  init(conflictRevision: Int?) {
    self.conflictRevision = conflictRevision
  }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var data = Data()
    if let body {
      data = try await Data(collecting: body, upTo: 1 << 20)
    }

    switch operationID {
    case "saveWritingDraft":
      let save = try JSONDecoder().decode(Save.self, from: data)
      saves.append(save)

      if let conflictRevision, saves.count == 1 {
        return json(
          .conflict,
          #"{"admissionId":"00000000-0000-4000-8000-0000000000a1","revision":\#(conflictRevision),"text":"Saved on the phone."}"#
        )
      }

      return json(
        .ok,
        #"{"admissionId":"00000000-0000-4000-8000-0000000000a1","revision":\#(save.revision + 1),"text":\#(String(data: try JSONEncoder().encode(save.text), encoding: .utf8)!)}"#
      )
    case "submitEssay":
      struct Submit: Decodable { let admissionId: String }
      submittedAdmissions.append(try JSONDecoder().decode(Submit.self, from: data).admissionId)
      return json(
        .ok,
        #"{"attemptId":"3674d948-e89d-8489-851c-fd3687fcb325","submittedAt":"2026-11-20T12:00:00.000Z","text":"My answer.","grade":\#(WritingLinesTests.levels(ignoredFrom: nil, errors: "[]"))}"#
      )
    default:
      return (HTTPResponse(status: .notFound), nil)
    }
  }

  private func json(_ status: HTTPResponse.Status, _ body: String) -> (HTTPResponse, HTTPBody?) {
    (HTTPResponse(status: status, headerFields: [.contentType: "application/json"]), HTTPBody(body))
  }
}

private func decode<Value: Decodable>(_ type: Value.Type, _ json: String) throws -> Value {
  let decoder = JSONDecoder()
  decoder.dateDecodingStrategy = .iso8601
  return try decoder.decode(type, from: Data(json.utf8))
}

extension CurrentAccount {
  fileprivate static let writingTest = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "writing-test-user",
      image: nil, name: "Learner", username: "learner"))
}
