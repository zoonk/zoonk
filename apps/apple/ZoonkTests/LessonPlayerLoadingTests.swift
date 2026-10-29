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
      steps: [], summaryIdeas: [], tutorSuggestions: [])
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
    steps: [step], summaryIdeas: [], tutorSuggestions: [])
}

extension CurrentAccount {
  fileprivate static let lessonLoadingTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      displayUsername: "learner",
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

private struct UnexpectedLessonTransport: ClientTransport {
  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTFail("Unexpected player request: \(operationID)")
    throw APIError.network
  }
}
