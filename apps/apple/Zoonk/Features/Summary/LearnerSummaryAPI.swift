import Foundation

/// What the app's frame shows about the signed-in learner, read in one request. Features add the
/// fields they draw (missions, the buddy's look) as they need them.
struct LearnerSummary: Equatable, Sendable {
  let activeGoalID: String?
  /// Which buddy the learner has, whose own name says it until the learner names it.
  let buddyKind: BuddyKind
  /// The buddy's name, which names its tab; nil until the learner names it.
  let buddyName: String?
  let goals: [LearnerGoal]
  let identity: LearnerIdentity
  /// The learner's belt and level, nil before they have one.
  let level: LearnerLevel?
  /// When the summary changes without a write (the next midnight, the subscription's next change
  /// or the session's end), so it's read again then.
  let nextChangeAt: Date
  let places: LearnerPlaces
  let readAt: Date
  let tier: LearnerTier
  let timeZone: String?
  /// Activities left in today's session, nil before the day is saved.
  let todayBlocksLeft: Int?
}

struct LearnerGoal: Equatable, Identifiable, Sendable {
  let dailyMinutes: Int
  let id: String
  let kind: Kind
  let status: Status
  /// The goal's date (YYYY-MM-DD, a calendar day), nil without one.
  let targetDate: String?
  let title: String

  enum Kind: String, Sendable {
    case exam
    case explain
    case language
    case learn
  }

  enum Status: String, Sendable {
    case active
    case archived
    case completed
    case paused
  }
}

struct LearnerLevel: Equatable, Sendable {
  let belt: ProgressBelt
  let level: Int
}

/// The Study places the active goal has (main's sidebar shortcuts).
struct LearnerPlaces: Equatable, Sendable {
  let exam: Bool
  let mindMaps: Bool
  let readyMistakes: Int
  let speaking: Bool
}

struct LearnerIdentity: Equatable, Sendable {
  let isAnonymous: Bool
  let signedInAt: Date
  let userID: String
}

enum LearnerTier: String, Equatable, Sendable {
  case free
  case guest
  case plus
}

protocol LearnerSummaryAPIClient {
  func getSummary(token: String) async throws -> LearnerSummary
  func switchGoal(token: String, goalID: String) async throws
}

struct LearnerSummaryAPI: LearnerSummaryAPIClient {
  let clients: APIClientFactory

  func getSummary(token: String) async throws -> LearnerSummary {
    try await clients.perform(token: token) { client in
      switch try await client.getCurrentUserSummary() {
      case .ok(let response):
        return makeLearnerSummary(try response.body.json.summary)
      case .unauthorized:
        throw APIError.unauthorized
      case .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func switchGoal(token: String, goalID: String) async throws {
    try await clients.perform(token: token) { client in
      switch try await client.updateCurrentUserLearningProfile(
        body: .json(.init(activeGoalId: goalID)))
      {
      case .ok:
        return
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      case .badRequest, .unprocessableContent, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }
}

func makeLearnerSummary(_ summary: Components.Schemas.LearnerSummary) -> LearnerSummary {
  LearnerSummary(
    activeGoalID: summary.activeGoalId,
    buddyKind: BuddyKind(rawValue: summary.buddy.kind.rawValue) ?? .zu,
    buddyName: summary.buddy.name,
    goals: summary.goals.map { goal in
      LearnerGoal(
        dailyMinutes: goal.dailyMinutes,
        id: goal.id,
        kind: LearnerGoal.Kind(rawValue: goal.kind.rawValue) ?? .learn,
        status: LearnerGoal.Status(rawValue: goal.status.rawValue) ?? .active,
        targetDate: goal.targetDate,
        title: goal.title)
    },
    identity: LearnerIdentity(
      isAnonymous: summary.identity.isAnonymous,
      signedInAt: dateFromEpochMilliseconds(summary.identity.signedInAt),
      userID: summary.identity.userId),
    level: summary.level.map { level in
      LearnerLevel(
        belt: ProgressBelt(rawValue: level.color.rawValue) ?? .white, level: level.level)
    },
    nextChangeAt: dateFromEpochMilliseconds(summary.nextChangeAt),
    places: LearnerPlaces(
      exam: summary.places.exam,
      mindMaps: summary.places.mindMaps,
      readyMistakes: summary.places.readyMistakes,
      speaking: summary.places.speaking),
    readAt: dateFromEpochMilliseconds(summary.readAt),
    tier: LearnerTier(rawValue: summary.tier.rawValue) ?? .free,
    timeZone: summary.timeZone,
    todayBlocksLeft: summary.today?.blocksLeft)
}

extension LearnerSummary {
  /// The goals the switcher lists, as main's: followed goals not archived.
  var followedGoals: [LearnerGoal] {
    goals.filter { $0.kind != .explain && $0.status != .archived }
  }

  /// Quick explanations not read to the end, which open themselves from the switcher.
  var openExplanations: [LearnerGoal] {
    goals.filter { $0.kind == .explain && $0.status != .archived && $0.status != .completed }
  }

  /// The goal the tabs show: the active one, else the first followed goal.
  var shownGoal: LearnerGoal? {
    followedGoals.first { $0.id == activeGoalID } ?? followedGoals.first
  }
}

/// The API sends instants as milliseconds since the epoch.
func dateFromEpochMilliseconds(_ milliseconds: Int) -> Date {
  Date(timeIntervalSince1970: Double(milliseconds) / 1_000)
}
