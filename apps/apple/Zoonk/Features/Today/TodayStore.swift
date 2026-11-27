import Foundation
import Observation

enum StudyDestination: Hashable, Sendable {
  case challenge(planItemID: String, sessionID: String)
  case checkpoint(blockID: String, sessionID: String)
  case essay(blockID: String, start: WritingStart?)
  case lesson(lessonID: String, sessionID: String)
  case mock(blockID: String, sessionID: String)
  case questionBlock(blockID: String)
  case instantLesson(lessonID: String, sessionID: String?, opening: LessonOpening)
  case session
  case lessonWait(blockID: String, writing: LessonWriting)
  case today
  /// What the learner saw changed, so nothing opened: the screen reads again.
  case changed
}

/// Continue names the step the learner saw as next.
enum StudyTap: Sendable {
  case next
  case block
  case mission
}

enum LessonWriting: Hashable, Sendable {
  case writing(run: String?)
  /// Every draft was held back by its checks; the plan moved on without it.
  case setAside
  case refused(LessonRunRefusal)
  case failed

  var isRunning: Bool {
    if case .writing = self { true } else { false }
  }
}

/// Reading Today never writes: the day opens with the learner's tap (a POST).
@MainActor
@Observable
final class TodayStore {
  let today: Resource<TodayContent>

  /// Shown while Today reads the day again, never for another learner or day.
  private var opened: OpenedSession?
  /// Main holds an answered change on Today with what it did and its Undo while the day reads
  /// again; never for another learner, goal or day.
  private var answered:
    (owner: AuthenticatedSession, day: OpenedSession.Day, value: AnsweredPlanChange)?
  private var writings: [String: (owner: AuthenticatedSession, writing: LessonWriting)] = [:]

  @ObservationIgnored private let api: any StudyAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var languageTodays: [String: Resource<LanguageTodayView>] = [:]

  func apply(_ completion: BlockMoment, sessionID: String) {
    today.update { content in
      guard case .day(var view) = content, view.session.id == sessionID else {
        return content
      }

      view.session = view.session.finishing(completion)
      return .day(view)
    }
  }

  @ObservationIgnored private let saves: LearnerSaves

  init(api: any StudyAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
    saves = LearnerSaves(cache: cache)
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

  func languageToday(goalID: String) -> Resource<LanguageTodayView> {
    if let resource = languageTodays[goalID] {
      return resource
    }

    let api = api
    let resource: Resource<LanguageTodayView> = cache.resource(
      audience: .signedIn, domains: [.goals, .userProgress, .userSession, .userSubscription]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.getLanguageToday(token: session.bearerToken, goalID: goalID)
    }

    languageTodays[goalID] = resource
    return resource
  }

  func isGettingReady(_ block: StudyBlock, in view: TodayView?) -> Bool {
    block.preparing || view?.isBeingWritten(block) == true
  }

  /// Only readiness says a lesson stopped, so each is followed until it names no run writing it.
  func followWriting(lessonIDs: [String]) async {
    guard let owner = cache.session.authenticatedSession else {
      return
    }

    let api = api

    await withTaskGroup { group in
      for lessonID in lessonIDs {
        group.addTask {
          let lesson = try? await api.followWriting(
            token: owner.bearerToken, lessonID: lessonID, run: nil)
          await self.followed(lessonID, endedAs: lesson, owner: owner)
        }
      }
    }
  }

  private func followed(
    _ lessonID: String, endedAs lesson: Components.Schemas.LessonReadiness?,
    owner: AuthenticatedSession
  ) async {
    guard !Task.isCancelled, owner == cache.session.authenticatedSession else {
      return
    }

    if let lesson, let status = LessonStatus(rawValue: lesson.status.rawValue) {
      today.update { content in
        guard case .day(var view) = content else {
          return content
        }

        view.session.blocks = view.session.blocks.map { block in
          var block = block
          if block.lessonId == lessonID {
            block.lesson = StudyBlock.Lesson(status: status, setAside: lesson.setAside)
          }
          return block
        }
        return .day(view)
      }
    }

    // A read already on its way may predate the lesson's end.
    today.invalidate()
    await today.refresh()
  }

  var day: TodayView? {
    guard case .day(let view) = today.value else {
      return nil
    }

    return view
  }

  /// The session the learner's last opening named, while Today still shows the day it showed then
  /// (or still isn't read, as for a mission opened from Buddy); otherwise Today's saved one.
  var sessionID: String? {
    guard let opened, opened.owner == cache.session.authenticatedSession,
      opened.day == day.map(OpenedSession.Day.init)
    else {
      return day?.session.id
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
  func open(_ block: StudyBlock, as tap: StudyTap, in view: TodayView) async -> MutationResult<
    StudyDestination
  > {
    await open(block, as: tap, on: view.session, goalID: view.goal.id)
  }

  /// `goalID` stands in for a day that names no goal.
  func open(_ block: StudyBlock, as tap: StudyTap, on day: StudyDay, goalID: String) async
    -> MutationResult<StudyDestination>
  {
    let shown = OpenedSession.Day(day, goalID: goalID)

    if block.opensInPlayer, let lessonID = block.lessonId {
      struct Input: Encodable {
        let goalId: String
        let shownDate: String
        let target: DayTarget
      }
      do {
        let opening: LessonOpening
        if day.status != .unstarted, day.id != nil, let id = block.id {
          opening = .block(id)
        } else {
          opening = try LessonOpening(
            Input(
              goalId: shown.goalID, shownDate: shown.localDate,
              target: .ref(DayBlockRef(block))))
        }
        return .done(.instantLesson(lessonID: lessonID, sessionID: day.id, opening: opening))
      } catch { return .failed(.unavailable) }
    }
    return await openStep(for: shown) { token in
      guard let sessionID = day.id, let blockID = block.id else {
        let ref = DayBlockRef(block)
        let opened = try await self.openDay(
          shown, target: tap == .next ? .next(ref) : .ref(ref), token: token)
        return opened.opening ?? .StudyBlockOpeningChanged(.init(kind: .changed))
      }

      return try await self.openBlock(tap, blockID: blockID, sessionID: sessionID, token: token)
    }
  }

  /// A written lesson opened from Today opens its day only when its run starts, so the session it
  /// names is the one the session screen shows.
  func lessonStarted(in sessionID: String) {
    guard let owner = cache.session.authenticatedSession else { return }
    opened = OpenedSession(owner: owner, day: day.map(OpenedSession.Day.init), sessionID: sessionID)
  }

  /// A mission link from outside Today.
  func open(blockID: String) async -> MutationResult<StudyDestination> {
    await openStep(for: day.map(OpenedSession.Day.init)) { token in
      try await self.openBlock(.mission(.init(blockId: blockID, kind: .mission)), token: token)
    }
  }

  func open(_ block: StudyBlock, as tap: StudyTap, sessionID: String) async -> MutationResult<
    StudyDestination
  > {
    if block.opensInPlayer, let lessonID = block.lessonId, let id = block.id {
      return .done(.instantLesson(lessonID: lessonID, sessionID: sessionID, opening: .block(id)))
    }
    return await openStep(for: day.map(OpenedSession.Day.init)) { token in
      guard let blockID = block.id else {
        throw DayChanged()
      }

      return try await self.openBlock(tap, blockID: blockID, sessionID: sessionID, token: token)
    }
  }

  func addExtraTime(in view: TodayView) async -> MutationResult<StudyDestination> {
    await openStep(for: OpenedSession.Day(view)) { token in
      try await self.openExtraBlock(
        sessionID: try await self.keptSessionID(in: view, token: token), token: token)
    }
  }

  func addExtraTime(sessionID: String) async -> MutationResult<StudyDestination> {
    await openStep(for: day.map(OpenedSession.Day.init)) { token in
      try await self.openExtraBlock(sessionID: sessionID, token: token)
    }
  }

  /// The next read says they're coming, and Today follows them from there.
  func prepareLessons(in view: TodayView) async -> MutationResult<Void> {
    let goalID = view.session.goalId ?? view.goal.id

    return await saves.save { [api, cache] in
      await cache.mutate(invalidating: [.userSession]) { identity in
        try await api.prepareLessons(token: identity.bearerToken, goalID: goalID)
      }
    }
  }

  /// Like every learner's answer here, saved even when Today goes away first (`LearnerSaves`).
  func answer(_ request: TodayView.UploadRequest, sourceID: String) async
    -> MutationResult<UploadAnswer>
  {
    await saves.save { [api, cache] in
      await cache.mutate(invalidating: [.goals]) { identity in
        try await api.answerUploadRequest(
          token: identity.bearerToken, goalID: request.goalId, sourceIDs: [sourceID])
      }
    }
  }

  func dismiss(_ request: TodayView.UploadRequest) async -> MutationResult<Void> {
    await saves.save { [api, cache] in
      await cache.mutate(invalidating: [.goals]) { identity in
        try await api.dismissUploadRequest(token: identity.bearerToken, goalID: request.goalId)
      }
    }
  }

  func catchUp(in view: TodayView) async -> MutationResult<Void> {
    await saves.save { [cache] in
      await cache.mutate(invalidating: [.goals, .userSession]) { identity in
        let sessionID = try await self.keptSessionID(in: view, token: identity.bearerToken)
        try await self.api.catchUp(
          token: identity.bearerToken, sessionID: sessionID, timeZone: TimeZone.current.identifier)
      }
    }
  }

  /// The one the learner just answered, until they ask for the next; else the day's.
  func shownPlanChange(in view: TodayView) -> AnsweredPlanChange? {
    let answered = answeredPlanChange(in: view)

    // Seen, the notice that the plan follows the official guide leaves at once: it has nothing to
    // say after, so Today shows whatever comes next.
    if let answered, answered.change.kind == "noticeChanged" {
      return view.planChange.flatMap {
        $0.id == answered.change.id ? nil : AnsweredPlanChange(change: $0)
      }
    }

    return answered ?? view.planChange.map { AnsweredPlanChange(change: $0) }
  }

  /// A newer proposal waiting behind the one just answered.
  func nextPlanChange(in view: TodayView) -> TodayView.PlanChange? {
    guard let answered = answeredPlanChange(in: view), answered.change.kind != "noticeChanged",
      let next = view.planChange, next.status == "proposed", next.id != answered.change.id
    else {
      return nil
    }

    return next
  }

  /// For the next suggestion, and for a new visit, which reads Today as it stands.
  func dropAnsweredPlanChange() {
    answered = nil
  }

  /// Undoing an applied proposal asks about it again.
  func answer(_ change: TodayView.PlanChange, with decision: PlanChangeDecision, in view: TodayView)
    async -> MutationResult<Void>
  {
    let goalID = view.goal.id
    let result = await saves.save { [api, cache] in
      await cache.mutate(invalidating: [.goals, .userSession]) { identity in
        let saved = try await api.decidePlanChange(
          token: identity.bearerToken, goalID: goalID, changeID: change.id, decision: decision,
          quote: change.kind == "testedOut" ? nil : change.quote)
        return (identity, saved)
      }
    }

    switch result {
    case .done(let (owner, saved)):
      if change.kind == "testedOut", saved?.status != "undone" {
        return .failed(.unavailable)
      }

      let day = OpenedSession.Day(view)

      // Out of date, it says nothing: Today reads the day again, as main does.
      answered = saved.flatMap { saved in
        if saved.status != "proposed" {
          return (owner, day, AnsweredPlanChange(change: saved, decision: decision))
        }

        return decision == .applied
          ? (owner, day, AnsweredPlanChange(change: saved, repriced: true)) : nil
      }
      return .done(())
    case .failed(let error):
      return .failed(error)
    case .obsolete:
      return .obsolete
    }
  }

  private func answeredPlanChange(in view: TodayView) -> AnsweredPlanChange? {
    guard let answered, answered.owner == cache.session.authenticatedSession,
      answered.day == OpenedSession.Day(view)
    else {
      return nil
    }

    return answered.value
  }

  /// Saved even when Today goes away first; then it opens nothing (`LearnerSaves`).
  func answer(_ suggestion: SuggestedGoal, accepted: Bool) async -> MutationResult<Void> {
    let api = api
    return await saves.save {
      await self.cache.mutate(invalidating: [.goals]) { identity in
        try await api.answerSuggestedGoal(
          token: identity.bearerToken, suggestionID: suggestion.id, accepted: accepted)
      }
    }
  }

  private func openStep(
    for day: OpenedSession.Day?,
    _ open: (_ token: String) async throws -> StudyBlockOpening
  ) async -> MutationResult<StudyDestination> {
    switch await cache.mutate(
      invalidating: [.userProgress, .userSession],
      { identity in
        let opening = try await open(identity.bearerToken)
        return (opening.sessionID, try await self.destination(of: opening, for: identity))
      })
    {
    case .done(let (sessionID, destination)):
      // `mutate` returns `done` only while the learner who tapped is still the one signed in.
      if let owner = cache.session.authenticatedSession {
        if let sessionID {
          opened = OpenedSession(owner: owner, day: day, sessionID: sessionID)
        }

        switch destination {
        case .lessonWait(let blockID, let writing):
          writings[blockID] = (owner, writing)
        case .lesson:
          writings = [:]
        default:
          break
        }
      }

      return .done(destination)
    case .failed(let error):
      cache.invalidate([.userSession])
      return .failed(error)
    case .obsolete:
      return .obsolete
    }
  }

  /// An unwritten lesson is asked for here, without starting its block: the block's preparation
  /// would race the request and hide a refusal. Once it's written, the block opens again.
  private func destination(of opening: StudyBlockOpening, for identity: AuthenticatedSession)
    async throws -> StudyDestination
  {
    // Opening a written question is its start: the tap admits the grading, or starts writing it.
    if case .StudyBlockOpeningEssay(let essay) = opening {
      guard cache.session.authenticatedSession == identity else {
        throw CancellationError()
      }

      let start = try await api.startWriting(
        token: identity.bearerToken, blockID: essay.blockId)
      return .essay(blockID: essay.blockId, start: start)
    }

    guard case .StudyBlockOpeningUnwrittenLesson(let lesson) = opening else {
      return StudyDestination(opening)
    }

    guard cache.session.authenticatedSession == identity else {
      throw CancellationError()
    }

    let token = identity.bearerToken

    switch try await api.writeLesson(token: token, lessonID: lesson.lessonId) {
    case .ready:
      return StudyDestination(
        try await openBlock(.block(.init(blockId: lesson.blockId, kind: .block)), token: token))
    case .writing(let run):
      return .lessonWait(blockID: lesson.blockId, writing: .writing(run: run))
    case .setAside:
      return .lessonWait(blockID: lesson.blockId, writing: .setAside)
    case .refused(let refusal):
      return .lessonWait(blockID: lesson.blockId, writing: .refused(refusal))
    case .failed:
      return .lessonWait(blockID: lesson.blockId, writing: .failed)
    }
  }

  private func openBlock(_ target: StudyBlockOpeningTarget, token: String) async throws
    -> StudyBlockOpening
  {
    try await api.openBlock(token: token, target: target, timeZone: TimeZone.current.identifier)
  }

  private func openBlock(_ tap: StudyTap, blockID: String, sessionID: String, token: String)
    async throws -> StudyBlockOpening
  {
    switch tap {
    case .next:
      try await openBlock(
        .next(.init(expectedBlockId: blockID, kind: .next, sessionId: sessionID)), token: token)
    case .block:
      try await openBlock(.block(.init(blockId: blockID, kind: .block)), token: token)
    case .mission:
      try await openBlock(.mission(.init(blockId: blockID, kind: .mission)), token: token)
    }
  }

  private func openExtraBlock(sessionID: String, token: String) async throws -> StudyBlockOpening {
    guard
      let block = try await api.addExtraBlock(
        token: token, sessionID: sessionID, timeZone: TimeZone.current.identifier)
    else {
      return .StudyBlockOpeningToday(.init(kind: .today))
    }

    guard let blockID = block.id else {
      throw DayChanged()
    }

    return try await openBlock(.block(.init(blockId: blockID, kind: .block)), token: token)
  }

  private func openDay(_ day: OpenedSession.Day, target: DayTarget?, token: String) async throws
    -> OpenedStudyDay
  {
    try await api.openDay(
      token: token, goalID: day.goalID, shownDate: day.localDate,
      timeZone: TimeZone.current.identifier, target: target)
  }

  private func keptSessionID(in view: TodayView, token: String) async throws -> String {
    if let sessionID = view.session.id {
      return sessionID
    }

    return try await openDay(OpenedSession.Day(view), target: nil, token: token).sessionId
  }
}

extension StudyBlockOpening {
  /// Nil for Today or a change.
  var sessionID: String? {
    switch self {
    case .StudyBlockOpeningLesson(let lesson): lesson.sessionId
    case .StudyBlockOpeningUnwrittenLesson(let lesson): lesson.sessionId
    case .StudyBlockOpeningPreparingLesson(let step): step.sessionId
    case .StudyBlockOpeningEssay(let essay): essay.sessionId
    case .StudyBlockOpeningCheckpoint(let checkpoint): checkpoint.sessionId
    case .StudyBlockOpeningMock(let mock): mock.sessionId
    case .StudyBlockOpeningChallenge(let challenge): challenge.sessionId
    case .StudyBlockOpeningSession(let session): session.sessionId
    case .StudyBlockOpeningToday, .StudyBlockOpeningChanged, .case11: nil
    }
  }
}

extension StudyDestination {
  /// A lesson still unwritten after its writing ended opens on the session, whose Continue asks for
  /// it again.
  init(_ opening: StudyBlockOpening) {
    switch opening {
    case .StudyBlockOpeningLesson(let lesson):
      self = .lesson(lessonID: lesson.lessonId, sessionID: lesson.sessionId)
    case .StudyBlockOpeningUnwrittenLesson:
      self = .session
    case .StudyBlockOpeningPreparingLesson:
      self = .today
    case .StudyBlockOpeningEssay(let essay):
      self = .essay(blockID: essay.blockId, start: nil)
    case .StudyBlockOpeningCheckpoint(let checkpoint):
      self = .checkpoint(blockID: checkpoint.blockId, sessionID: checkpoint.sessionId)
    case .StudyBlockOpeningMock(let mock):
      self = .mock(blockID: mock.blockId, sessionID: mock.sessionId)
    case .StudyBlockOpeningChallenge(let challenge):
      self = .challenge(planItemID: challenge.planItemId, sessionID: challenge.sessionId)
    case .StudyBlockOpeningSession(let session):
      self = session.blockId.map { .questionBlock(blockID: $0) } ?? .session
    case .StudyBlockOpeningToday:
      self = .today
    case .StudyBlockOpeningChanged, .case11:
      self = .changed
    }
  }
}

private struct DayChanged: Error {}

private struct OpenedSession {
  struct Day: Equatable {
    let goalID: String
    let localDate: String

    init(_ day: StudyDay, goalID: String) {
      self.goalID = day.goalId ?? goalID
      localDate = day.localDate
    }

    init(_ view: TodayView) {
      self.init(view.session, goalID: view.goal.id)
    }
  }

  let owner: AuthenticatedSession
  /// What Today showed when it opened; nil while Today isn't read.
  let day: Day?
  let sessionID: String
}

struct AnsweredPlanChange: Equatable {
  let change: TodayView.PlanChange
  var decision: PlanChangeDecision?
  /// Accepted, and still waiting: its numbers moved, so it asks again with today's.
  var repriced = false
}
