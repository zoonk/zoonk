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

  /// The question block the session screen plays now, set by the tap that opened it.
  private(set) var playingBlockID: String?
  /// What the block just finished on the session screen earned, until the next one opens.
  private(set) var moment: BlockMoment?
  /// The session the learner stopped for today, whose summary shows what's done so far.
  private(set) var stoppedSessionID: String?
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
      playingBlockID = nil
      stoppedSessionID = sessionID
      cache.invalidate([.userSession, .userProgress])
      return true
    } catch {
      return false
    }
  }

  /// Plays a question block on the session screen.
  func play(blockID: String) {
    playingBlockID = blockID
    moment = nil
    stoppedSessionID = nil
  }

  /// The playing block finished: the session screen shows what it earned.
  func finish(_ completion: BlockMoment?) {
    playingBlockID = nil
    moment = completion
  }

  /// The session screen closed: the next one opens on the day as it stands.
  func leave() {
    playingBlockID = nil
    moment = nil
    stoppedSessionID = nil
  }

  /// Whether a milestone's ceremony still has to show here; true once per milestone.
  func claimCeremony(_ milestone: Milestone) -> Bool {
    shownCeremonies.insert(milestone.id).inserted
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
