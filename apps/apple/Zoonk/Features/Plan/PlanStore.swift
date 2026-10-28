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
  static let planCheckAge = Duration.seconds(30)
  /// Device clocks run a little apart from the server's: asking from a minute earlier never misses
  /// a change (an extra read at worst).
  static let clockMargin: TimeInterval = 60

  let api: any PlanAPIClient
  @ObservationIgnored let cache: AppCache
  @ObservationIgnored private let calendar: Calendar
  @ObservationIgnored private let now: @MainActor () -> Date
  @ObservationIgnored private var languageStandings: [String: Resource<LanguageStanding>] = [:]
  @ObservationIgnored private var languageUnitLists: [String: Resource<LanguageUnitsOverview>] = [:]
  @ObservationIgnored private var outlines: [String: Resource<SkillOutline>] = [:]
  @ObservationIgnored private var plans: [String: Resource<PlanRead>] = [:]
  @ObservationIgnored private var resumePreviews: [String: Resource<Bool>] = [:]
  @ObservationIgnored private var standings: [String: Resource<GoalStanding>] = [:]
  @ObservationIgnored private var studyNexts: [String: Resource<StudyNext>] = [:]
  @ObservationIgnored private var syllabi: [String: Resource<GoalSyllabus>] = [:]

  init(
    api: any PlanAPIClient, cache: AppCache, calendar: Calendar = .current,
    now: @escaping @MainActor () -> Date = { .now }
  ) {
    self.api = api
    self.cache = cache
    self.calendar = calendar
    self.now = now
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
    resource(&syllabi, goalId) { api, token in try await api.syllabus(token: token, goalId: goalId)
    }
  }

  /// Where the learner stands: an exam's preparation, by subject.
  func standing(goalId: String) -> Resource<GoalStanding> {
    resource(&standings, goalId) { api, token in
      try await api.standing(token: token, goalId: goalId)
    }
  }

  /// A language goal's level across skills.
  func languageStanding(goalId: String) -> Resource<LanguageStanding> {
    resource(&languageStandings, goalId) { api, token in
      try await api.languageStanding(token: token, goalId: goalId)
    }
  }

  /// A language goal's alphabet lesson, for a script that isn't Latin.
  func languageUnits(goalId: String) -> Resource<LanguageUnitsOverview> {
    resource(&languageUnitLists, goalId) { api, token in
      try await api.languageUnits(token: token, goalId: goalId)
    }
  }

  /// What to study next once the plan is over; read only then.
  func studyNext(goalId: String) -> Resource<StudyNext> {
    resource(&studyNexts, goalId) { api, token in
      try await api.studyNext(token: token, goalId: goalId)
    }
  }

  /// Whether resuming the paused goal changes its plan; read only while it's paused.
  func resumeChangesPlan(goalId: String) -> Resource<Bool> {
    resource(&resumePreviews, goalId, domains: [.goals]) { api, token in
      try await api.resumeChangesPlan(token: token, goalId: goalId)
    }
  }

  /// A far topic's outline, read when the learner opens it.
  func outline(goalId: String, skillId: String) -> Resource<SkillOutline> {
    resource(&outlines, "\(goalId):\(skillId)", domains: [.goals]) { api, token in
      try await api.outline(token: token, goalId: goalId, skillId: skillId)
    }
  }

  /// Pauses, resumes or archives the goal. Goals change, so the summary (the switcher, the tabs),
  /// Today and the plan follow.
  func setStatus(_ status: GoalStatusChange, goalId: String) async
    -> MutationResult<GoalStatusOutcome>
  {
    await write { api, token in
      try await api.setStatus(token: token, goalId: goalId, status: status)
    } changed: {
      $0 == .saved
    }
  }

  /// Starts the next level of the plan's course; the Plan then follows its plan being built.
  func continueAtNextLevel(goalId: String) async -> MutationResult<Bool> {
    await write { api, token in
      try await api.continueAtNextLevel(token: token, goalId: goalId)
    } changed: {
      $0
    }
  }

  /// "I can already read it": the alphabet lesson leaves the sessions.
  func skipAlphabet(goalId: String) async -> MutationResult<Bool> {
    await write { api, token in
      try await api.skipAlphabet(token: token, goalId: goalId)
    } changed: {
      $0
    }
  }

  /// Runs one of the Plan's writes for the session that asked for it (see `AppCache.mutate`).
  /// When `changed` says it changed the plan, everything reading the goal revalidates, as main
  /// revalidates its goal tags.
  func write<Result: Sendable>(
    _ request: (any PlanAPIClient, String) async throws -> Result,
    changed: (Result) -> Bool
  ) async -> MutationResult<Result> {
    let api = api
    let result = await cache.mutate { identity in
      try await request(api, identity.bearerToken)
    }

    if case .done(let value) = result, changed(value) {
      cache.invalidate([.goals, .learnerModel])
    }

    return result
  }

  /// A keyed read of the learner's own data, created on first use and kept for the app's life.
  private func resource<Value: Equatable & Sendable>(
    _ resources: inout [String: Resource<Value>],
    _ key: String,
    domains: Set<DataDomain> = [.goals, .learnerModel, .userProgress],
    fetch: @escaping @Sendable (any PlanAPIClient, String) async throws -> Value?
  ) -> Resource<Value> {
    if let resource = resources[key] {
      return resource
    }

    let api = api
    let resource: Resource<Value> = cache.resource(audience: .signedIn, domains: domains) {
      session in
      guard let session else {
        return nil
      }

      return try await fetch(api, session.bearerToken)
    }

    resources[key] = resource
    return resource
  }

  /// Reads the plan again only when it changed since the one shown was read: the server re-plans
  /// on every read. A new day changes it without a write, so it's read again then too.
  private func readPlan(goalId: String, token: String) async throws -> PlanRead {
    if let shown = plans[goalId]?.value, calendar.isDate(shown.readAt, inSameDayAs: now()),
      try await !api.planChanged(token: token, goalId: goalId, since: shown.readAt)
    {
      return shown
    }

    let readAt = now().addingTimeInterval(-Self.clockMargin)
    return PlanRead(plan: try await api.plan(token: token, goalId: goalId), readAt: readAt)
  }
}
