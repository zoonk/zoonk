import Foundation
import Observation

@MainActor
@Observable
final class StudySessionStore {
  @ObservationIgnored private let api: any StudyAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let today: TodayStore
  @ObservationIgnored private var sessions: [String: Resource<StudyDay>] = [:]
  @ObservationIgnored private var summaries: [String: Resource<SessionSummary>] = [:]
  @ObservationIgnored private var recaps: [String: Resource<WeeklyRecap>] = [:]
  /// Ceremonies already shown here, so a milestone a block and the summary both carry shows once.
  @ObservationIgnored private var shownCeremonies: Set<String> = []

  @ObservationIgnored private let saves: LearnerSaves

  init(api: any StudyAPIClient, cache: AppCache, today: TodayStore) {
    self.api = api
    self.cache = cache
    self.today = today
    saves = LearnerSaves(cache: cache)
  }

  func session(id: String) -> Resource<StudyDay> {
    if let resource = sessions[id] {
      return resource
    }

    let resource: Resource<StudyDay> = cache.resource(
      audience: .signedIn, domains: [.userProgress, .userSession]
    ) { [api] session in
      guard let session else {
        return nil
      }

      return try await api.getSession(token: session.bearerToken, sessionID: id)
    }

    sessions[id] = resource
    return resource
  }

  func summary(id: String) -> Resource<SessionSummary> {
    if let resource = summaries[id] {
      return resource
    }

    let resource: Resource<SessionSummary> = cache.resource(
      audience: .signedIn, domains: [.userProgress, .userSession]
    ) { [api] session in
      guard let session else {
        return nil
      }

      return try await api.getSummary(token: session.bearerToken, sessionID: id)
    }

    summaries[id] = resource
    return resource
  }

  func claimSummaryVisit(sessionID: String, visitID: UUID) async
    -> MutationResult<SummaryVisitDecision>
  {
    await cache.mutate { [api] identity in
      try await api.claimSummaryVisit(
        token: identity.bearerToken, sessionID: sessionID, visitID: visitID)
    }
  }

  func weeklyRecap(goalID: String?) -> Resource<WeeklyRecap> {
    let key = goalID ?? ""

    if let resource = recaps[key] {
      return resource
    }

    let resource: Resource<WeeklyRecap> = cache.resource(
      audience: .signedIn, domains: [.userProgress, .userSession]
    ) { [api] session in
      guard let session else {
        return nil
      }

      return try await api.getWeeklyRecap(token: session.bearerToken, goalID: goalID)
    }

    recaps[key] = resource
    return resource
  }

  /// Stopped even when the screen that asked goes away first; then its playback is left as it is
  /// (`LearnerSaves`).
  func stop(sessionID: String, in playback: SessionPlayback) async -> MutationResult<Void> {
    let api = api
    let result = await saves.save {
      await self.cache.mutate(invalidating: [.userProgress, .userSession]) { identity in
        try await api.stop(
          token: identity.bearerToken, sessionID: sessionID,
          timeZone: TimeZone.current.identifier)
      }
    }

    if case .done = result {
      playback.stop(sessionID: sessionID)
    }

    return result
  }

  /// The session and Today show the finished block done and the server's next block at once,
  /// instead of the day as it was until they're read again.
  func apply(_ completion: BlockMoment, sessionID: String) {
    sessions[sessionID]?.update { $0.finishing(completion) }
    today.apply(completion, sessionID: sessionID)
  }

  /// True once per milestone.
  func claimCeremony(_ milestone: Milestone) -> Bool {
    shownCeremonies.insert(milestone.id).inserted
  }

  /// A failed mark only means the ceremony may show again.
  func markShown(_ milestone: Milestone) async {
    _ = await cache.mutate { identity in
      try await api.markMilestoneShown(token: identity.bearerToken, milestoneID: milestone.id)
    }
  }

  /// Nil when it couldn't be read, or was answered after its learner left: the screen keeps what
  /// it shows and asks again.
  func lessonReadiness(lessonID: String) async -> Components.Schemas.LessonReadiness? {
    await read { token in
      try await api.lessonReadiness(token: token, lessonID: lessonID)
    }
  }

  /// How the lesson stands once readiness names no run writing it.
  func followWriting(lessonID: String, run: String?) async -> Components.Schemas.LessonReadiness? {
    await read { token in
      try await api.followWriting(token: token, lessonID: lessonID, run: run)
    }
  }

  /// A lesson's readiness changed what the day shows: every screen showing it reads it again.
  func lessonChanged() {
    cache.invalidate([.userSession])
  }

  private func read(
    _ readiness: (_ token: String) async throws -> Components.Schemas.LessonReadiness
  ) async -> Components.Schemas.LessonReadiness? {
    guard let owner = cache.session.authenticatedSession,
      let lesson = try? await readiness(owner.bearerToken),
      owner == cache.session.authenticatedSession
    else {
      return nil
    }

    return lesson
  }
}
