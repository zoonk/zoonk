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
    await first.followLateContent()
    let reopened = player(cache: cache, content: content, transport: OfflineLessonTransport())
    await reopened.load()

    XCTAssertEqual(reads, 2)
    XCTAssertEqual(reopened.state?.steps["check"]?.imagePending, false)
    XCTAssertEqual(reopened.state?.steps["check"]?.image?.url, "https://example.com/a.png")
  }

  func testMarksThatComeLateReachTheScreensAheadAndLeaveTheOneInView() async throws {
    let cache = AppCache(session: SessionStore.preview(account: .lessonLoadingTestAccount))
    var reads = 0
    let content: Resource<LessonLoad> = cache.resource(audience: .viewer) { _ in
      reads += 1
      return .ready(try markedLesson(isTagged: reads > 1))
    }

    let store = player(cache: cache, content: content, transport: OfflineLessonTransport())
    await store.load()
    await store.followLateContent()

    XCTAssertEqual(reads, 2)
    XCTAssertEqual(store.state?.currentStep?.id, "first")
    XCTAssertNil(store.state?.steps["first"]?.marks, "the screen in view keeps its layout")
    XCTAssertEqual(store.state?.steps["second"]?.marks?.ideaIndex, 1)
    XCTAssertEqual(store.lesson?.isTagged, true)
  }

  func testIDidntGetItAsksOnlyAboutTheScreenItWasTappedOn() async throws {
    let cache = AppCache(session: SessionStore.preview(account: .lessonLoadingTestAccount))
    let content: Resource<LessonLoad> = cache.resource(audience: .viewer) { _ in
      .ready(try markedLesson(isTagged: true))
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

  private func player(
    cache: AppCache, content: Resource<LessonLoad>,
    transport: any ClientTransport = UnexpectedLessonTransport()
  ) -> LessonPlayerStore {
    let preferences: Resource<LearningPreferences> = cache.resource(audience: .signedIn) { _ in nil
    }
    return LessonPlayerStore(
      lessonId: "lesson", studySessionId: nil,
      api: LessonPlayerAPI(
        clients: APIClientFactory(
          baseURL: URL(string: "https://api.zoonk.test")!, transport: transport)),
      cache: cache, preferences: preferences, lessonResource: content)
  }
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

/// Written long ago, so following its marks reads once instead of polling.
private func markedLesson(isTagged: Bool) throws -> PlayableLesson {
  let steps = try ["first", "second"].enumerated().map { index, id in
    try JSONDecoder().decode(
      LessonStep.self,
      from: Data(
        """
        {"id": "\(id)", "position": \(index), "pictureWaitStartedAt": 0, "kind": "explanation",
         "content": {"title": null, "text": "Cells make up living things."},
         "marks": \(isTagged ? #"{"ideaIndex": \#(index)}"# : "null")}
        """.utf8))
  }

  return PlayableLesson(
    id: "lesson", title: "A lesson", language: "en", targetLanguage: nil, chapterTitle: nil,
    steps: steps, summary: nil, tutorSuggestions: [], marksPending: !isTagged)
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
     "sessionBar": {"completed": 1, "total": 3}, "sessionCompleted": false, "testOutOffer": null,
     "topHyperdrive": 0, "total": 1}}
  """#
