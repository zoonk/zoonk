import Foundation
import Observation

/// The Plan's data for each goal, kept for the app's life so the tab is instant on return. The plan
/// is expensive to read (the server re-plans it), so once read it's only read again when the cheap
/// `getPlanChangedSince` says it changed, or on a new day; the syllabus, which search reads too, and
/// the learner's standing are ordinary cached reads.
@MainActor
@Observable
final class PlanStore {
  /// How long a shown plan goes without asking whether it changed; mutations ask sooner.
  private static let planCheckAge = Duration.seconds(30)
  /// Device clocks run a little apart from the server's: asking from a minute earlier never misses
  /// a change (an extra read at worst).
  private static let clockMargin: TimeInterval = 60

  let api: PlanAPI
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var plans: [String: Resource<PlanRead>] = [:]
  @ObservationIgnored private var resumePreviews: [String: Resource<Bool>] = [:]
  @ObservationIgnored private var standings: [String: Resource<GoalStanding>] = [:]
  @ObservationIgnored private var syllabi: [String: Resource<GoalSyllabus>] = [:]

  init(api: PlanAPI, cache: AppCache) {
    self.api = api
    self.cache = cache
  }

  func plan(goalId: String) -> Resource<PlanRead> {
    if let plan = plans[goalId] {
      return plan
    }

    let plan: Resource<PlanRead> = cache.resource(
      audience: .signedIn,
      domains: [.goals, .learnerModel, .userProgress, .userSubscription],
      maxAge: Self.planCheckAge
    ) { [weak self] session in
      guard let session, let self else {
        return nil
      }

      return try await readPlan(goalId: goalId, token: session.bearerToken)
    }

    plans[goalId] = plan
    return plan
  }

  /// The goal's subjects or modules, shared with search.
  func syllabus(goalId: String) -> Resource<GoalSyllabus> {
    if let syllabus = syllabi[goalId] {
      return syllabus
    }

    let api = api
    let syllabus: Resource<GoalSyllabus> = cache.resource(
      audience: .signedIn, domains: [.goals, .learnerModel, .userProgress]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.syllabus(token: session.bearerToken, goalId: goalId)
    }

    syllabi[goalId] = syllabus
    return syllabus
  }

  /// Where the learner stands: an exam's preparation, by subject.
  func standing(goalId: String) -> Resource<GoalStanding> {
    if let standing = standings[goalId] {
      return standing
    }

    let api = api
    let standing: Resource<GoalStanding> = cache.resource(
      audience: .signedIn, domains: [.goals, .learnerModel, .userProgress]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.standing(token: session.bearerToken, goalId: goalId)
    }

    standings[goalId] = standing
    return standing
  }

  /// Whether resuming the paused goal changes its plan; read only while it's paused.
  func resumeChangesPlan(goalId: String) -> Resource<Bool> {
    if let preview = resumePreviews[goalId] {
      return preview
    }

    let api = api
    let preview: Resource<Bool> = cache.resource(audience: .signedIn, domains: [.goals]) {
      session in
      guard let session else {
        return nil
      }

      return try await api.resumeChangesPlan(token: session.bearerToken, goalId: goalId)
    }

    resumePreviews[goalId] = preview
    return preview
  }

  /// Pauses, resumes or archives the goal. Goals change, so the summary (the switcher, the tabs),
  /// Today and the plan follow.
  func setStatus(_ status: GoalStatusChange, goalId: String) async -> GoalStatusOutcome {
    await write { token in
      try await self.api.setStatus(token: token, goalId: goalId, status: status)
    } changed: {
      $0 == .saved
    } ?? .failed
  }

  /// Runs one of the Plan's writes for the signed-in learner. When `changed` says it changed the
  /// plan, everything reading the goal revalidates, as main revalidates its goal tags. Nil when it
  /// didn't reach the server or the session ended.
  func write<Result: Sendable>(
    _ request: (String) async throws -> Result,
    changed: (Result) -> Bool
  ) async -> Result? {
    guard let session = cache.session.authenticatedSession else {
      return nil
    }

    do {
      let result = try await request(session.bearerToken)

      if changed(result) {
        cache.invalidate([.goals, .learnerModel])
      }

      return result
    } catch APIError.unauthorized {
      await cache.session.expire(session)
      return nil
    } catch {
      return nil
    }
  }

  /// Reads the plan again only when it changed since the one shown was read: the server re-plans
  /// on every read. A new day changes it without a write, so it's read again then too.
  private func readPlan(goalId: String, token: String) async throws -> PlanRead {
    if let shown = plans[goalId]?.value, Calendar.current.isDateInToday(shown.readAt),
      try await !api.planChanged(token: token, goalId: goalId, since: shown.readAt)
    {
      return shown
    }

    let readAt = Date.now.addingTimeInterval(-Self.clockMargin)
    return PlanRead(plan: try await api.plan(token: token, goalId: goalId), readAt: readAt)
  }
}
