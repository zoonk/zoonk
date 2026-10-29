import Foundation
import Observation

@MainActor
@Observable
final class PlanStore {
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
  /// What the learner opened on a plan's path, kept above the panes a fold rebuilds.
  private var phaseDisclosures: [String: [Int: PhaseDisclosure]] = [:]

  struct PhaseDisclosure {
    /// Nil until the learner opens or closes it: the phase they're in starts open.
    var isExpanded: Bool?
    var showsAllChapters = false
  }

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

  func phaseDisclosure(goalId: String, phase: Int) -> PhaseDisclosure {
    phaseDisclosures[goalId]?[phase] ?? PhaseDisclosure()
  }

  func setPhaseDisclosure(goalId: String, phase: Int, _ change: (inout PhaseDisclosure) -> Void) {
    change(&phaseDisclosures[goalId, default: [:]][phase, default: PhaseDisclosure()])
  }

  func syllabus(goalId: String) -> Resource<GoalSyllabus> {
    resource(&syllabi, goalId) { api, token in try await api.syllabus(token: token, goalId: goalId)
    }
  }

  func standing(goalId: String) -> Resource<GoalStanding> {
    resource(&standings, goalId) { api, token in
      try await api.standing(token: token, goalId: goalId)
    }
  }

  func languageStanding(goalId: String) -> Resource<LanguageStanding> {
    resource(&languageStandings, goalId) { api, token in
      try await api.languageStanding(token: token, goalId: goalId)
    }
  }

  func languageUnits(goalId: String) -> Resource<LanguageUnitsOverview> {
    resource(&languageUnitLists, goalId) { api, token in
      try await api.languageUnits(token: token, goalId: goalId)
    }
  }

  func studyNext(goalId: String) -> Resource<StudyNext> {
    resource(&studyNexts, goalId) { api, token in
      try await api.studyNext(token: token, goalId: goalId)
    }
  }

  func resumeChangesPlan(goalId: String) -> Resource<Bool> {
    resource(&resumePreviews, goalId, domains: [.goals]) { api, token in
      try await api.resumeChangesPlan(token: token, goalId: goalId)
    }
  }

  func outline(goalId: String, skillId: String) -> Resource<SkillOutline> {
    resource(&outlines, "\(goalId):\(skillId)", domains: [.goals]) { api, token in
      try await api.outline(token: token, goalId: goalId, skillId: skillId)
    }
  }

  func setStatus(_ status: GoalStatusChange, goalId: String) async
    -> MutationResult<GoalStatusOutcome>
  {
    await write { api, token in
      try await api.setStatus(token: token, goalId: goalId, status: status)
    } changed: {
      $0 == .saved
    }
  }

  func continueAtNextLevel(goalId: String) async -> MutationResult<Bool> {
    await write { api, token in
      try await api.continueAtNextLevel(token: token, goalId: goalId)
    } changed: {
      $0
    }
  }

  func skipAlphabet(goalId: String) async -> MutationResult<Bool> {
    await write { api, token in
      try await api.skipAlphabet(token: token, goalId: goalId)
    } changed: {
      $0
    }
  }

  /// Only saves: `PlanEditor` says what a change did and undoes it.
  func change(goalId: String, edits: [PlanEdit]) async -> MutationResult<PlanChangeOutcome> {
    await change { api, token in
      try await api.change(token: token, goalId: goalId, edits: edits)
    }
  }

  func change(
    _ request: (any PlanAPIClient, String) async throws -> PlanChangeOutcome
  ) async -> MutationResult<PlanChangeOutcome> {
    await write(request) { outcome in
      switch outcome {
      case .applied, .undone: true
      case .invalid, .unchanged: false
      }
    }
  }

  /// A failed write revalidates the goal too, since one that timed out may have landed.
  func write<Result: Sendable>(
    _ request: (any PlanAPIClient, String) async throws -> Result,
    changed: (Result) -> Bool
  ) async -> MutationResult<Result> {
    let api = api
    let result = await cache.mutate { identity in
      try await request(api, identity.bearerToken)
    }

    let revalidates =
      switch result {
      case .done(let value): changed(value)
      case .failed: true
      case .obsolete: false
      }

    if revalidates {
      cache.invalidate([.goals, .learnerModel])
    }

    return result
  }

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

  /// Only when it changed since the one shown was read: the server re-plans on every read. A new day
  /// changes it without a write, so it's read again then too.
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
