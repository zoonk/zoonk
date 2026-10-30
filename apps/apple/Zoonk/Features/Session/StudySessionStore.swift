import Foundation
import Observation

@MainActor
@Observable
final class StudySessionStore {
  @ObservationIgnored private let api: any StudyAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var sessions: [String: Resource<StudyDay>] = [:]
  @ObservationIgnored private var summaries: [String: Resource<SessionSummary>] = [:]
  @ObservationIgnored private var recaps: [String: Resource<WeeklyRecap>] = [:]
  /// Ceremonies already shown here, so a milestone a block and the summary both carry shows once.
  @ObservationIgnored private var shownCeremonies: Set<String> = []

  init(api: any StudyAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
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

  func stop(sessionID: String, in playback: SessionPlayback) async -> MutationResult<Void> {
    let result = await cache.mutate(invalidating: [.userProgress, .userSession]) { identity in
      try await api.stop(
        token: identity.bearerToken, sessionID: sessionID, timeZone: TimeZone.current.identifier)
    }

    if case .done = result {
      playback.stop(sessionID: sessionID)
    }

    return result
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

  /// `ready`, `generating`, `notStarted` or `failed`.
  func lessonStatus(lessonID: String) async -> String? {
    guard let token = cache.session.authenticatedSession?.bearerToken else {
      return nil
    }

    return try? await api.lessonStatus(token: token, lessonID: lessonID)
  }
}
