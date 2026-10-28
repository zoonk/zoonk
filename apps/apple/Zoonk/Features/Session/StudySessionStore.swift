import Foundation
import Observation

/// The learner's study sessions, their summaries and the week's recap, each read once and kept
/// while the app runs, revalidated when a block or the day moves. Stopping for today happens here
/// too.
@MainActor
@Observable
final class StudySessionStore {
  @ObservationIgnored private let api: any StudyAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var sessions: [String: Resource<StudyDay>] = [:]
  @ObservationIgnored private var summaries: [String: Resource<SessionSummary>] = [:]
  @ObservationIgnored private var recaps: [String: Resource<WeeklyRecap>] = [:]

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

  /// The learner's last week, with the goal's phases and next week's focus when there's a goal.
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

  /// "Stop for today": what was done counts and the rest waits on Today.
  func stop(sessionID: String) async -> Bool {
    guard let token = cache.session.authenticatedSession?.bearerToken else {
      return false
    }

    do {
      try await api.stop(token: token, sessionID: sessionID, timeZone: TimeZone.current.identifier)
      cache.invalidate([.userSession, .userProgress])
      return true
    } catch {
      return false
    }
  }

  /// The day moved on the session screen (a block finished there or over it): Today, the
  /// learner's summary and their progress read again.
  func dayMoved() {
    cache.invalidate([.userProgress, .userSession])
  }

  /// Marks a milestone's ceremony as shown, so it never repeats; a failed mark only means it may
  /// show again.
  func markShown(_ milestone: Milestone) async {
    guard let token = cache.session.authenticatedSession?.bearerToken else {
      return
    }

    try? await api.markMilestoneShown(token: token, milestoneID: milestone.id)
  }

  /// Where a lesson of the session stands while it's written: `ready`, `generating`,
  /// `notStarted` or `failed`.
  func lessonStatus(lessonID: String) async -> String? {
    guard let token = cache.session.authenticatedSession?.bearerToken else {
      return nil
    }

    return try? await api.lessonStatus(token: token, lessonID: lessonID)
  }
}
