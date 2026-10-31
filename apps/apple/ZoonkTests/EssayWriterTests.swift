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
    let writer = makeWriter(DailyLimitTransport())
    writer.text = "My essay about it."

    await writer.send()

    XCTAssertEqual(writer.status, .dailyLimitReached)
    XCTAssertEqual(writer.text, "My essay about it.")
    XCTAssertEqual(
      makeWriter(DailyLimitTransport()).text, "My essay about it.", "Opened again, it's still there"
    )
  }

  func testAFinishedEssayShowsItsLastGradeAndTakesNoRewrite() async {
    let writer = makeWriter(EssayTransport(status: "completed", drafted: true))
    await writer.essay.load()

    writer.writing = true

    XCTAssertTrue(writer.isClosed)
    XCTAssertFalse(writer.isWriting)
  }

  func testASkippedEssayWithNoDraftTakesNoDraft() async {
    let writer = makeWriter(EssayTransport(status: "skipped", drafted: false))
    await writer.essay.load()

    XCTAssertTrue(writer.isClosed)
    XCTAssertFalse(writer.isWriting)
  }

  func testAnEssayNotStartedYetTakesADraft() async {
    let writer = makeWriter(EssayTransport(status: "pending", drafted: false))
    await writer.essay.load()

    XCTAssertFalse(writer.isClosed)
    XCTAssertTrue(writer.isWriting)
  }

  func testAnActiveEssayShowsItsGradeAndTakesARewrite() async {
    let writer = makeWriter(EssayTransport(status: "active", drafted: true))
    await writer.essay.load()

    XCTAssertFalse(writer.isClosed)
    XCTAssertFalse(writer.isWriting)

    writer.writing = true

    XCTAssertTrue(writer.isWriting)
  }

  func testASendRefusedBecauseTheEssayClosedElsewhereShowsItReadOnly() async {
    let transport = EssayTransport(status: "active", drafted: true, closesOnSend: true)
    let writer = makeWriter(transport)
    await writer.essay.load()
    writer.writing = true
    writer.text = "My rewrite."

    await writer.send()

    XCTAssertTrue(writer.isClosed)
    XCTAssertFalse(writer.isWriting)
  }

  func testARefusedSendReadsTheEssayAgainInsteadOfAnOlderReadOnItsWay() async {
    let transport = EssayTransport(status: "active", drafted: true, closesOnSend: true)
    let writer = makeWriter(transport)
    await writer.essay.load()
    writer.writing = true
    writer.text = "My rewrite."
    await transport.holdNextRead()
    let olderRead = Task { await writer.essay.refresh() }
    await transport.waitForHeldRead()

    let sending = Task { await writer.send() }
    let readAgain = await transport.waitForReadAfterSend()
    await transport.releaseHeldRead()
    await sending.value
    await olderRead.value

    XCTAssertTrue(readAgain, "The essay is read again after the send is refused")
    XCTAssertTrue(writer.isClosed)
  }

  func testAnEssayFinishedHereGoesOnAndOpensClosedAgain() async {
    let store = makeStore(EssayTransport(status: "active", drafted: true))
    let writer = EssayWriter(store: store, blockId: blockId)
    await writer.essay.load()

    writer.didFinish()

    XCTAssertFalse(writer.isClosed, "This visit goes on to the session")
    XCTAssertTrue(EssayWriter(store: store, blockId: blockId).isClosed, "Opened again, it's closed")
  }

  private func makeWriter(_ transport: some ClientTransport) -> EssayWriter {
    EssayWriter(store: makeStore(transport), blockId: blockId)
  }

  private func makeStore(_ transport: some ClientTransport) -> ExamStore {
    let api = ExamAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    return ExamStore(api: api, cache: AppCache(session: .preview(account: .essayWriterTest)))
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

/// Serves the essay with `status`. With `closesOnSend`, the essay was finished elsewhere when a
/// draft arrives, so the send is refused and later reads say it's completed. A held read answers
/// with the status it was asked at.
private actor EssayTransport: ClientTransport {
  private var status: String
  private let drafted: Bool
  private let closesOnSend: Bool
  private var holdsNextRead = false
  private var heldRead: CheckedContinuation<Void, Never>?
  private var isSent = false
  private var readsAfterSend = 0

  init(status: String, drafted: Bool, closesOnSend: Bool = false) {
    self.status = status
    self.drafted = drafted
    self.closesOnSend = closesOnSend
  }

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    guard operationID == "getEssay" else {
      isSent = true

      if closesOnSend {
        status = "completed"
      }

      return (
        HTTPResponse(status: .conflict, headerFields: [.contentType: "application/json"]),
        HTTPBody(#"{"error":{"code":"BLOCK_NOT_ACTIVE","message":"The block is finished"}}"#)
      )
    }

    let status = status
    let drafts = drafted ? "[\(Self.draft)]" : "[]"

    if isSent {
      readsAfterSend += 1
    }

    if holdsNextRead {
      holdsNextRead = false
      await withCheckedContinuation { heldRead = $0 }
    }

    return (
      HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
      HTTPBody(
        """
        {"blockId":"00000000-0000-4000-8000-0000000000b1","context":null,"drafts":\(drafts),"gradesLeft":3,\
        "question":"Write about cities.","rubric":"enem",\
        "sessionId":"00000000-0000-4000-8000-0000000000e1","status":"\(status)"}
        """)
    )
  }

  func holdNextRead() {
    holdsNextRead = true
  }

  func waitForHeldRead() async {
    while heldRead == nil {
      await Task.yield()
    }
  }

  func releaseHeldRead() {
    heldRead?.resume()
    heldRead = nil
  }

  /// False when no read starts within two seconds.
  func waitForReadAfterSend() async -> Bool {
    for _ in 0..<200 where readsAfterSend == 0 {
      try? await Task.sleep(for: .milliseconds(10))
    }

    return readsAfterSend > 0
  }

  private static let draft = """
    {"grade":{"criteria":[{"comment":"Clear.","example":null,"id":"c1","maxScore":200,\
    "name":"Formal writing","quote":null,"score":160}],"enemInterventionElements":null,\
    "nextStep":{"criterionId":"c1","text":"Vary your connectors."},\
    "range":{"high":720,"low":640},"total":{"maxScore":1000,"score":680},"zeroReason":null},\
    "submittedAt":"2026-10-30T12:00:00.000Z","text":"Cities grow."}
    """
}

extension CurrentAccount {
  fileprivate static let essayWriterTest = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      displayUsername: "learner", email: "learner@zoonk.test", id: "essay-writer-test-user",
      image: nil, name: "Learner", username: "learner"))
}
