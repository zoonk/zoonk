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

  private func player(cache: AppCache, content: Resource<LessonLoad>) -> LessonPlayerStore {
    let preferences: Resource<LearningPreferences> = cache.resource(audience: .signedIn) { _ in nil
    }
    return LessonPlayerStore(
      lessonId: "lesson", studySessionId: nil,
      api: LessonPlayerAPI(
        clients: APIClientFactory(
          baseURL: URL(string: "https://api.zoonk.test")!, transport: UnexpectedLessonTransport())),
      cache: cache, preferences: preferences, lessonResource: content)
  }
}

/// Content reads come from the injected resource; these scenarios never start an authenticated run.
private struct UnexpectedLessonTransport: ClientTransport {
  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTFail("Unexpected player request: \(operationID)")
    throw APIError.network
  }
}
