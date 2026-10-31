import Foundation

struct LearnerSummary: Equatable, Sendable {
  let activeGoalID: String?
  let buddy: BuddyLook
  let buddyName: String?
  let goals: [LearnerGoal]
  let identity: LearnerIdentity
  let level: LearnerLevel?
  /// When the summary changes without a write: the next midnight, the subscription's next change or
  /// the session's end.
  let nextChangeAt: Date
  let places: LearnerPlaces
  let readAt: Date
  let tier: LearnerTier
  let timeZone: String?
  /// Activities left in today's session, nil before the day is saved.
  let todayBlocksLeft: Int?
}

struct LearnerGoal: Equatable, Identifiable, Sendable {
  /// The chapter of the goal's next lesson in the course it follows; nil until that lesson is
  /// written into a chapter, when `courseLevel` still says where the plan is.
  var courseChapterID: String? = nil
  /// Set only while the goal follows its course, so that course's page offers to continue it.
  var courseID: String? = nil
  /// The level of the goal's next lesson in that course, where its page opens the outline.
  var courseLevel: CourseLevel? = nil
  let dailyMinutes: Int
  let id: String
  /// Questions are left before its plan is set, so continuing it opens its setup instead of Today.
  var isSettingUp = false
  let kind: Kind
  let status: Status
  /// `YYYY-MM-DD`, a calendar day.
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
    buddy: BuddyLook(
      kind: BuddyKind(rawValue: summary.buddy.kind.rawValue) ?? .zu,
      glasses: BuddyGlasses(rawValue: summary.buddy.glasses.rawValue) ?? .round,
      belt: ProgressBelt(rawValue: summary.buddy.beltColor.rawValue) ?? .white,
      energy: summary.buddy.energy, studiedToday: summary.buddy.studiedToday),
    buddyName: summary.buddy.name,
    goals: summary.goals.map { goal in
      LearnerGoal(
        courseChapterID: goal.courseChapterId,
        courseID: goal.courseId,
        courseLevel: goal.courseLevel.flatMap { CourseLevel(rawValue: $0.rawValue) },
        dailyMinutes: goal.dailyMinutes,
        id: goal.id,
        isSettingUp: goal.isSettingUp,
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
  var followedGoals: [LearnerGoal] {
    goals.filter { $0.kind != .explain && $0.status != .archived }
  }

  var openExplanations: [LearnerGoal] {
    goals.filter { $0.kind == .explain && $0.status != .archived && $0.status != .completed }
  }

  var shownGoal: LearnerGoal? {
    followedGoals.first { $0.id == activeGoalID } ?? followedGoals.first
  }
}

func dateFromEpochMilliseconds(_ milliseconds: Int) -> Date {
  Date(timeIntervalSince1970: Double(milliseconds) / 1_000)
}
