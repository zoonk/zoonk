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
  /// The session screen, which shows the step or the summary.
  case session
  /// The session screen waiting for the step's lesson, which the tap asked to be written (or the
  /// plan to pick); it opens on its own once written, or says why it can't be written now.
  case lessonWait(blockID: String, writing: LessonWriting)
}

/// Where a lesson the learner asked for stands after their tap.
enum LessonWriting: Hashable, Sendable {
  /// A run writes it now.
  case writing
  /// The plan picks the step's lesson first (session preparation), then it's written.
  case preparing
  /// Every draft was held back by its checks; the plan moved on without it.
  case setAside
  case refused(LessonRunRefusal)
  case failed

  /// Whether work runs for it, so the session waits instead of offering the step again.
  var isRunning: Bool {
    self == .writing || self == .preparing
  }
}

/// Today for the learner's active goal, kept for the app's lifetime, and the taps that open and
/// move the day. Reading Today never writes: the day opens with the learner's tap (a POST).
@MainActor
@Observable
final class TodayStore {
  let today: Resource<TodayContent>

  /// The saved session the learner's last tap opened, for whom and for which day, so the session
  /// screen can show it while Today reads the day again, and never for another learner or day.
  private var opened: OpenedSession?
  /// Lessons the learner asked to be written, by block, with whose tap asked.
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

  /// The day Today shows, when it shows one.
  var day: TodayView? {
    guard case .day(let view) = today.value else {
      return nil
    }

    return view
  }

  /// The session the session screen shows: Today's saved one, or the one a tap just opened for this
  /// learner's same goal and day while Today reads it again.
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

  /// Where the lesson of a step the learner asked for stands; nil until they ask.
  func writing(for block: StudyBlock) -> LessonWriting? {
    guard let blockID = block.id, let asked = writings[blockID],
      asked.owner == cache.session.authenticatedSession
    else {
      return nil
    }

    return asked.writing
  }

  /// Opens one step of the day: its block on a saved day, or the day itself with the work the step
  /// is when it isn't open yet, then starts it where it plays. `next` names the day's next step as
  /// shown (Start, Continue); otherwise the learner picked this one. A step that couldn't open
  /// fails after Today is read again, so the learner sees why.
  func open(_ block: StudyBlock, next: Bool, in view: TodayView) async -> MutationResult<
    StudyDestination
  > {
    await openStep(for: OpenedSession.Day(view)) { token in
      let (sessionID, saved) = try await self.savedBlock(block, next: next, in: view, token: token)
      let destination = try await self.start(
        saved, sessionID: sessionID, lessonReady: view.isLessonReady(block), token: token)
      return (sessionID, destination)
    }
  }

  /// Opens one of today's blocks named by its id (a mission, a buddy link) as its row on Today
  /// opens it; nil when Today doesn't list it as one to do now (done meanwhile, another day), as
  /// main's `openMissionAction`.
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

  /// Opens a block of a saved session the learner picked on the session screen, where it plays.
  func open(_ block: StudyBlock, sessionID: String) async -> MutationResult<StudyDestination> {
    await openStep(for: day.map(OpenedSession.Day.init)) { token in
      (sessionID, try await self.start(block, sessionID: sessionID, lessonReady: nil, token: token))
    }
  }

  /// "Keep learning" or "Practice for 10 minutes": opens the day when needed, adds the plan's next
  /// lessons (or practice) and opens the first.
  func addExtraTime(in view: TodayView) async -> MutationResult<StudyDestination> {
    await openStep(for: OpenedSession.Day(view)) { token in
      let sessionID = try await self.keptSessionID(in: view, token: token)
      return (sessionID, try await self.addExtraBlock(sessionID: sessionID, token: token))
    }
  }

  /// Adds the plan's next lessons (or practice) to a saved session and opens the first.
  func addExtraTime(sessionID: String) async -> MutationResult<StudyDestination> {
    await openStep(for: day.map(OpenedSession.Day.init)) { token in
      (sessionID, try await self.addExtraBlock(sessionID: sessionID, token: token))
    }
  }

  /// "Catch up today": the lessons earlier days left join the end of today's session.
  func catchUp(in view: TodayView) async -> MutationResult<Void> {
    await cache.mutate(invalidating: [.goals, .userSession]) { identity in
      let sessionID = try await keptSessionID(in: view, token: identity.bearerToken)
      try await api.catchUp(
        token: identity.bearerToken, sessionID: sessionID, timeZone: TimeZone.current.identifier)
    }
  }

  /// Accepts or dismisses the goal Today suggests from the learner's last course; either answer
  /// closes it.
  func answer(_ suggestion: SuggestedGoal, accepted: Bool) async -> MutationResult<Void> {
    await cache.mutate(invalidating: [.goals]) { identity in
      try await api.answerSuggestedGoal(
        token: identity.bearerToken, suggestionID: suggestion.id, accepted: accepted)
    }
  }

  /// Runs a tap that opens a step for the session that made it: a learner who left meanwhile gets
  /// nothing (`obsolete`), and one whose step couldn't open sees Today read again.
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
    return try await start(block, sessionID: sessionID, lessonReady: nil, token: token)
  }

  /// The tapped block with its id, and its session: a saved day's own, or the day opened now with
  /// the work the step is, resolved to that same work. Throws when the day no longer has it.
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

  /// The day's saved session, opening the day with nothing tapped in it when it isn't open yet.
  private func keptSessionID(in view: TodayView, token: String) async throws -> String {
    if let sessionID = view.session.id {
      return sessionID
    }

    return try await api.openDay(
      token: token, goalID: view.session.goalId ?? view.goal.id, shownDate: view.session.localDate,
      timeZone: TimeZone.current.identifier, target: nil
    ).sessionId
  }

  /// Starts a block where it plays, by main's rule (`openStudyBlock`): questions on the session
  /// screen (whose block screen starts them), a ready lesson in the player, a challenge on its intro
  /// until it's under way, writing on its own screen. A lesson that isn't written yet waits on the
  /// session screen.
  private func start(
    _ block: StudyBlock, sessionID: String, lessonReady: Bool?, token: String
  ) async throws -> StudyDestination {
    guard let blockID = block.id else {
      throw DayChanged()
    }

    switch block.kind {
    case .review, .practice:
      return .questionBlock(sessionID: sessionID, blockID: blockID)
    case .learn:
      // A step whose lesson the plan hasn't picked yet is prepared by the tap; the session waits.
      guard let lessonID = block.lessonId else {
        try await api.prepareSession(token: token, sessionID: sessionID)
        return .lessonWait(blockID: blockID, writing: .preparing)
      }

      let ready =
        if let lessonReady {
          lessonReady
        } else {
          try await api.lessonStatus(token: token, lessonID: lessonID) == "ready"
        }

      let lesson = StudyDestination.lesson(lessonID: lessonID, sessionID: sessionID)

      if ready {
        return try await startedDestination(
          lesson, block: blockID, sessionID: sessionID, token: token)
      }

      // A lesson that isn't written is asked for right away (main's `unwrittenLesson`), without
      // starting the block: the block's preparation would race the request and hide a refusal.
      switch try await api.writeLesson(token: token, lessonID: lessonID) {
      case .ready:
        return try await startedDestination(
          lesson, block: blockID, sessionID: sessionID, token: token)
      case .writing:
        return .lessonWait(blockID: blockID, writing: .writing)
      case .setAside:
        return .lessonWait(blockID: blockID, writing: .setAside)
      case .refused(let refusal):
        return .lessonWait(blockID: blockID, writing: .refused(refusal))
      case .failed:
        return .lessonWait(blockID: blockID, writing: .failed)
      }
    case .checkpoint:
      if block.status != .active, let planItemID = block.planItemId {
        return .challenge(planItemID: planItemID, sessionID: sessionID)
      }

      let destination: StudyDestination =
        block.checkpoint?.mock == true
        ? .mock(blockID: blockID, sessionID: sessionID)
        : .checkpoint(blockID: blockID, sessionID: sessionID)

      return try await startedDestination(
        destination, block: blockID, sessionID: sessionID, token: token)
    case .produce:
      return try await startedDestination(
        .essay(blockID: blockID), block: blockID, sessionID: sessionID, token: token)
    }
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

/// A step that can't open as Today showed it: the day no longer has it, today's time is used up, or
/// it waits for earlier work. The tap fails and Today reads the day again.
private struct DayChanged: Error {}

/// A session a tap opened, for the learner who opened it and the goal and day it belongs to.
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
