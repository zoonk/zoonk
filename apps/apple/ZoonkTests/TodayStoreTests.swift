import XCTest

@testable import Zoonk

@MainActor
final class TodayStoreTests: XCTestCase {
  func testDayStateFollowsItsBlocksAndTime() throws {
    XCTAssertEqual(try day(blocks: [block(position: 0)], nextPosition: 0).state, .underway)
    XCTAssertEqual(
      try day(blocks: [block(position: 0, status: "completed")], nextPosition: nil).state, .done)
    XCTAssertEqual(try day(blocks: [], nextPosition: nil, dailyGoal: 0).state, .rest)
    XCTAssertEqual(
      try day(blocks: [], nextPosition: nil, emptyDay: "lessonsComing").state, .waiting)
    XCTAssertEqual(try day(blocks: [], nextPosition: nil, emptyDay: "nothingNew").state, .ahead)
    XCTAssertEqual(
      try day(blocks: [block(position: 0)], nextPosition: 0, limitReached: true).state, .limit)
  }

  func testStartOnADayNotOpenedYetOpensItWithTheShownStep() async throws {
    let api = StudyAPIStub(opened: try opened(target: block(position: 0, kind: "review", id: "b1")))
    let store = TodayStore(api: api, cache: signedInCache())
    let view = try today(
      session: day(blocks: [block(position: 0, kind: "review")], nextPosition: 0))

    let destination = await store.open(view.session.blocks[0], next: true, in: view)

    XCTAssertEqual(destination, .questionBlock(sessionID: "s1", blockID: "b1"))
    XCTAssertEqual(store.sessionID, "s1")
    let targets = await api.openedTargets
    XCTAssertEqual(targets, ["next:0"])
    let starts = await api.startedBlocks
    XCTAssertEqual(starts, [], "a question block's own screen starts it")
  }

  func testReadyLessonStartsInThePlayer() async throws {
    let api = StudyAPIStub()
    let store = TodayStore(api: api, cache: signedInCache())
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1")
    let view = try today(
      session: day(blocks: [lesson], nextPosition: 0, id: "s1"), lessonStatus: ["l1": "ready"])

    let destination = await store.open(view.session.blocks[0], next: false, in: view)

    XCTAssertEqual(destination, .lesson(lessonID: "l1", sessionID: "s1"))
    let starts = await api.startedBlocks
    XCTAssertEqual(starts, ["b1"])
  }

  func testLessonNotWrittenYetWaitsOnTheSessionScreenWithoutStarting() async throws {
    let api = StudyAPIStub()
    let store = TodayStore(api: api, cache: signedInCache())
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1")
    let view = try today(
      session: day(blocks: [lesson], nextPosition: 0, id: "s1"), lessonStatus: ["l1": "notStarted"])

    let destination = await store.open(view.session.blocks[0], next: false, in: view)

    XCTAssertEqual(destination, .session)
    let starts = await api.startedBlocks
    XCTAssertEqual(starts, [])
  }

  func testPlannedChallengeOpensOnItsIntro() async throws {
    let api = StudyAPIStub()
    let store = TodayStore(api: api, cache: signedInCache())
    let challenge = try block(position: 0, kind: "checkpoint", id: "b1", planItemID: "p1")
    let view = try today(session: day(blocks: [challenge], nextPosition: 0, id: "s1"))

    let destination = await store.open(view.session.blocks[0], next: false, in: view)

    XCTAssertEqual(destination, .challenge(planItemID: "p1", sessionID: "s1"))
  }

  func testStepAStartRefusesReadsTheDayAgainInsteadOfOpening() async throws {
    let api = StudyAPIStub(start: .dailyLimitReached)
    let store = TodayStore(api: api, cache: signedInCache())
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1")
    let view = try today(
      session: day(blocks: [lesson], nextPosition: 0, id: "s1"), lessonStatus: ["l1": "ready"])

    let destination = await store.open(view.session.blocks[0], next: true, in: view)

    XCTAssertNil(destination)
  }

  func testShownStepEncodesItsWorkAsCoreReadsIt() throws {
    let challenge = try block(
      position: 2, kind: "checkpoint",
      checkpoint: #"{"kind":"weekly","mock":false,"phase":null,"rematch":false,"passMark":70}"#)
    let json =
      try JSONSerialization.jsonObject(
        with: JSONEncoder().encode(DayTarget.next(DayBlockRef(challenge)))) as? [String: Any]
    let shown = json?["shown"] as? [String: Any]
    let checkpoint = shown?["checkpoint"] as? [String: Any]

    XCTAssertEqual(json?["kind"] as? String, "next")
    XCTAssertEqual(shown?["position"] as? Int, 2)
    XCTAssertTrue(shown?["lessonId"] is NSNull)
    XCTAssertTrue(checkpoint?["phase"] is NSNull)
    XCTAssertNil(checkpoint?["mockIdentity"], "only a mock carries its identity")
  }
}

// MARK: - Fixtures

@MainActor
private func signedInCache() -> AppCache {
  AppCache(
    session: .preview(
      account: CurrentAccount(
        account: AccountAccess(
          deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
        user: AccountUser(
          displayUsername: "learner", email: "learner@zoonk.test", id: "today-test-user",
          image: nil, name: "Learner", username: "learner"))))
}

private func decode<Value: Decodable>(_ json: String) throws -> Value {
  try JSONDecoder().decode(Value.self, from: Data(json.utf8))
}

private func json(_ value: String?) -> String {
  value.map { "\"\($0)\"" } ?? "null"
}

private func blockJSON(
  position: Int, kind: String, status: String, id: String?, lessonID: String?,
  planItemID: String?, checkpoint: String?
) -> String {
  """
  {"answered":0,"areaId":null,"brainPower":0,"canDo":null,"canTestOut":false,"capsules":[],
  "chapterId":null,"checkpoint":\(checkpoint ?? "null"),"estimatedBrainPower":5,
  "estimatedMinutes":5,"extra":false,"fullReview":false,"kind":"\(kind)",
  "lessonId":\(json(lessonID)),"mistakesOnly":false,"netScored":false,"oftenTested":false,
  "planItemId":\(json(planItemID)),"planItemKey":null,"position":\(position),"questions":3,
  "refresh":false,"reinforcement":false,"status":"\(status)","subject":null,"title":"Block",
  "waitReason":null,"weakest":false\(id.map { ",\"id\":\"\($0)\"" } ?? "")}
  """
}

private func block(
  position: Int, kind: String = "practice", status: String = "pending", id: String? = nil,
  lessonID: String? = nil, planItemID: String? = nil, checkpoint: String? = nil
) throws -> StudyBlock {
  try decode(
    blockJSON(
      position: position, kind: kind, status: status, id: id, lessonID: lessonID,
      planItemID: planItemID, checkpoint: checkpoint))
}

private func dayJSON(
  blocks: [StudyBlock], nextPosition: Int?, id: String?, dailyGoal: Int, emptyDay: String?,
  limitReached: Bool
) -> String {
  let blockList = blocks.map {
    blockJSON(
      position: $0.position, kind: $0.kind.rawValue,
      status: $0.status == .completed ? "completed" : "pending", id: $0.id, lessonID: $0.lessonId,
      planItemID: $0.planItemId, checkpoint: nil)
  }

  return """
    {"blocks":[\(blockList.joined(separator: ","))],"brainPower":0,"catchUp":null,"current":true,
    "dailyLimit":{"limitMinutes":60,"reached":\(limitReached),"remainingMinutes":0,"usedMinutes":0},
    "dayEndsAt":1793242800000,"emptyDay":\(json(emptyDay)),
    "examAccess":{"includesMockExams":true,"trialEnded":false},"examTomorrow":false,
    "extraTime":{"available":false,"lessons":[],"minutes":10,"reason":null},"freshStart":null,
    "fullMeal":{"bonus":50,"earned":false,"ready":false},"goalId":"g1","lessonsComing":false,
    "localDate":"2026-10-28","minutes":{"dailyGoal":\(dailyGoal),"done":0,"planned":15},
    "missions":[],"nextPosition":\(nextPosition.map(String.init) ?? "null"),
    "pauseSuggested":false,"plusLessons":[],"sessionBar":{"completed":0,"total":1},
    "week":{"days":[],"daysHitGoal":0,"nextStudyDate":null,"studyDays":7,
    "time":{"studiedMinutes":0,"targetMinutes":100}},
    "status":"\(id == nil ? "unstarted" : "active")"\(id.map { ",\"id\":\"\($0)\"" } ?? "")}
    """
}

private func day(
  blocks: [StudyBlock], nextPosition: Int?, id: String? = nil, dailyGoal: Int = 15,
  emptyDay: String? = nil, limitReached: Bool = false
) throws -> StudyDay {
  try decode(
    dayJSON(
      blocks: blocks, nextPosition: nextPosition, id: id, dailyGoal: dailyGoal, emptyDay: emptyDay,
      limitReached: limitReached))
}

private func today(session: StudyDay, lessonStatus: [String: String] = [:]) throws -> TodayView {
  let statuses = lessonStatus.map { "\"\($0.key)\":\"\($0.value)\"" }.joined(separator: ",")
  return TodayView(
    earlierWork: [], exam: nil,
    goal: try decode(
      #"{"dateEstimated":false,"daysLeft":null,"id":"g1","kind":"learn","title":"Goal"}"#),
    insight: nil, lessonStatus: try decode("{\(statuses)}"), mockFunding: nil, pattern: nil,
    planChange: nil, progress: nil, session: session, studiedToday: false, weeklyChallenge: nil)
}

private func opened(target: StudyBlock) throws -> OpenedStudyDay {
  OpenedStudyDay(
    session: try day(blocks: [target], nextPosition: target.position, id: "s1"), sessionId: "s1",
    target: target)
}

private actor StudyAPIStub: StudyAPIClient {
  private let opened: OpenedStudyDay?
  private let startResult: BlockStart
  private(set) var openedTargets: [String] = []
  private(set) var startedBlocks: [String] = []

  init(opened: OpenedStudyDay? = nil, start: BlockStart = .started) {
    self.opened = opened
    self.startResult = start
  }

  func getToday(token: String, timeZone: String) async throws -> TodayContent { .goalNotActive }

  func openDay(
    token: String, goalID: String, shownDate: String, timeZone: String, target: DayTarget?
  ) async throws -> OpenedStudyDay {
    switch target {
    case .next(let ref): openedTargets.append("next:\(ref.position)")
    case .ref(let ref): openedTargets.append("ref:\(ref.position)")
    case nil: openedTargets.append("none")
    }

    guard let opened else {
      throw APIError.unavailable
    }

    return opened
  }

  func startBlock(token: String, sessionID: String, blockID: String, timeZone: String)
    async throws -> BlockStart
  {
    startedBlocks.append(blockID)
    return startResult
  }

  func addExtraBlock(token: String, sessionID: String) async throws -> StudyBlock {
    throw APIError.unavailable
  }

  func catchUp(token: String, sessionID: String, timeZone: String) async throws {}

  func lessonStatus(token: String, lessonID: String) async throws -> String { "ready" }
  func answerInsight(token: String, insightID: String, accepted: Bool) async throws {}

}
