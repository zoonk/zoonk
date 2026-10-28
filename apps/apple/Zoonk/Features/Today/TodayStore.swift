import Foundation
import Observation

/// Where a step of the day plays once the learner's tap opened it (main's `StudyDestination`).
enum StudyDestination: Equatable, Sendable {
  case challenge(planItemID: String, sessionID: String)
  case checkpoint(blockID: String, sessionID: String)
  case essay(blockID: String)
  case lesson(lessonID: String, sessionID: String)
  case mock(blockID: String, sessionID: String)
  case questionBlock(sessionID: String, blockID: String)
  /// The session screen, which shows the step (a lesson still being written) or the summary.
  case session
}

/// Today for the learner's active goal, kept for the app's lifetime, and the taps that open and
/// move the day. Reading Today never writes: the day opens with the learner's tap (a POST).
@MainActor
@Observable
final class TodayStore {
  let today: Resource<TodayContent>

  /// The saved session the learner's last tap opened, for the session screen while Today reads
  /// the day again.
  private(set) var openedSessionID: String?

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

  /// The day Today shows, when it shows one.
  var day: TodayView? {
    guard case .day(let view) = today.value else {
      return nil
    }

    return view
  }

  /// The session the session screen shows: the one a tap just opened, or the day's saved one.
  var sessionID: String? {
    openedSessionID ?? day?.session.id
  }

  /// Opens one step of the day: its block on a saved day, or the day itself with the work the step
  /// is when it isn't open yet, then starts it where it plays. `next` names the day's next step as
  /// shown (Start, Continue); otherwise the learner picked this one. Nil when it couldn't open,
  /// after reading the day again so the learner sees why.
  func open(_ block: StudyBlock, next: Bool, in view: TodayView) async -> StudyDestination? {
    guard let token = cache.session.authenticatedSession?.bearerToken else {
      return nil
    }

    let timeZone = TimeZone.current.identifier

    do {
      let opened = try await savedBlock(block, next: next, in: view, token: token)

      guard let (sessionID, saved) = opened else {
        cache.invalidate([.userSession])
        return nil
      }

      openedSessionID = sessionID
      let destination = try await start(
        saved, sessionID: sessionID, lessonReady: view.isLessonReady(block), token: token,
        timeZone: timeZone)
      cache.invalidate([.userSession, .userProgress])
      return destination
    } catch {
      return nil
    }
  }

  /// Opens a block of a saved session the learner picked on the session screen, where it plays.
  func open(_ block: StudyBlock, sessionID: String) async -> StudyDestination? {
    guard let token = cache.session.authenticatedSession?.bearerToken else {
      return nil
    }

    do {
      let destination = try await start(
        block, sessionID: sessionID, lessonReady: nil, token: token,
        timeZone: TimeZone.current.identifier)
      cache.invalidate([.userSession, .userProgress])
      return destination
    } catch {
      return nil
    }
  }

  /// "Keep learning" or "Practice for 10 minutes": opens the day when needed, adds the plan's next
  /// lessons (or practice) and opens the first.
  func addExtraTime(in view: TodayView) async -> StudyDestination? {
    guard let token = cache.session.authenticatedSession?.bearerToken,
      let sessionID = try? await keptSessionID(in: view, token: token)
    else {
      return nil
    }

    return await addExtraTime(sessionID: sessionID)
  }

  /// Adds the plan's next lessons (or practice) to a saved session and opens the first.
  func addExtraTime(sessionID: String) async -> StudyDestination? {
    guard let token = cache.session.authenticatedSession?.bearerToken else {
      return nil
    }

    do {
      let block = try await api.addExtraBlock(token: token, sessionID: sessionID)
      openedSessionID = sessionID
      let destination = try await start(
        block, sessionID: sessionID, lessonReady: nil, token: token,
        timeZone: TimeZone.current.identifier)
      cache.invalidate([.userSession, .userProgress])
      return destination
    } catch {
      cache.invalidate([.userSession])
      return nil
    }
  }

  /// "Catch up today": the lessons earlier days left join the end of today's session.
  func catchUp(in view: TodayView) async -> Bool {
    guard let token = cache.session.authenticatedSession?.bearerToken,
      let sessionID = try? await keptSessionID(in: view, token: token)
    else {
      return false
    }

    do {
      try await api.catchUp(
        token: token, sessionID: sessionID, timeZone: TimeZone.current.identifier)
      cache.invalidate([.userSession, .goals])
      return true
    } catch {
      return false
    }
  }

  /// Accepts or dismisses the insight Today shows; accepting may change the plan.
  func answerInsight(_ insight: TodayView.Insight, accepted: Bool) async -> Bool {
    guard let token = cache.session.authenticatedSession?.bearerToken else {
      return false
    }

    do {
      try await api.answerInsight(token: token, insightID: insight.id, accepted: accepted)
      cache.invalidate([.goals, .learnerModel])
      return true
    } catch {
      return false
    }
  }

  /// The tapped block with its id, and its session: a saved day's own, or the day opened now with
  /// the work the step is, resolved to that same work. Nil when the day no longer has it.
  private func savedBlock(_ block: StudyBlock, next: Bool, in view: TodayView, token: String)
    async throws -> (String, StudyBlock)?
  {
    if let sessionID = view.session.id, block.id != nil {
      return (sessionID, block)
    }

    let ref = DayBlockRef(block)
    let opened = try await api.openDay(
      token: token, goalID: view.session.goalId ?? view.goal.id, shownDate: view.session.localDate,
      timeZone: TimeZone.current.identifier, target: next ? .next(ref) : .ref(ref))

    return opened.target.map { (opened.sessionId, $0) }
  }

  /// The day's saved session, opening the day with nothing tapped in it when it isn't open yet.
  private func keptSessionID(in view: TodayView, token: String) async throws -> String {
    if let sessionID = view.session.id {
      return sessionID
    }

    let opened = try await api.openDay(
      token: token, goalID: view.session.goalId ?? view.goal.id, shownDate: view.session.localDate,
      timeZone: TimeZone.current.identifier, target: nil)
    openedSessionID = opened.sessionId
    return opened.sessionId
  }

  /// Starts a block where it plays, by main's rule (`openStudyBlock`): questions on the session
  /// screen (whose block screen starts them), a ready lesson in the player, a challenge on its intro
  /// until it's under way, writing on its own screen. A lesson that isn't written yet waits on the
  /// session screen.
  private func start(
    _ block: StudyBlock, sessionID: String, lessonReady: Bool?, token: String, timeZone: String
  ) async throws -> StudyDestination? {
    guard let blockID = block.id else {
      return nil
    }

    switch block.kind {
    case .review, .practice:
      return .questionBlock(sessionID: sessionID, blockID: blockID)
    case .learn:
      guard let lessonID = block.lessonId else {
        return .session
      }

      let ready =
        if let lessonReady {
          lessonReady
        } else {
          try await api.lessonStatus(token: token, lessonID: lessonID) == "ready"
        }

      guard ready else {
        return .session
      }

      return try await startedDestination(
        .lesson(lessonID: lessonID, sessionID: sessionID), block: blockID, sessionID: sessionID,
        token: token, timeZone: timeZone)
    case .checkpoint:
      if block.status != .active, let planItemID = block.planItemId {
        return .challenge(planItemID: planItemID, sessionID: sessionID)
      }

      let destination: StudyDestination =
        block.checkpoint?.mock == true
        ? .mock(blockID: blockID, sessionID: sessionID)
        : .checkpoint(blockID: blockID, sessionID: sessionID)

      return try await startedDestination(
        destination, block: blockID, sessionID: sessionID, token: token, timeZone: timeZone)
    case .produce:
      return try await startedDestination(
        .essay(blockID: blockID), block: blockID, sessionID: sessionID, token: token,
        timeZone: timeZone)
    }
  }

  private func startedDestination(
    _ destination: StudyDestination, block: String, sessionID: String, token: String,
    timeZone: String
  ) async throws -> StudyDestination? {
    switch try await api.startBlock(
      token: token, sessionID: sessionID, blockID: block, timeZone: timeZone)
    {
    case .started:
      return destination
    case .finished:
      return .session
    case .dailyLimitReached, .earlierFirst:
      return nil
    }
  }
}
