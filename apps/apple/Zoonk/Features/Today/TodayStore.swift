import Foundation
import Observation

enum StudyDestination: Equatable, Sendable {
  case challenge(planItemID: String, sessionID: String)
  case checkpoint(blockID: String, sessionID: String)
  case essay(blockID: String)
  case lesson(lessonID: String, sessionID: String)
  case mock(blockID: String, sessionID: String)
  case questionBlock(sessionID: String, blockID: String)
  case session
  case lessonWait(blockID: String, writing: LessonWriting)
}

enum LessonWriting: Hashable, Sendable {
  case writing
  case preparing
  /// Every draft was held back by its checks; the plan moved on without it.
  case setAside
  case refused(LessonRunRefusal)
  case failed

  var isRunning: Bool {
    self == .writing || self == .preparing
  }
}

/// Reading Today never writes: the day opens with the learner's tap (a POST).
@MainActor
@Observable
final class TodayStore {
  let today: Resource<TodayContent>

  /// Shown while Today reads the day again, never for another learner or day.
  private var opened: OpenedSession?
  private var writings: [String: (owner: AuthenticatedSession, writing: LessonWriting)] = [:]

  @ObservationIgnored private let api: any StudyAPIClient
  @ObservationIgnored private let cache: AppCache

  init(api: any StudyAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
    today = cache.resource(
      audience: .signedIn,
      domains: [.goals, .learningProfile, .userProgress, .userSession, .userSubscription]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.getToday(
        token: session.bearerToken, timeZone: TimeZone.current.identifier)
    }
  }

  var day: TodayView? {
    guard case .day(let view) = today.value else {
      return nil
    }

    return view
  }

  var sessionID: String? {
    guard let day else {
      return nil
    }

    if let saved = day.session.id {
      return saved
    }

    guard let opened, opened.owner == cache.session.authenticatedSession,
      opened.day == OpenedSession.Day(day)
    else {
      return nil
    }

    return opened.sessionID
  }

  func writing(for block: StudyBlock) -> LessonWriting? {
    guard let blockID = block.id, let asked = writings[blockID],
      asked.owner == cache.session.authenticatedSession
    else {
      return nil
    }

    return asked.writing
  }

  /// A step that couldn't open fails after Today is read again, so the learner sees why.
  func open(_ block: StudyBlock, next: Bool, in view: TodayView) async -> MutationResult<
    StudyDestination
  > {
    if let opened = openQuestions(block, sessionID: view.session.id, day: OpenedSession.Day(view)) {
      return opened
    }

    return await openStep(for: OpenedSession.Day(view)) { token in
      let (sessionID, saved) = try await self.savedBlock(block, next: next, in: view, token: token)
      return (sessionID, try await self.start(saved, sessionID: sessionID, token: token))
    }
  }

  /// Nil when Today doesn't list it as one to do now (done meanwhile, another day).
  func open(blockID: String) async -> MutationResult<StudyDestination>? {
    guard let view = day,
      let block = view.session.blocks.first(where: {
        $0.id == blockID && !$0.isFinished && $0.waitReason == nil
      })
    else {
      return nil
    }

    return await open(block, next: false, in: view)
  }

  func open(_ block: StudyBlock, sessionID: String) async -> MutationResult<StudyDestination> {
    if let opened = openQuestions(block, sessionID: sessionID, day: day.map(OpenedSession.Day.init))
    {
      return opened
    }

    return await openStep(for: day.map(OpenedSession.Day.init)) { token in
      (sessionID, try await self.start(block, sessionID: sessionID, token: token))
    }
  }

  func addExtraTime(in view: TodayView) async -> MutationResult<StudyDestination> {
    await openStep(for: OpenedSession.Day(view)) { token in
      let sessionID = try await self.keptSessionID(in: view, token: token)
      return (sessionID, try await self.addExtraBlock(sessionID: sessionID, token: token))
    }
  }

  func addExtraTime(sessionID: String) async -> MutationResult<StudyDestination> {
    await openStep(for: day.map(OpenedSession.Day.init)) { token in
      (sessionID, try await self.addExtraBlock(sessionID: sessionID, token: token))
    }
  }

  func catchUp(in view: TodayView) async -> MutationResult<Void> {
    await cache.mutate(invalidating: [.goals, .userSession]) { identity in
      let sessionID = try await keptSessionID(in: view, token: identity.bearerToken)
      try await api.catchUp(
        token: identity.bearerToken, sessionID: sessionID, timeZone: TimeZone.current.identifier)
    }
  }

  func answer(_ suggestion: SuggestedGoal, accepted: Bool) async -> MutationResult<Void> {
    await cache.mutate(invalidating: [.goals]) { identity in
      try await api.answerSuggestedGoal(
        token: identity.bearerToken, suggestionID: suggestion.id, accepted: accepted)
    }
  }

  /// A review or practice in a saved session opens on its own screen, which starts it: the tap writes
  /// nothing, so nothing is invalidated and Today isn't read again.
  private func openQuestions(_ block: StudyBlock, sessionID: String?, day: OpenedSession.Day?)
    -> MutationResult<StudyDestination>?
  {
    guard let sessionID, let blockID = block.id, block.isQuestionBlock,
      let owner = cache.session.authenticatedSession
    else {
      return nil
    }

    if let day {
      opened = OpenedSession(owner: owner, day: day, sessionID: sessionID)
    }

    return .done(.questionBlock(sessionID: sessionID, blockID: blockID))
  }

  private func openStep(
    for day: OpenedSession.Day?,
    _ open: (_ token: String) async throws -> (sessionID: String, destination: StudyDestination)
  ) async -> MutationResult<StudyDestination> {
    switch await cache.mutate(
      invalidating: [.userProgress, .userSession], { try await open($0.bearerToken) })
    {
    case .done(let result):
      // `mutate` returns `done` only while the learner who tapped is still the one signed in.
      if let owner = cache.session.authenticatedSession {
        if let day {
          opened = OpenedSession(owner: owner, day: day, sessionID: result.sessionID)
        }

        switch result.destination {
        case .lessonWait(let blockID, let writing):
          writings[blockID] = (owner, writing)
        case .lesson:
          writings = [:]
        default:
          break
        }
      }

      return .done(result.destination)
    case .failed(let error):
      cache.invalidate([.userSession])
      return .failed(error)
    case .obsolete:
      return .obsolete
    }
  }

  private func addExtraBlock(sessionID: String, token: String) async throws -> StudyDestination {
    let block = try await api.addExtraBlock(token: token, sessionID: sessionID)
    return try await start(block, sessionID: sessionID, token: token)
  }

  /// Throws when the day no longer has the block.
  private func savedBlock(_ block: StudyBlock, next: Bool, in view: TodayView, token: String)
    async throws -> (String, StudyBlock)
  {
    if let sessionID = view.session.id, block.id != nil {
      return (sessionID, block)
    }

    let ref = DayBlockRef(block)
    let opened = try await api.openDay(
      token: token, goalID: view.session.goalId ?? view.goal.id, shownDate: view.session.localDate,
      timeZone: TimeZone.current.identifier, target: next ? .next(ref) : .ref(ref))

    guard let target = opened.target else {
      throw DayChanged()
    }

    return (opened.sessionId, target)
  }

  private func keptSessionID(in view: TodayView, token: String) async throws -> String {
    if let sessionID = view.session.id {
      return sessionID
    }

    return try await api.openDay(
      token: token, goalID: view.session.goalId ?? view.goal.id, shownDate: view.session.localDate,
      timeZone: TimeZone.current.identifier, target: nil
    ).sessionId
  }

  /// Mirrors main's `openStudyBlock`.
  private func start(_ block: StudyBlock, sessionID: String, token: String) async throws
    -> StudyDestination
  {
    guard let blockID = block.id else {
      throw DayChanged()
    }

    switch try await screen(of: block, token: token) {
    case .session, .unknown:
      guard block.kind == .learn else {
        return .questionBlock(sessionID: sessionID, blockID: blockID)
      }

      return try await unwrittenLesson(block, blockID: blockID, sessionID: sessionID, token: token)
    case .lesson:
      let lesson = block.lessonId.map {
        StudyDestination.lesson(lessonID: $0, sessionID: sessionID)
      }
      return try await startedDestination(
        lesson ?? .session, block: blockID, sessionID: sessionID, token: token)
    case .challenge:
      if block.status != .active, let planItemID = block.planItemId {
        return try await waitingChallenge(
          block, blockID: blockID, planItemID: planItemID, sessionID: sessionID, token: token)
      }

      return try await startedDestination(
        challenge(block, blockID: blockID, sessionID: sessionID), block: blockID,
        sessionID: sessionID, token: token)
    case .essay:
      return try await startedDestination(
        .essay(blockID: blockID), block: blockID, sessionID: sessionID, token: token)
    }
  }

  private func screen(of block: StudyBlock, token: String) async throws -> StudyBlock.Screen {
    guard block.screen == .unknown, let lessonID = block.lessonId else {
      return block.screen
    }

    return try await api.lessonStatus(token: token, lessonID: lessonID) == "ready"
      ? .lesson : .session
  }

  /// A step whose lesson the plan hasn't picked yet is prepared by the tap; the session waits. A
  /// lesson that isn't written is asked for right away, without starting the block: the block's
  /// preparation would race the request and hide a refusal.
  private func unwrittenLesson(
    _ block: StudyBlock, blockID: String, sessionID: String, token: String
  ) async throws -> StudyDestination {
    guard let lessonID = block.lessonId else {
      try await api.prepareSession(token: token, sessionID: sessionID)
      return .lessonWait(blockID: blockID, writing: .preparing)
    }

    switch try await api.writeLesson(token: token, lessonID: lessonID) {
    case .ready:
      return try await startedDestination(
        .lesson(lessonID: lessonID, sessionID: sessionID), block: blockID, sessionID: sessionID,
        token: token)
    case .writing:
      return .lessonWait(blockID: blockID, writing: .writing)
    case .setAside:
      return .lessonWait(blockID: blockID, writing: .setAside)
    case .refused(let refusal):
      return .lessonWait(blockID: blockID, writing: .refused(refusal))
    case .failed:
      return .lessonWait(blockID: blockID, writing: .failed)
    }
  }

  /// Mirrors main's `toChallengeDestination`: a language goal's call opens on its own intro, which
  /// starts it; any other challenge opens on the challenge's intro.
  private func waitingChallenge(
    _ block: StudyBlock, blockID: String, planItemID: String, sessionID: String, token: String
  ) async throws -> StudyDestination {
    switch try await api.languageCheckpointCall(token: token, blockID: blockID) {
    case .earlierFirst:
      throw DayChanged()
    case .notLanguage, .plusRequired:
      return .challenge(planItemID: planItemID, sessionID: sessionID)
    case .ready, .notStarted, .preparing:
      return challenge(block, blockID: blockID, sessionID: sessionID)
    }
  }

  private func challenge(_ block: StudyBlock, blockID: String, sessionID: String)
    -> StudyDestination
  {
    block.checkpoint?.mock == true
      ? .mock(blockID: blockID, sessionID: sessionID)
      : .checkpoint(blockID: blockID, sessionID: sessionID)
  }

  private func startedDestination(
    _ destination: StudyDestination, block: String, sessionID: String, token: String
  ) async throws -> StudyDestination {
    switch try await api.startBlock(
      token: token, sessionID: sessionID, blockID: block, timeZone: TimeZone.current.identifier)
    {
    case .started:
      return destination
    case .finished:
      return .session
    case .dailyLimitReached, .earlierFirst:
      throw DayChanged()
    }
  }
}

private struct DayChanged: Error {}

private struct OpenedSession {
  struct Day: Equatable {
    let goalID: String
    let localDate: String

    init(_ view: TodayView) {
      goalID = view.session.goalId ?? view.goal.id
      localDate = view.session.localDate
    }
  }

  let owner: AuthenticatedSession
  let day: Day
  let sessionID: String
}
