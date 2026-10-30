import XCTest

@testable import Zoonk

@MainActor
final class TodayStoreTests: XCTestCase {
  func testTheQueueKeepsBlocksInTheirOrderAroundTheNextOne() throws {
    let session = try day(
      blocks: [
        block(position: 0, status: "completed"), block(position: 1), block(position: 2),
        block(position: 3),
      ],
      nextPosition: 2)
    let queue = session.queue(next: session.nextBlock)

    XCTAssertEqual(queue.before.map(\.position), [1])
    XCTAssertEqual(queue.after.map(\.position), [3])
    XCTAssertEqual(session.queue(next: nil).after.map(\.position), [1, 2, 3])
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
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1", screen: "lesson")
    let view = try today(session: day(blocks: [lesson], nextPosition: 0, id: "s1"))

    let destination = await store.open(view.session.blocks[0], next: false, in: view).destination

    XCTAssertEqual(destination, .lesson(lessonID: "l1", sessionID: "s1"))
    let starts = await api.startedBlocks
    XCTAssertEqual(starts, ["b1"])
    let readinessReads = await api.readinessReads
    XCTAssertEqual(readinessReads, [], "the block says where it opens")
  }

  func testALessonsEndShowsOverAReadOfTodayThatStartedBeforeIt() async throws {
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1")
    let session = try day(blocks: [lesson], nextPosition: 0, id: "s1")
    let api = StudyAPIStub(
      today: .day(try today(session: session, lessonStatus: ["l1": "generating"])))
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()

    await api.holdNextTodayRead()
    let pull = Task { await store.today.refresh() }
    await api.waitForHeldTodayRead()
    await api.serve(.day(try today(session: session, lessonStatus: ["l1": "ready"])))

    let followed = expectation(description: "the lesson's end doesn't wait on the older read")
    let follow = Task {
      await store.followWriting(lessonIDs: ["l1"])
      followed.fulfill()
    }
    await fulfillment(of: [followed], timeout: 10)
    await api.releaseTodayRead()
    await follow.value
    await pull.value

    let shown = try XCTUnwrap(store.day)
    XCTAssertEqual(shown.lessonStatus["l1"], "ready")
    XCTAssertEqual(store.writingLessonIDs(in: shown), [])
  }

  func testALessonTheReadDidntCheckAsksForItsReadinessFirst() async throws {
    let api = StudyAPIStub()
    let store = TodayStore(api: api, cache: signedInCache())
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1", screen: "unknown")

    let destination = await store.open(lesson, sessionID: "s1").destination

    XCTAssertEqual(destination, .lesson(lessonID: "l1", sessionID: "s1"))
    let readinessReads = await api.readinessReads
    XCTAssertEqual(readinessReads, ["l1"])
    let starts = await api.startedBlocks
    XCTAssertEqual(starts, ["b1"])
  }

  func testABlockNamedByItsIdStartsAsTodaysRowDoes() async throws {
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1", screen: "lesson")
    let done = try block(position: 1, kind: "review", status: "completed", id: "b2")
    let view = try today(session: day(blocks: [lesson, done], nextPosition: 0, id: "s1"))
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

  func testAWrittenLessonStopsShowingAsBeingWrittenWhenTodayCantBeReadAgain() async throws {
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1")
    let api = StudyAPIStub(
      today: .day(
        try today(
          session: day(blocks: [lesson], nextPosition: 0, id: "s1"),
          lessonStatus: ["l1": "generating"])))
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()
    await api.failTodayReads()

    await store.followWriting(lessonIDs: ["l1"])

    let shown = try XCTUnwrap(store.day)
    XCTAssertFalse(store.isBeingWritten(lesson, in: shown))
    XCTAssertEqual(store.writingLessonIDs(in: shown), [])
  }

  func testALessonWhoseWritingStalledStopsShowingAsBeingWrittenUntilAskedAgain() async throws {
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1")
    let other = try block(position: 1, kind: "learn", id: "b2", lessonID: "l2")
    let view = try today(
      session: day(blocks: [lesson, other], nextPosition: 0, id: "s1"),
      lessonStatus: ["l1": "generating", "l2": "generating"])
    let api = StudyAPIStub(today: .day(view), unwrittenLessons: ["l1"], unreachableLessons: ["l2"])
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()

    await store.followWriting(lessonIDs: ["l1"])
    await store.followWriting(lessonIDs: ["l2"])

    XCTAssertFalse(store.isBeingWritten(lesson, in: view), "main stops saying so once it gives up")
    XCTAssertEqual(store.writingLessonIDs(in: view), [], "nothing is left to follow")

    _ = await store.open(lesson, next: false, in: view)

    XCTAssertTrue(store.isBeingWritten(lesson, in: view), "the tap asked for it again")
    XCTAssertFalse(store.isBeingWritten(other, in: view), "a run that couldn't be followed")
  }

  func testAnUnwrittenLessonIsAskedForByTheTapWithoutStartingTheBlock() async throws {
    let api = StudyAPIStub()
    let store = TodayStore(api: api, cache: signedInCache())
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1")
    let view = try today(session: day(blocks: [lesson], nextPosition: 0, id: "s1"))

    let destination = await store.open(view.session.blocks[0], next: false, in: view).destination

    XCTAssertEqual(destination, .lessonWait(blockID: "b1", writing: .writing(run: "run-1")))
    XCTAssertEqual(store.writing(for: lesson), .writing(run: "run-1"))
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

  func testGettingTodaysLessonsAsksForThemAndReadsTodayAgain() async throws {
    let view = try today(
      session: day(
        blocks: [], nextPosition: nil, emptyDay: "lessonsToPrepare", state: "prepare"))
    let api = StudyAPIStub(today: .day(view))
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()

    let result = await store.prepareLessons(in: view)
    await store.today.load()

    guard case .done = result else {
      return XCTFail("asking for the day's lessons saves")
    }

    let prepared = await api.preparedGoals
    XCTAssertEqual(prepared, ["g1"])
    let reads = await api.todayReads
    XCTAssertEqual(reads, 2, "the next read says the lessons are coming")
  }

  func testPlannedChallengeOpensOnItsIntro() async throws {
    let api = StudyAPIStub()
    let store = TodayStore(api: api, cache: signedInCache())
    let challenge = try block(
      position: 0, kind: "checkpoint", id: "b1", planItemID: "p1", screen: "challenge")
    let view = try today(session: day(blocks: [challenge], nextPosition: 0, id: "s1"))

    let destination = await store.open(view.session.blocks[0], next: false, in: view).destination

    XCTAssertEqual(destination, .challenge(planItemID: "p1", sessionID: "s1"))
  }

  func testALanguageCallOpensOnItsOwnIntroWithoutStartingTheBlock() async throws {
    let api = StudyAPIStub(call: .notStarted(try decode(Self.callIntro)))
    let store = TodayStore(api: api, cache: signedInCache())
    let call = try block(
      position: 0, kind: "checkpoint", id: "b1", planItemID: "p1", screen: "challenge")

    let destination = await store.open(call, sessionID: "s1").destination

    XCTAssertEqual(destination, .checkpoint(blockID: "b1", sessionID: "s1"))
    let starts = await api.startedBlocks
    XCTAssertEqual(starts, [], "the call's Start starts it")
  }

  func testALanguageCallWaitingForEarlierWorkOpensNothing() async throws {
    let api = StudyAPIStub(call: .earlierFirst(.init(reason: .lessons, status: .earlierFirst)))
    let store = TodayStore(api: api, cache: signedInCache())
    let call = try block(
      position: 0, kind: "checkpoint", id: "b1", planItemID: "p1", screen: "challenge")

    let destination = await store.open(call, sessionID: "s1").destination

    XCTAssertNil(destination, "the tap fails and Today reads the day again")
  }

  private static let callIntro = #"""
    {"dailyLimitReached":false,"status":"notStarted","intro":{"character":{"name":"Ana",
    "place":"Lisboa","role":"Neighbor"},"exam":null,"examTask":null,"kind":"checkpoint",
    "level":"A2","minutes":3,"objectives":[],"situation":"A chat","targetLanguage":"pt",
    "title":"The unit's call"}}
    """#

  func testStepAStartRefusesReadsTheDayAgainInsteadOfOpening() async throws {
    let api = StudyAPIStub(start: .dailyLimitReached)
    let store = TodayStore(api: api, cache: signedInCache())
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1", screen: "lesson")
    let view = try today(session: day(blocks: [lesson], nextPosition: 0, id: "s1"))

    let destination = await store.open(view.session.blocks[0], next: true, in: view).destination

    XCTAssertNil(destination, "the tap fails and Today reads the day again")
  }

  func testAMilestoneCeremonyShowsOnceOnTheSessionScreen() {
    let api = StudyAPIStub()
    let cache = signedInCache()
    let store = StudySessionStore(api: api, cache: cache, today: TodayStore(api: api, cache: cache))
    let belt = Milestone(id: "m1", key: "yellow", kind: "belt")

    XCTAssertTrue(store.claimCeremony(belt))
    XCTAssertFalse(store.claimCeremony(belt), "the block's moment and the summary carry it")
  }

  func testStoppingForTodayEndsTheBlockAndShowsTheSummary() async {
    let api = StudyAPIStub()
    let cache = signedInCache()
    let store = StudySessionStore(api: api, cache: cache, today: TodayStore(api: api, cache: cache))
    let playback = SessionPlayback()
    playback.play(blockID: "b1")

    let stopped = await store.stop(sessionID: "s1", in: playback).destination != nil

    XCTAssertTrue(stopped)
    XCTAssertNil(playback.playingBlockID)
    XCTAssertEqual(playback.stoppedSessionID, "s1")
  }

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
    let lesson = try block(position: 0, kind: "learn", id: "b1", lessonID: "l1", screen: "lesson")
    let view = try today(session: day(blocks: [lesson], nextPosition: 0, id: "s1"))

    let result = await store.open(view.session.blocks[0], next: true, in: view)

    guard case .obsolete = result else {
      return XCTFail("a 401 signs out; nothing opens and nothing fails on screen")
    }

    XCTAssertNil(cache.session.authenticatedSession)
  }

  func testAnAnsweredPlanChangeStaysWithItsAnswerWhileTodayReadsAgain() async throws {
    let proposed = try planChange(status: "proposed")
    let view = try today(session: day(blocks: [], nextPosition: nil), planChange: proposed)
    let api = StudyAPIStub(
      today: .day(view), decided: try planChange(status: "applied", canUndo: true))
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()

    let result = await store.answer(proposed, with: .applied, in: view)
    await api.serve(.day(try today(session: day(blocks: [], nextPosition: nil))))
    await store.today.refresh()
    let shown = try store.shownPlanChange(in: XCTUnwrap(store.day))

    guard case .done = result else {
      return XCTFail("the answer saves")
    }

    XCTAssertEqual(shown?.decision, .applied)
    XCTAssertEqual(shown?.change.status, "applied")
    XCTAssertEqual(shown?.change.canUndo, true)
  }

  func testAChangeThePlanMovedPastLeavesWithoutAnError() async throws {
    let applied = try planChange(status: "applied", canUndo: true)
    let view = try today(session: day(blocks: [], nextPosition: nil))
    let api = StudyAPIStub(today: .day(view))
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()

    let result = await store.answer(applied, with: .undone, in: view)

    guard case .done = result else {
      return XCTFail("a change already out of date isn't a failure to show")
    }

    XCTAssertNil(store.shownPlanChange(in: view))
  }

  func testUndoingAnAnswerAsksAboutTheProposalAgain() async throws {
    let proposed = try planChange(status: "proposed")
    let view = try today(session: day(blocks: [], nextPosition: nil), planChange: proposed)
    let api = StudyAPIStub(today: .day(view), decided: try planChange(status: "applied"))
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()

    _ = await store.answer(proposed, with: .applied, in: view)
    await api.decide(proposed)
    _ = await store.answer(proposed, with: .undone, in: view)

    XCTAssertEqual(store.shownPlanChange(in: view), AnsweredPlanChange(change: proposed))
  }

  func testAnAnsweredChangeStaysUntilTheLearnerAsksForTheNextSuggestion() async throws {
    let proposed = try planChange(status: "proposed")
    let view = try today(session: day(blocks: [], nextPosition: nil), planChange: proposed)
    let api = StudyAPIStub(today: .day(view), decided: try planChange(status: "declined"))
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()

    _ = await store.answer(proposed, with: .declined, in: view)
    let newer = try planChange(status: "proposed", id: "c2")
    await api.serve(.day(try today(session: day(blocks: [], nextPosition: nil), planChange: newer)))
    await store.today.refresh()
    let reread = try XCTUnwrap(store.day)

    XCTAssertEqual(store.shownPlanChange(in: reread)?.decision, .declined)
    XCTAssertEqual(store.nextPlanChange(in: reread)?.id, "c2")

    store.dropAnsweredPlanChange()

    XCTAssertEqual(store.shownPlanChange(in: reread), AnsweredPlanChange(change: newer))
    XCTAssertNil(store.nextPlanChange(in: reread))
  }

  func testAnAnswerStaysWithItsGoal() async throws {
    let proposed = try planChange(status: "proposed")
    let view = try today(session: day(blocks: [], nextPosition: nil), planChange: proposed)
    let api = StudyAPIStub(today: .day(view), decided: try planChange(status: "declined"))
    let store = TodayStore(api: api, cache: signedInCache())
    await store.today.load()

    _ = await store.answer(proposed, with: .declined, in: view)
    let other = try planChange(status: "proposed", id: "c2")
    let otherGoal = try today(
      session: day(blocks: [], nextPosition: nil, goalID: "g2"), planChange: other)

    XCTAssertEqual(store.shownPlanChange(in: otherGoal), AnsweredPlanChange(change: other))
    XCTAssertEqual(store.shownPlanChange(in: view)?.decision, .declined)
  }

  func testMissedDaysThatPutTheDateAtRiskAskWhatToDo() throws {
    let behind = try planChange(
      status: "applied", kind: "missedDays",
      behind:
        #"{"canFocus":true,"coveredAfter":0.8,"coveredBefore":1,"currentMinutes":45,"measure":"exam"}"#
    )
    let view = try today(session: day(blocks: [], nextPosition: nil), planChange: behind)
    let store = TodayStore(api: StudyAPIStub(today: .day(view)), cache: signedInCache())

    XCTAssertEqual(store.shownPlanChange(in: view), AnsweredPlanChange(change: behind))
    XCTAssertEqual(behind.behind?.currentMinutes, 45)
  }

  func testAFinishedBlockShowsTheServersNextOneAtOnceOnTodayAndTheSession() async throws {
    let session = try day(
      blocks: [
        block(position: 0, kind: "learn", id: "b0", lessonID: "l0", screen: "lesson"),
        block(position: 1, id: "b1"),
      ],
      nextPosition: 0, id: "s1")
    let api = StudyAPIStub(today: .day(try today(session: session)), session: session)
    let cache = signedInCache()
    let todayStore = TodayStore(api: api, cache: cache)
    let sessions = StudySessionStore(api: api, cache: cache, today: todayStore)
    await todayStore.today.load()
    await sessions.session(id: "s1").load()

    sessions.apply(try moment(blockID: "b0", nextBlockID: "b1"), sessionID: "s1")

    let shownSession = sessions.session(id: "s1").value
    XCTAssertEqual(shownSession?.nextBlock?.id, "b1")
    XCTAssertEqual(shownSession?.blocks.first?.isFinished, true)
    guard case .day(let view)? = todayStore.today.value else {
      return XCTFail("Expected Today's day")
    }
    XCTAssertEqual(view.session.nextBlock?.id, "b1")
    let reads = await api.todayReads
    XCTAssertEqual(reads, 1, "the completion shows without reading Today again")
  }

  func testAFinishedBlockEndsTheDayOrWaitsForANextBlockTheDayDoesNotList() throws {
    let session = try day(
      blocks: [block(position: 0, id: "b0"), block(position: 1, id: "b1")], nextPosition: 0,
      id: "s1")

    let ended = session.finishing(try moment(blockID: "b0", nextBlockID: nil))
    XCTAssertNil(ended.nextBlock)
    XCTAssertEqual(ended.state, .done)
    XCTAssertEqual(session.finishing(try moment(blockID: "b0", nextBlockID: "new")), session)
    XCTAssertEqual(session.finishing(try moment(blockID: "other", nextBlockID: "b1")), session)
  }

  func testALateCompletionNeverPutsAFinishedBlockBackUpNext() throws {
    let session = try day(
      blocks: [
        block(position: 0, id: "b0"), block(position: 1, id: "b1"), block(position: 2, id: "b2"),
      ],
      nextPosition: 0, id: "s1")
    let afterB1 =
      session
      .finishing(try moment(blockID: "b0", nextBlockID: "b1"))
      .finishing(try moment(blockID: "b1", nextBlockID: "b2"))

    let late = afterB1.finishing(try moment(blockID: "b0", nextBlockID: "b1"))

    XCTAssertEqual(late.nextBlock?.id, "b2")
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
  planItemID: String?, checkpoint: String?, screen: String
) -> String {
  """
  {"answered":0,"areaId":null,"brainPower":0,"canDo":null,"canTestOut":false,"capsules":[],
  "chapterId":null,"checkpoint":\(checkpoint ?? "null"),"estimatedBrainPower":5,
  "estimatedMinutes":5,"extra":false,"fullReview":false,"kind":"\(kind)",
  "lessonId":\(json(lessonID)),"mistakesOnly":false,"netScored":false,"oftenTested":false,
  "planItemId":\(json(planItemID)),"planItemKey":null,"position":\(position),"questions":3,
  "refresh":false,"reinforcement":false,"screen":"\(screen)","status":"\(status)",
  "subject":null,"title":"Block",
  "waitReason":null,"weakest":false\(id.map { ",\"id\":\"\($0)\"" } ?? "")}
  """
}

private func block(
  position: Int, kind: String = "practice", status: String = "pending", id: String? = nil,
  lessonID: String? = nil, planItemID: String? = nil, checkpoint: String? = nil,
  screen: String = "session"
) throws -> StudyBlock {
  try decode(
    blockJSON(
      position: position, kind: kind, status: status, id: id, lessonID: lessonID,
      planItemID: planItemID, checkpoint: checkpoint, screen: screen))
}

private func dayJSON(
  blocks: [StudyBlock], nextPosition: Int?, id: String?, dailyGoal: Int, emptyDay: String?,
  limitReached: Bool, localDate: String, goalID: String, state: String
) -> String {
  let blockList = blocks.map {
    blockJSON(
      position: $0.position, kind: $0.kind.rawValue,
      status: $0.status == .completed ? "completed" : "pending", id: $0.id, lessonID: $0.lessonId,
      planItemID: $0.planItemId, checkpoint: nil, screen: $0.screen.rawValue)
  }

  return """
    {"blocks":[\(blockList.joined(separator: ","))],"brainPower":0,"catchUp":null,"current":true,
    "dailyLimit":{"limitMinutes":60,"reached":\(limitReached),"remainingMinutes":0,"usedMinutes":0},
    "dayEndsAt":1793242800000,"emptyDay":\(json(emptyDay)),
    "examAccess":{"includesMockExams":true,"trialEnded":false},"examTomorrow":false,
    "extraTime":{"available":false,"lessons":[],"minutes":10,"reason":null},"freshStart":null,
    "fullMeal":{"bonus":50,"earned":false,"ready":false},"goalId":"\(goalID)","lessonsComing":false,
    "localDate":"\(localDate)","minutes":{"dailyGoal":\(dailyGoal),"done":0,"planned":15},
    "missions":[],"nextPosition":\(nextPosition.map(String.init) ?? "null"),
    "pauseSuggested":false,"plusLessons":[],"sessionBar":{"completed":0,"total":1},"state":"\(state)",
    "week":{"days":[],"nextStudyDate":null,
    "time":{"studiedMinutes":0,"targetMinutes":100}},
    "status":"\(id == nil ? "unstarted" : "active")"\(id.map { ",\"id\":\"\($0)\"" } ?? "")}
    """
}

private func day(
  blocks: [StudyBlock], nextPosition: Int?, id: String? = nil, dailyGoal: Int = 15,
  emptyDay: String? = nil, limitReached: Bool = false, localDate: String = "2026-10-28",
  goalID: String = "g1", state: String = "underway"
) throws -> StudyDay {
  try decode(
    dayJSON(
      blocks: blocks, nextPosition: nextPosition, id: id, dailyGoal: dailyGoal, emptyDay: emptyDay,
      limitReached: limitReached, localDate: localDate, goalID: goalID, state: state))
}

private func planChange(
  status: String, canUndo: Bool = false, id: String = "c1", kind: String = "edited",
  behind: String = "null"
) throws -> TodayView.PlanChange {
  try decode(
    """
    {"behind":\(behind),"canApply":true,"canUndo":\(canUndo),"effect":null,"examDocument":"notice",
    "id":"\(id)","kind":"\(kind)","officialDate":null,"reason":"Rest on Saturdays?",
    "source":"memory","status":"\(status)","todaySession":null}
    """)
}

private func today(
  session: StudyDay, planChange: TodayView.PlanChange? = nil, lessonStatus: [String: String] = [:]
) throws -> TodayView {
  TodayView(
    earlierWork: [], exam: nil, examChoice: nil,
    goal: try decode(
      #"{"dateEstimated":false,"daysLeft":null,"id":"g1","kind":"learn","title":"Goal"}"#),
    insight: nil, lessonStatus: lessonStatus, mockFunding: nil, notice: nil, pattern: nil,
    planChange: planChange, progress: nil, session: session, sourceChange: nil,
    studiedToday: false, suggestedGoal: nil, uploadRequest: nil, weeklyChallenge: nil)
}

private func moment(blockID: String, nextBlockID: String?) throws -> BlockMoment {
  try decode(
    """
    {"blockId":"\(blockID)","brainPower":10,"ceremony":null,"comesBackOn":null,
    "completedMissions":[],"correct":1,"fullMeal":{"bonus":0,"paid":false},"missions":[],
    "nextBlockId":\(json(nextBlockID)),"reached":null,"sessionCompleted":\(nextBlockID == nil),
    "total":1}
    """)
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
  private let call: LanguageCheckpointCall
  private var today: TodayContent
  private let session: StudyDay?
  private var decided: TodayView.PlanChange?
  private let holdsOpening: Bool
  private var heldOpening: CheckedContinuation<Void, Never>?
  private var openingWaiter: CheckedContinuation<Void, Never>?
  private(set) var openedTargets: [String] = []
  private(set) var startedBlocks: [String] = []
  private(set) var writtenLessons: [String] = []
  private(set) var preparedSessions: [String] = []
  private(set) var preparedGoals: [String] = []
  private(set) var readinessReads: [String] = []
  private(set) var todayReads = 0
  private let unwrittenLessons: Set<String>
  private let unreachableLessons: Set<String>
  private var holdsNextTodayRead = false
  private var failsTodayReads = false
  private var heldTodayRead: CheckedContinuation<Void, Never>?
  private var todayReadWaiter: CheckedContinuation<Void, Never>?

  init(
    opened: OpenedStudyDay? = nil, start: BlockStart = .started, startError: APIError? = nil,
    call: LanguageCheckpointCall = .notLanguage(.init(status: .notLanguage)),
    today: TodayContent = .goalNotActive, session: StudyDay? = nil,
    decided: TodayView.PlanChange? = nil, holdsOpening: Bool = false,
    unwrittenLessons: Set<String> = [], unreachableLessons: Set<String> = []
  ) {
    self.unwrittenLessons = unwrittenLessons
    self.unreachableLessons = unreachableLessons
    self.session = session
    self.decided = decided
    self.opened = opened
    self.startResult = start
    self.startError = startError
    self.call = call
    self.today = today
    self.holdsOpening = holdsOpening
  }

  func serve(_ today: TodayContent) {
    self.today = today
  }

  func decide(_ change: TodayView.PlanChange) {
    decided = change
  }

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

  func failTodayReads() {
    failsTodayReads = true
  }

  func holdNextTodayRead() {
    holdsNextTodayRead = true
  }

  func waitForHeldTodayRead() async {
    guard heldTodayRead == nil else {
      return
    }

    await withCheckedContinuation { todayReadWaiter = $0 }
  }

  func releaseTodayRead() {
    heldTodayRead?.resume()
    heldTodayRead = nil
  }

  func getToday(token: String, timeZone: String) async throws -> TodayContent {
    todayReads += 1
    let served = today

    if failsTodayReads {
      throw APIError.network
    }

    if holdsNextTodayRead {
      holdsNextTodayRead = false

      await withCheckedContinuation { continuation in
        heldTodayRead = continuation
        todayReadWaiter?.resume()
        todayReadWaiter = nil
      }
    }

    return served
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
    guard let session else {
      throw APIError.unavailable
    }

    return session
  }

  func getSummary(token: String, sessionID: String) async throws -> SessionSummary {
    throw APIError.unavailable
  }

  func lessonStatus(token: String, lessonID: String) async throws -> String {
    readinessReads.append(lessonID)
    return "ready"
  }

  func followWriting(token: String, lessonID: String, run: String?) async throws -> String {
    if unreachableLessons.contains(lessonID) {
      throw APIError.network
    }

    return unwrittenLessons.contains(lessonID) ? "failed" : "ready"
  }

  func languageCheckpointCall(token: String, blockID: String) async throws
    -> LanguageCheckpointCall
  {
    call
  }

  func writeLesson(token: String, lessonID: String) async throws -> LessonWritingOutcome {
    writtenLessons.append(lessonID)
    return .writing(run: "run-1")
  }

  func prepareSession(token: String, sessionID: String) async throws {
    preparedSessions.append(sessionID)
  }

  func prepareLessons(token: String, goalID: String) async throws {
    preparedGoals.append(goalID)
  }

  func answerUploadRequest(token: String, goalID: String, sourceIDs: [String]) async throws {}
  func dismissUploadRequest(token: String, goalID: String) async throws {}

  func answerSuggestedGoal(token: String, suggestionID: String, accepted: Bool) async throws {}
  func markMilestoneShown(token: String, milestoneID: String) async throws {}

  func getWeeklyRecap(token: String, goalID: String?) async throws -> WeeklyRecap {
    throw APIError.unavailable
  }

  func getLanguageToday(token: String, goalID: String) async throws -> LanguageTodayView {
    throw APIError.unavailable
  }

  func decidePlanChange(
    token: String, goalID: String, changeID: String, decision: PlanChangeDecision
  ) async throws -> TodayView.PlanChange? {
    decided
  }
}

extension MutationResult {
  fileprivate var destination: Value? {
    if case .done(let value) = self { value } else { nil }
  }
}
