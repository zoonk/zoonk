import Foundation

enum AppLink: Equatable {
  case tab(AppTab)
  case route(AppRoute)
  case block(blockId: String)

  /// Mirrors `SUPPORTED_LOCALES` in `@zoonk/utils/locale`, which main prefixes its paths with.
  private static let localePrefixes: Set<String> = ["de", "en", "es", "fr", "pt"]

  init?(url: URL) {
    guard url.scheme == "https" || url.scheme == "http" else {
      return nil
    }

    var components = url.pathComponents.filter { $0 != "/" }

    if let first = components.first, Self.localePrefixes.contains(first) {
      components.removeFirst()
    }

    let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []

    guard let link = Self.link(for: components, query: query) else {
      return nil
    }

    self = link
  }

  private static func link(for path: [String], query: [URLQueryItem]) -> AppLink? {
    func value(_ name: String) -> String? {
      query.first { $0.name == name }?.value.flatMap { $0.isEmpty ? nil : $0 }
    }

    let session = value("session")

    let paddedPath = path + Array(repeating: "", count: max(0, 3 - path.count))

    switch (path.count, paddedPath[0], paddedPath[1], paddedPath[2]) {
    case (1, "today", _, _): return .tab(.today)
    case (1, "plan", _, _): return .tab(.plan)
    case (1, "buddy", _, _): return .tab(.buddy)
    case (1, "stats", _, _): return .route(.statistics)
    case (1, "courses", _, _): return .route(.catalog)
    case (1, "mind-maps", _, _): return .route(.mindMaps)
    case (1, "exam", _, _): return .route(.exam)
    case (1, "mistakes", _, _): return .route(.mistakes)
    case (1, "speaking", _, _): return .route(.speaking)
    case (2, "buddy", "earlier-questions", _): return .route(.earlierQuestions)
    case (2, "mock", "new", _): return .route(.mockChooser)
    case (2, "plan", let subjectKey, _): return .route(.subject(subjectKey: subjectKey))
    case (3, "content", "chapters", let chapterId): return .route(.chapter(chapterId: chapterId))
    case (3, "content", "units", let chapterId): return .route(.languageUnit(chapterId: chapterId))
    case (1, "session", _, _): return value("block").map { .block(blockId: $0) } ?? .route(.session)
    case (1, "logbook", _, _): return .route(.logbook)
    case (2, "learn", let lessonId, _):
      return .route(.lesson(lessonId: lessonId, sessionId: session))
    case (2, "mistakes", "practice", _): return .route(.mistakePractice(skillId: value("skill")))
    case (2, "pattern", let patternId, _): return .route(.pattern(patternId: patternId))
    case (2, "test-out", let chapterId, _): return .route(.testOut(chapterId: chapterId))
    case (1, "focus-test", _, _):
      return value("goal").map { .route(.focusTest(goalId: $0)) }
    case (2, "challenge", let planItemId, _):
      return .route(.challenge(planItemId: planItemId, sessionId: session))
    case (2, "checkpoint", let blockId, _):
      return .route(.checkpoint(blockId: blockId, sessionId: session))
    case (2, "essay", let blockId, _): return .route(.essay(blockId: blockId))
    case (3, "mock", "placement", let goalId): return .route(.placementMock(goalId: goalId))
    case (2, "mock", let blockId, _): return .route(.mock(blockId: blockId, sessionId: session))
    case (1, "pronunciation", _, _): return .route(.pronunciation(goalId: value("goal")))
    case (2, "conversation", let conversationId, _):
      return .route(.conversation(conversationId: conversationId))
    case (1, "start", _, _): return .route(.startGoal(goal: value("goal")))
    case (3, "start", "course", let courseId):
      return .route(.courseStart(courseId: courseId, chapterId: value("chapter")))
    case (2, "start", let goalId, _): return .route(.goalSetup(goalId: goalId))
    case (2, "explain", let goalId, _): return .route(.explain(goalId: goalId))
    case (2, "plan-link", let planId, _): return .route(.planLink(planId: planId))
    default: return nil
    }
  }
}
