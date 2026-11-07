import Foundation
import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

@MainActor
final class LessonPlayerLoadingTests: XCTestCase {
  func testReopeningALessonReusesItsFreshContent() async {
    let cache = AppCache(session: SessionStore.preview(account: nil))
    var reads = 0
    let outline = LessonOutline(
      id: "lesson", title: "A lesson", description: "", estimatedMinutes: 5)
    let content: Resource<LessonLoad> = cache.resource(audience: .viewer) { _ in
      reads += 1
      return .sessionRequired(outline)
    }

    let first = player(cache: cache, content: content)
    await first.load()
    let reopened = player(cache: cache, content: content)
    await reopened.load()

    XCTAssertEqual(first.screen, .sessionRequired(outline))
    XCTAssertEqual(reopened.screen, .sessionRequired(outline))
    XCTAssertEqual(reads, 1)
  }

  func testGenerationCompletionRefreshesTheCachedOutline() async {
    let cache = AppCache(session: SessionStore.preview(account: nil))
    var reads = 0
    let outline = LessonOutline(id: "lesson", title: "Before", description: "", estimatedMinutes: 5)
    let ready = PlayableLesson(
      id: "lesson", title: "Ready", language: "en", targetLanguage: nil, chapterTitle: nil,
      steps: [], summary: nil, tutorSuggestions: [])
    let content: Resource<LessonLoad> = cache.resource(audience: .viewer) { _ in
      reads += 1
      return reads == 1 ? .notGenerated(outline) : .ready(ready)
    }
    await content.load()

    let store = player(cache: cache, content: content)
    await store.load(refresh: true)

    XCTAssertEqual(content.value, .ready(ready))
    XCTAssertEqual(reads, 2)
    XCTAssertEqual(
      store.screen,
      .sessionRequired(.init(id: "lesson", title: "Ready", description: "", estimatedMinutes: 0)))
  }

  func testFailedGenerationRefreshDoesNotReuseTheUnwrittenOutline() async {
    let cache = AppCache(session: SessionStore.preview(account: nil))
    var reads = 0
    let outline = LessonOutline(id: "lesson", title: "Before", description: "", estimatedMinutes: 5)
    let content: Resource<LessonLoad> = cache.resource(audience: .viewer) { _ in
      reads += 1
      if reads > 1 { throw APIError.network }
      return .notGenerated(outline)
    }
    await content.load()

    let store = player(cache: cache, content: content)
    await store.load(refresh: true)

    XCTAssertEqual(store.screen, .failed)
    XCTAssertEqual(reads, 2)
  }

  func testAPictureThatCameLateIsThereWhenTheLessonOpensAgain() async throws {
    let cache = AppCache(session: SessionStore.preview(account: .lessonLoadingTestAccount))
    var reads = 0
    let content: Resource<LessonLoad> = cache.resource(audience: .viewer) { _ in
      reads += 1
      return .ready(try pictureLesson(isDrawn: reads > 1))
    }

    let first = player(cache: cache, content: content, transport: OfflineLessonTransport())
    await first.load()
    await first.followLatePictures()
    let reopened = player(cache: cache, content: content, transport: OfflineLessonTransport())
    await reopened.load()

    XCTAssertEqual(reads, 2)
    XCTAssertEqual(reopened.state?.steps["check"]?.imagePending, false)
    XCTAssertEqual(reopened.state?.steps["check"]?.image?.url, "https://example.com/a.png")
  }

  func testIDidntGetItAsksOnlyAboutTheScreenItWasTappedOn() async throws {
    let cache = AppCache(session: SessionStore.preview(account: .lessonLoadingTestAccount))
    let content: Resource<LessonLoad> = cache.resource(audience: .viewer) { _ in
      .ready(try markedLesson())
    }
    let store = player(cache: cache, content: content, transport: OfflineLessonTransport())
    await store.load()

    store.ask(suggestionId: "simpler", sendsAtOnce: true)

    XCTAssertEqual(store.startingOffer(about: "first")?.sendsAtOnce, true)
    XCTAssertNil(store.startingOffer(about: "second"), "moving on with Ask open never asks again")
  }

  /// Loading the lesson again (a session renewed for the same learner) starts every answer over,
  /// so what was done on a canvas starts over with it.
  func testALessonLoadedAgainStartsItsCanvasWorkOver() async throws {
    let cache = AppCache(session: SessionStore.preview(account: .lessonLoadingTestAccount))
    let content: Resource<LessonLoad> = cache.resource(audience: .viewer) { _ in
      .ready(try pictureLesson(isDrawn: true))
    }
    let store = player(cache: cache, content: content, transport: OfflineLessonTransport())
    await store.load()
    store.work(for: "check", round: try XCTUnwrap(store.state).rounds["check"] ?? 0)
      .set(["left": "right"], for: "pairs")

    await store.load()

    let work = store.work(for: "check", round: try XCTUnwrap(store.state).rounds["check"] ?? 0)
    XCTAssertNil(work.value("pairs") as [String: String]?)
  }

  func testASessionLessonEndsWithTheMissionsItCompletedAndItsOwnBrainPower() async throws {
    let api = LessonPlayerAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!,
        transport: JSONTransport(body: sessionLessonCompletion)))

    let outcome = try await api.completeLesson(
      id: "lesson", runId: "run", skippedWritingStepIds: [], token: "token")

    guard case .completed(let summary) = outcome else {
      return XCTFail("Expected a completed lesson, got \(outcome)")
    }

    XCTAssertEqual(summary.brainPower, 12, "the day's bonus shows with the missions")
    XCTAssertEqual(summary.day?.missionMoment?.completed, [.somethingNew])
    XCTAssertEqual(summary.day?.missionMoment?.fullMeal.bonus, 50)
    XCTAssertEqual(summary.day?.reached?.level?.level, 3)
  }

  func testAFirstLessonWrittenDuringItsWarmUpWaitsForTheWaitBeforeItStarts() async {
    let cache = AppCache(session: SessionStore.preview(account: .lessonLoadingTestAccount))
    let outline = LessonOutline(id: "lesson", title: "Swarms", description: "", estimatedMinutes: 5)
    let content: Resource<LessonLoad> = cache.resource(audience: .viewer) { _ in
      .notGenerated(outline)
    }
    let store = player(cache: cache, content: content, transport: FirstLessonWritingTransport())

    await store.load()

    XCTAssertEqual(store.screen, .waiting(outline, .written))
    XCTAssertEqual(
      store.warmUp,
      LessonPlayerStore.WarmUp(deckID: "019a482c-6a00-7000-8000-000000000001", outline: outline))
  }

  /// The first screen's miss reached the server but its reply didn't; the second screen's miss and
  /// its retry never did.
  func testKeptAnswersGoOutBeforeTheRunAndPlaceTheLearnerWithIt() async throws {
    let defaults = try temporaryDefaults()
    let kept = HeldLessonAnswers(
      learnerId: "lesson-loading-test-user", lessonId: "lesson", defaults: defaults)
    let someoneElses = HeldLessonAnswers(
      learnerId: "someone-else", lessonId: "lesson", defaults: defaults)
    let lostReply = heldAnswer("one", attemptId: "lost-reply", isCorrect: false)
    let miss = heldAnswer("two", attemptId: "miss", isCorrect: false)
    let retry = heldAnswer("two", attemptId: "retry", isCorrect: true)
    let theirs = heldAnswer("three", attemptId: "theirs", isCorrect: true)
    [lostReply, miss, retry].forEach(kept.keep)
    someoneElses.keep(theirs)

    let transport = HeldAnswersTransport(
      runAnswers:
        #"[{"stepId": "one", "isCorrect": false, "answeredAt": "2026-11-07T10:00:00.000Z"}]"#
    )
    await transport.failChecks(on: ["two"])
    let store = try checksPlayer(defaults: defaults, transport: transport)

    await store.load()

    let requests = await transport.requests
    XCTAssertEqual(Set(requests.dropLast()), ["check lost-reply", "check miss"])
    XCTAssertEqual(requests.last, "start", "the run starts once they went, whatever happened")
    XCTAssertEqual(store.held, [miss, retry], "a screen stops at its first failure")
    XCTAssertEqual(kept.read(), [miss, retry])
    XCTAssertEqual(someoneElses.read(), [theirs])
    XCTAssertTrue(store.hasUnsavedAnswers)

    let state = try XCTUnwrap(store.state)
    XCTAssertEqual(state.currentStep?.id, "three", "the held miss and retry answered the second")
    XCTAssertEqual(state.queue.last, "one", "the run has the first miss once, so it comes back")
  }

  /// The retry waits behind the miss to be sent, but not to be kept.
  func testAMissAndItsRetryAreBothKeptOnTheDeviceWhileSavesFail() async throws {
    let defaults = try temporaryDefaults()
    let kept = HeldLessonAnswers(
      learnerId: "lesson-loading-test-user", lessonId: "lesson", defaults: defaults)
    let transport = HeldAnswersTransport(runAnswers: "[]")
    let store = try checksPlayer(steps: ["one"], defaults: defaults, transport: transport)
    await store.load()
    await transport.failChecks(on: ["one"])

    store.select(.check(optionId: "wrong"))
    await store.check()
    store.continueLesson()
    store.select(.check(optionId: "right"))
    await store.check()

    XCTAssertEqual(kept.read().map(\.isCorrect), [false, true])
    XCTAssertEqual(kept.read(), store.held)
  }

  func testAnAnswerThatFailedToSaveIsKeptUntilFinishingSendsIt() async throws {
    let defaults = try temporaryDefaults()
    let kept = HeldLessonAnswers(
      learnerId: "lesson-loading-test-user", lessonId: "lesson", defaults: defaults)
    let transport = HeldAnswersTransport(runAnswers: "[]")
    let store = try checksPlayer(steps: ["one"], defaults: defaults, transport: transport)
    await store.load()
    await transport.failChecks(on: ["one"])

    store.select(.check(optionId: "right"))
    await store.check()
    store.continueLesson()

    while store.state?.completion?.status == .saving {
      await Task.yield()
    }

    XCTAssertEqual(store.state?.completion?.status, .failed)
    XCTAssertEqual(kept.read(), store.held)
    XCTAssertEqual(store.held.count, 1)
    XCTAssertTrue(store.hasUnsavedAnswers)

    let attemptId = try XCTUnwrap(store.held.first?.attemptId)
    await transport.failChecks(on: [])
    await store.finish()

    let requests = await transport.requests
    XCTAssertEqual(requests.suffix(2), ["check \(attemptId)", "complete"])
    XCTAssertEqual(store.state?.completion?.status, .saved)
    XCTAssertEqual(store.held, [])
    XCTAssertEqual(kept.read(), [])
    XCTAssertFalse(store.hasUnsavedAnswers)
  }

  /// The second answer is held while the first one's save is still on its way.
  func testFinishingWaitsForEveryHeldAnswer() async throws {
    let transport = HeldAnswersTransport(runAnswers: "[]")
    let store = try checksPlayer(
      steps: ["one", "two"], defaults: try temporaryDefaults(), transport: transport)
    await store.load()
    await transport.holdChecks()

    store.select(.check(optionId: "right"))
    await store.check()
    store.continueLesson()
    store.select(.check(optionId: "right"))
    await store.check()
    store.continueLesson()

    let first = try XCTUnwrap(store.held.first?.attemptId)
    let second = try XCTUnwrap(store.held.last?.attemptId)
    await transport.release(first)

    while store.held.count > 1 {
      await Task.yield()
    }

    await transport.release(second)

    while store.state?.completion?.status == .saving {
      await Task.yield()
    }

    let requests = await transport.requests
    XCTAssertEqual(requests.suffix(2), ["answered \(second)", "complete"])
    XCTAssertEqual(store.state?.completion?.status, .saved)
  }

  /// Two windows play the same lesson: the other one's miss couldn't be saved, and this one
  /// finishes.
  func testFinishingSendsAnotherWindowsHeldAnswersInTheOrderTheyWereGiven() async throws {
    let defaults = try temporaryDefaults()
    let kept = HeldLessonAnswers(
      learnerId: "lesson-loading-test-user", lessonId: "lesson", defaults: defaults)
    let transport = HeldAnswersTransport(runAnswers: "[]")
    let other = try checksPlayer(steps: ["one"], defaults: defaults, transport: transport)
    let store = try checksPlayer(steps: ["one"], defaults: defaults, transport: transport)
    await other.load()
    await store.load()
    await transport.failChecks(on: ["one"])

    other.select(.check(optionId: "wrong"))
    await other.check()
    let miss = try XCTUnwrap(other.held.first?.attemptId)
    await waitUntil { other.hasUnsavedAnswers }
    store.select(.check(optionId: "right"))
    await store.check()
    let right = try XCTUnwrap(store.held.first?.attemptId)
    store.continueLesson()
    await waitUntil { store.state?.completion?.status == .failed }

    await transport.failChecks(on: [])
    await store.finish()

    let requests = await transport.requests
    XCTAssertEqual(requests.suffix(3), ["check \(miss)", "check \(right)", "complete"])
    XCTAssertEqual(store.state?.completion?.status, .saved)
    XCTAssertEqual(kept.read(), [])
  }

  /// The server saves a spoken answer as it grades it.
  func testASpokenAnswerSendsTheHeldAnswersAgain() async throws {
    let defaults = try temporaryDefaults()
    HeldLessonAnswers(learnerId: "lesson-loading-test-user", lessonId: "lesson", defaults: defaults)
      .keep(heldAnswer("one", attemptId: "held", isCorrect: true))
    let transport = HeldAnswersTransport(runAnswers: "[]")
    await transport.failChecks(on: ["one"])
    let store = try checksPlayer(
      steps: ["one", "spoken"], spoken: ["spoken"], defaults: defaults, transport: transport)
    await store.load()
    XCTAssertEqual(store.state?.currentStep?.id, "spoken")
    await transport.failChecks(on: [])

    store.resolveSpoken(
      SpokenAnswerVerdict(
        isCorrect: true, score: 1, transcript: "Bonjour", feedback: nil,
        heard: SpokenHeard(words: [], wordsToPractice: [])),
      stepId: "spoken")
    await waitUntil { store.held.isEmpty }

    let requests = await transport.requests
    XCTAssertEqual(requests.last, "check held")
  }

  private func waitUntil(_ condition: () -> Bool) async {
    for _ in 0..<10_000 where !condition() {
      await Task.yield()
    }

    XCTAssertTrue(condition(), "the change never showed")
  }

  private func temporaryDefaults(name: String = #function) throws -> UserDefaults {
    let defaults = try XCTUnwrap(UserDefaults(suiteName: name))
    defaults.removePersistentDomain(forName: name)
    addTeardownBlock { defaults.removePersistentDomain(forName: name) }
    return defaults
  }

  private func heldAnswer(_ stepId: String, attemptId: String, isCorrect: Bool) -> HeldAnswer {
    HeldAnswer(
      stepId: stepId, answer: .check(optionId: isCorrect ? "right" : "wrong"),
      attemptId: attemptId, runId: "run", durationMs: 1000, usedHelp: false, isCorrect: isCorrect,
      answeredAt: Date(timeIntervalSince1970: 1_800_000_000))
  }

  private func checksPlayer(
    steps: [String] = ["one", "two", "three"], spoken: Set<String> = [], defaults: UserDefaults,
    transport: HeldAnswersTransport
  ) throws -> LessonPlayerStore {
    let cache = AppCache(session: SessionStore.preview(account: .lessonLoadingTestAccount))
    let lesson = try checkLesson(steps, spoken: spoken)
    let content: Resource<LessonLoad> = cache.resource(audience: .viewer) { _ in .ready(lesson) }
    return player(cache: cache, content: content, transport: transport, defaults: defaults)
  }

  private func player(
    cache: AppCache, content: Resource<LessonLoad>,
    transport: any ClientTransport = UnexpectedLessonTransport(),
    defaults: UserDefaults = .standard
  ) -> LessonPlayerStore {
    let preferences: Resource<LearningPreferences> = cache.resource(audience: .signedIn) { _ in nil
    }
    return LessonPlayerStore(
      lessonId: "lesson", studySessionId: nil,
      api: LessonPlayerAPI(
        clients: APIClientFactory(
          baseURL: URL(string: "https://api.zoonk.test")!, transport: transport)),
      cache: cache, preferences: preferences, lessonResource: content, defaults: defaults)
  }
}

private func checkLesson(_ ids: [String], spoken: Set<String> = []) throws -> PlayableLesson {
  let check = """
    "kind": "check", "content": {"question": "Capital of France?", "basis": null, "options": [
      {"id": "right", "isCorrect": true, "reason": "It is.", "text": "Paris"},
      {"id": "wrong", "isCorrect": false, "reason": "That's Lyon.", "text": "Lyon"}]}
    """
  let speak = """
    "kind": "spokenAnswer", "content": {"language": "fr", "prompt": "Say hello.",
      "targetText": "Bonjour", "romanization": null, "translation": null}
    """
  let steps = try ids.enumerated().map { index, id in
    try JSONDecoder().decode(
      LessonStep.self,
      from: Data(
        """
        {"id": "\(id)", "position": \(index), "pictureWaitStartedAt": 0,
         \(spoken.contains(id) ? speak : check)}
        """.utf8))
  }

  return PlayableLesson(
    id: "lesson", title: "A lesson", language: "en", targetLanguage: nil, chapterTitle: nil,
    steps: steps, summary: nil, tutorSuggestions: [])
}

/// The picture's wait started long ago, so following it reads once instead of polling.
private func pictureLesson(isDrawn: Bool) throws -> PlayableLesson {
  let image =
    isDrawn
    ? #"{"id": "img", "url": "https://example.com/a.png", "alt": "A", "width": 4, "height": 3}"#
    : "null"
  let step = try JSONDecoder().decode(
    LessonStep.self,
    from: Data(
      """
      {"id": "check", "position": 0, "skillId": null, "citation": null, "image": \(image),
       "imagePending": \(!isDrawn), "pictureWaitStartedAt": 0, "kind": "check",
       "content": {"question": "Capital of France?", "basis": null, "options": [
         {"id": "right", "isCorrect": true, "reason": "It is.", "text": "Paris"},
         {"id": "wrong", "isCorrect": false, "reason": "That's Lyon.", "text": "Lyon"}]}}
      """.utf8))

  return PlayableLesson(
    id: "lesson", title: "A lesson", language: "en", targetLanguage: nil, chapterTitle: nil,
    steps: [step], summary: nil, tutorSuggestions: [])
}

private func markedLesson() throws -> PlayableLesson {
  let steps = try ["first", "second"].enumerated().map { index, id in
    try JSONDecoder().decode(
      LessonStep.self,
      from: Data(
        """
        {"id": "\(id)", "position": \(index), "pictureWaitStartedAt": 0, "kind": "explanation",
         "content": {"title": null, "text": "Cells make up living things."},
         "marks": {"ideaIndex": \(index)}}
        """.utf8))
  }

  return PlayableLesson(
    id: "lesson", title: "A lesson", language: "en", targetLanguage: nil, chapterTitle: nil,
    steps: steps, summary: nil,
    tutorSuggestions: [.init(id: .simpler, label: "Explain it more simply")])
}

extension CurrentAccount {
  fileprivate static let lessonLoadingTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test",
      id: "lesson-loading-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}

/// The network is down: starting the run fails, so the lesson plays without saving.
private struct OfflineLessonTransport: ClientTransport {
  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    throw APIError.network
  }
}

/// The goal's first lesson is being written, then is written; any other request, such as starting
/// the lesson, fails the test.
private actor FirstLessonWritingTransport: ClientTransport {
  private var readinessReads = 0

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var headerFields = HTTPFields()

    switch operationID {
    case "getLibraryLessonReadiness":
      readinessReads += 1
      headerFields[.contentType] = "application/json"
      let status = readinessReads == 1 ? "generating" : "ready"
      return (
        HTTPResponse(status: .ok, headerFields: headerFields),
        HTTPBody(
          #"{"alternative": null, "generationId": "run-1", "setAside": false, "status": "\#(status)", "warmUpId": "019a482c-6a00-7000-8000-000000000001"}"#
        )
      )
    case "streamGenerationEvents":
      headerFields[.contentType] = "text/event-stream"
      return (
        HTTPResponse(status: .ok, headerFields: headerFields),
        HTTPBody(#"data: {"status":"completed","step":"lessonReady"}"# + "\n\n")
      )
    default:
      XCTFail("Unexpected player request: \(operationID)")
      throw APIError.network
    }
  }
}

/// Starts a run with `runAnswers` and records each request in order; a check on a step in
/// `failingSteps` finds the network down.
private actor HeldAnswersTransport: ClientTransport {
  private let runAnswers: String
  private var failingSteps: Set<String> = []
  private var holdsChecks = false
  private var gates: [String: CheckedContinuation<Void, Never>] = [:]
  private var released: Set<String> = []
  private(set) var requests: [String] = []

  init(runAnswers: String) {
    self.runAnswers = runAnswers
  }

  func failChecks(on stepIds: Set<String>) {
    failingSteps = stepIds
  }

  /// Each check then waits for `release(_:)` before the server answers it.
  func holdChecks() {
    holdsChecks = true
  }

  func release(_ attemptId: String) {
    released.insert(attemptId)
    gates.removeValue(forKey: attemptId)?.resume()
  }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var headerFields = HTTPFields()
    headerFields[.contentType] = "application/json"

    switch operationID {
    case "createLibraryLessonStart":
      requests.append("start")
      return (
        HTTPResponse(status: .created, headerFields: headerFields),
        HTTPBody(
          #"{"answers": \#(runAnswers), "hyperdrive": {"knownStepIds": [], "streak": 0}, "optionalStepIds": [], "replay": false, "runId": "run", "startedAt": "2026-11-07T09:00:00.000Z"}"#
        )
      )
    case "createStepCheck":
      let input = try JSONDecoder().decode(
        CheckInput.self, from: try await Data(collecting: try XCTUnwrap(body), upTo: 1 << 20))
      let stepId = try XCTUnwrap(request.path?.split(separator: "/").dropLast().last)
      requests.append("check \(input.attemptId)")

      if holdsChecks {
        if !released.contains(input.attemptId) {
          await withCheckedContinuation { gates[input.attemptId] = $0 }
        }

        requests.append("answered \(input.attemptId)")
      }

      if failingSteps.contains(String(stepId)) {
        throw APIError.network
      }

      return (
        HTTPResponse(status: .ok, headerFields: headerFields),
        HTTPBody(
          #"{"checked": true, "correctAnswer": null, "corrections": [], "expected": null, "feedback": null, "isCorrect": \#(input.answer.optionId == "right"), "keyPoints": null, "nextReviewAt": null, "savedMistake": false, "score": null, "spelling": null}"#
        )
      )
    case "createLibraryLessonCompletion":
      requests.append("complete")
      return (
        HTTPResponse(status: .ok, headerFields: headerFields), HTTPBody(sessionLessonCompletion)
      )
    default:
      XCTFail("Unexpected player request: \(operationID)")
      throw APIError.network
    }
  }

  private struct CheckInput: Decodable {
    struct Answer: Decodable {
      let optionId: String
    }

    let answer: Answer
    let attemptId: String
  }
}

private struct UnexpectedLessonTransport: ClientTransport {
  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTFail("Unexpected player request: \(operationID)")
    throw APIError.network
  }
}

private struct JSONTransport: ClientTransport {
  let body: String

  func send(
    _ request: HTTPRequest, body _: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var headerFields = HTTPFields()
    headerFields[.contentType] = "application/json"
    return (HTTPResponse(status: .ok, headerFields: headerFields), HTTPBody(body))
  }
}

private let sessionLessonCompletion = #"""
  {"brainPower": 62, "ceremony": null, "certificates": [], "correctCount": 1, "energyDelta": 0.5, "incorrectCount": 0,
   "isFirstCompletion": true, "nextReviewAt": null, "seconds": 120, "totalBrainPower": 400,
   "reached": {"energy": null, "level": {"color": "yellow", "level": 3}},
   "studyBlock": {
     "blockId": "0192f8a4-3c2b-7d1e-8f00-000000000001", "brainPower": 62, "capsulesOpened": 0,
     "ceremony": null, "certificates": [], "checkpoint": null, "comesBackOn": null,
     "completedMissions": ["somethingNew"],
     "correct": 1, "fullMeal": {"bonus": 50, "paid": true}, "milestones": [],
     "missions": [{"kind": "somethingNew", "status": "done", "done": 1, "total": 1}],
     "netScore": null, "nextBlockId": null,
     "reached": {"energy": null, "level": {"color": "yellow", "level": 3}},
     "reminderOffer": null, "sessionBar": {"completed": 1, "total": 3}, "sessionCompleted": false,
     "testOutOffer": null,
     "topHyperdrive": 0, "total": 1}}
  """#
