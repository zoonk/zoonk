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
    let view = try today(
      session: day(blocks: [block(position: 0, kind: "review")], nextPosition: 0))
    let api = StudyAPIStub(
      opened: try opened(target: block(position: 0, kind: "review", id: "b1")), today: .day(view))
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()

    let destination = await store.open(view.session.blocks[0], next: true, in: view).destination

    XCTAssertEqual(destination, .questionBlock(sessionID: "s1", blockID: "b1"))
    XCTAssertEqual(store.sessionID, "s1")
    let targets = await api.openedTargets
    XCTAssertEqual(targets, ["next:0"])
    let starts = await api.startedBlocks
    XCTAssertEqual(starts, [], "a question block's own screen starts it")
  }

  /// A practice in the day's saved session only opens: nothing is written, so Today isn't read
  /// again (its own screen starts it).
  func testAPracticeInASavedSessionOpensWithoutReadingTodayAgain() async throws {
    let view = try today(
      session: day(
        blocks: [block(position: 0, kind: "practice", id: "b1")], nextPosition: 0, id: "s1"))
    let api = StudyAPIStub(today: .day(view))
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()

    let destination = await store.open(view.session.blocks[0], next: false, in: view).destination
    await store.today.load()

    XCTAssertEqual(destination, .questionBlock(sessionID: "s1", blockID: "b1"))
    XCTAssertEqual(store.sessionID, "s1")
    let reads = await api.todayReads
    XCTAssertEqual(reads, 1)
  }

  func testReadyLessonStartsInThePlayer() async throws {
    let api = StudyAPIStub()
    let store = TodayStore(api: api, cache: signedInCache())
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1")
    let view = try today(
      session: day(blocks: [lesson], nextPosition: 0, id: "s1"), lessonStatus: ["l1": "ready"])

    let destination = await store.open(view.session.blocks[0], next: false, in: view).destination

    XCTAssertEqual(destination, .lesson(lessonID: "l1", sessionID: "s1"))
    let starts = await api.startedBlocks
    XCTAssertEqual(starts, ["b1"])
  }

  /// A mission or a buddy link names one of today's blocks by its id: it starts as its row on
  /// Today starts it, and a block done meanwhile opens nothing.
  func testABlockNamedByItsIdStartsAsTodaysRowDoes() async throws {
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1")
    let done = try block(position: 1, kind: "review", status: "completed", id: "b2")
    let view = try today(
      session: day(blocks: [lesson, done], nextPosition: 0, id: "s1"),
      lessonStatus: ["l1": "ready"])
    let api = StudyAPIStub(today: .day(view))
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()

    let destination = await store.open(blockID: "b1")?.destination
    let finished = await store.open(blockID: "b2")
    let elsewhere = await store.open(blockID: "b3")

    XCTAssertEqual(destination, .lesson(lessonID: "l1", sessionID: "s1"))
    XCTAssertNil(finished)
    XCTAssertNil(elsewhere)
    let starts = await api.startedBlocks
    XCTAssertEqual(starts, ["b1"])
  }

  /// Sol's F14: the tap on a lesson nobody is writing asks for it (main's `unwrittenLesson`)
  /// without starting its block, and the session waits for it.
  func testAnUnwrittenLessonIsAskedForByTheTapWithoutStartingTheBlock() async throws {
    let api = StudyAPIStub()
    let store = TodayStore(api: api, cache: signedInCache())
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1")
    let view = try today(
      session: day(blocks: [lesson], nextPosition: 0, id: "s1"), lessonStatus: ["l1": "notStarted"])

    let destination = await store.open(view.session.blocks[0], next: false, in: view).destination

    XCTAssertEqual(destination, .lessonWait(blockID: "b1", writing: .writing))
    XCTAssertEqual(store.writing(for: lesson), .writing)
    let written = await api.writtenLessons
    XCTAssertEqual(written, ["l1"])
    let starts = await api.startedBlocks
    XCTAssertEqual(starts, [], "starting would prepare the session and race the request")
  }

  func testAStepWhoseLessonIsntPickedYetPreparesTheSession() async throws {
    let api = StudyAPIStub()
    let store = TodayStore(api: api, cache: signedInCache())
    let placeholder = try block(position: 0, kind: "learn", id: "b1")
    let view = try today(session: day(blocks: [placeholder], nextPosition: 0, id: "s1"))

    let destination = await store.open(view.session.blocks[0], next: false, in: view).destination

    XCTAssertEqual(destination, .lessonWait(blockID: "b1", writing: .preparing))
    let prepared = await api.preparedSessions
    XCTAssertEqual(prepared, ["s1"])
  }

  func testPlannedChallengeOpensOnItsIntro() async throws {
    let api = StudyAPIStub()
    let store = TodayStore(api: api, cache: signedInCache())
    let challenge = try block(position: 0, kind: "checkpoint", id: "b1", planItemID: "p1")
    let view = try today(session: day(blocks: [challenge], nextPosition: 0, id: "s1"))

    let destination = await store.open(view.session.blocks[0], next: false, in: view).destination

    XCTAssertEqual(destination, .challenge(planItemID: "p1", sessionID: "s1"))
  }

  func testStepAStartRefusesReadsTheDayAgainInsteadOfOpening() async throws {
    let api = StudyAPIStub(start: .dailyLimitReached)
    let store = TodayStore(api: api, cache: signedInCache())
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1")
    let view = try today(
      session: day(blocks: [lesson], nextPosition: 0, id: "s1"), lessonStatus: ["l1": "ready"])

    let destination = await store.open(view.session.blocks[0], next: true, in: view).destination

    XCTAssertNil(destination, "the tap fails and Today reads the day again")
  }

  func testAMilestoneCeremonyShowsOnceOnTheSessionScreen() {
    let store = StudySessionStore(api: StudyAPIStub(), cache: signedInCache())
    let belt = Milestone(id: "m1", key: "yellow", kind: "belt")

    XCTAssertTrue(store.claimCeremony(belt))
    XCTAssertFalse(store.claimCeremony(belt), "the block's moment and the summary carry it")
  }

  func testStoppingForTodayEndsTheBlockAndShowsTheSummary() async {
    let store = StudySessionStore(api: StudyAPIStub(), cache: signedInCache())
    store.play(blockID: "b1")

    let stopped = await store.stop(sessionID: "s1").destination != nil

    XCTAssertTrue(stopped)
    XCTAssertNil(store.playingBlockID)
    XCTAssertEqual(store.stoppedSessionID, "s1")
  }

  /// Sol's F15 repro: A taps Start, A's session ends while the day opens, and B's Today is on
  /// screen when A's answer arrives. Nothing opens over B, and the session screen doesn't pick A's.
  func testAnOpeningAnsweredAfterItsLearnerLeftOpensNothing() async throws {
    let api = StudyAPIStub(
      opened: try opened(target: block(position: 0, kind: "review", id: "b1")), holdsOpening: true)
    let cache = signedInCache()
    let store = TodayStore(api: api, cache: cache)
    let view = try today(
      session: day(blocks: [block(position: 0, kind: "review")], nextPosition: 0))

    let opening = Task { await store.open(view.session.blocks[0], next: true, in: view) }
    await api.waitForHeldOpening()
    await cache.session.expire(try XCTUnwrap(cache.session.authenticatedSession))
    await api.releaseOpening()
    let result = await opening.value

    guard case .obsolete = result else {
      return XCTFail("a destination for a learner who left must not open")
    }

    XCTAssertNil(store.sessionID)
  }

  /// The session a tap opened is the session screen's only for that learner's same goal and day:
  /// after midnight (or a goal switch) Today's own day decides.
  func testAnOpenedSessionDoesNotOutliveItsDay() async throws {
    let review = try block(position: 0, kind: "review")
    let shown = try today(session: day(blocks: [review], nextPosition: 0))
    let api = StudyAPIStub(
      opened: try opened(target: block(position: 0, kind: "review", id: "b1")),
      today: .day(shown))
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()

    _ = await store.open(shown.session.blocks[0], next: true, in: shown)
    XCTAssertEqual(store.sessionID, "s1", "the day it opened, before Today reads it again")

    let tomorrow = try today(
      session: day(blocks: [review], nextPosition: 0, localDate: "2026-10-29"))
    await api.serve(.day(tomorrow))
    await store.today.refresh()

    XCTAssertNil(store.sessionID, "tomorrow isn't opened yet")
  }

  func testAnExpiredSessionSignsOutInsteadOfFailingTheTap() async throws {
    let api = StudyAPIStub(startError: .unauthorized)
    let cache = signedInCache()
    let store = TodayStore(api: api, cache: cache)
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1")
    let view = try today(
      session: day(blocks: [lesson], nextPosition: 0, id: "s1"), lessonStatus: ["l1": "ready"])

    let result = await store.open(view.session.blocks[0], next: true, in: view)

    guard case .obsolete = result else {
      return XCTFail("a 401 signs out; nothing opens and nothing fails on screen")
    }

    XCTAssertNil(cache.session.authenticatedSession)
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
  limitReached: Bool, localDate: String
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
    "localDate":"\(localDate)","minutes":{"dailyGoal":\(dailyGoal),"done":0,"planned":15},
    "missions":[],"nextPosition":\(nextPosition.map(String.init) ?? "null"),
    "pauseSuggested":false,"plusLessons":[],"sessionBar":{"completed":0,"total":1},
    "week":{"days":[],"daysHitGoal":0,"nextStudyDate":null,"studyDays":7,
    "time":{"studiedMinutes":0,"targetMinutes":100}},
    "status":"\(id == nil ? "unstarted" : "active")"\(id.map { ",\"id\":\"\($0)\"" } ?? "")}
    """
}

private func day(
  blocks: [StudyBlock], nextPosition: Int?, id: String? = nil, dailyGoal: Int = 15,
  emptyDay: String? = nil, limitReached: Bool = false, localDate: String = "2026-10-28"
) throws -> StudyDay {
  try decode(
    dayJSON(
      blocks: blocks, nextPosition: nextPosition, id: id, dailyGoal: dailyGoal, emptyDay: emptyDay,
      limitReached: limitReached, localDate: localDate))
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
  private let startError: APIError?
  private var today: TodayContent
  private let holdsOpening: Bool
  private var heldOpening: CheckedContinuation<Void, Never>?
  private var openingWaiter: CheckedContinuation<Void, Never>?
  private(set) var openedTargets: [String] = []
  private(set) var startedBlocks: [String] = []
  private(set) var writtenLessons: [String] = []
  private(set) var preparedSessions: [String] = []
  private(set) var todayReads = 0

  init(
    opened: OpenedStudyDay? = nil, start: BlockStart = .started, startError: APIError? = nil,
    today: TodayContent = .goalNotActive, holdsOpening: Bool = false
  ) {
    self.opened = opened
    self.startResult = start
    self.startError = startError
    self.today = today
    self.holdsOpening = holdsOpening
  }

  func serve(_ today: TodayContent) {
    self.today = today
  }

  /// Waits until an opening is held, so the test can change who's signed in meanwhile.
  func waitForHeldOpening() async {
    guard heldOpening == nil else {
      return
    }

    await withCheckedContinuation { openingWaiter = $0 }
  }

  func releaseOpening() {
    heldOpening?.resume()
    heldOpening = nil
  }

  func getToday(token: String, timeZone: String) async throws -> TodayContent {
    todayReads += 1
    return today
  }

  func openDay(
    token: String, goalID: String, shownDate: String, timeZone: String, target: DayTarget?
  ) async throws -> OpenedStudyDay {
    switch target {
    case .next(let ref): openedTargets.append("next:\(ref.position)")
    case .ref(let ref): openedTargets.append("ref:\(ref.position)")
    case nil: openedTargets.append("none")
    }

    if holdsOpening {
      await withCheckedContinuation { continuation in
        heldOpening = continuation
        openingWaiter?.resume()
        openingWaiter = nil
      }
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

    if let startError {
      throw startError
    }
    return startResult
  }

  func addExtraBlock(token: String, sessionID: String) async throws -> StudyBlock {
    throw APIError.unavailable
  }

  func catchUp(token: String, sessionID: String, timeZone: String) async throws {}
  func stop(token: String, sessionID: String, timeZone: String) async throws {}

  func getSession(token: String, sessionID: String) async throws -> StudyDay {
    throw APIError.unavailable
  }

  func getSummary(token: String, sessionID: String) async throws -> SessionSummary {
    throw APIError.unavailable
  }

  func lessonStatus(token: String, lessonID: String) async throws -> String { "ready" }

  func writeLesson(token: String, lessonID: String) async throws -> LessonWritingOutcome {
    writtenLessons.append(lessonID)
    return .writing
  }

  func prepareSession(token: String, sessionID: String) async throws {
    preparedSessions.append(sessionID)
  }
  func answerSuggestedGoal(token: String, suggestionID: String, accepted: Bool) async throws {}
  func markMilestoneShown(token: String, milestoneID: String) async throws {}

  func getWeeklyRecap(token: String, goalID: String?) async throws -> WeeklyRecap {
    throw APIError.unavailable
  }
}

extension MutationResult {
  /// What a tap opened, for assertions; nil when it failed or came back obsolete.
  fileprivate var destination: Value? {
    if case .done(let value) = self { value } else { nil }
  }
}
