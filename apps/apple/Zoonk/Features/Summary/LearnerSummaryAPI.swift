import Foundation

struct LearnerSummary: Equatable, Sendable {
  let activeGoalID: String?
  var analytics: LearnerAnalytics
  let buddy: BuddyLook
  let buddyName: String?
  var goals: [LearnerGoal]
  /// Where the learner says they live; nil when they haven't said.
  var homeCountry: String? = nil
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
  var waitingGoals: [LearnerWaitingGoal] = []
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
  /// A flag's code: the goal's country's, else its language's; nil for a goal without one.
  var languageFlag: String? = nil
  let status: Status
  /// `YYYY-MM-DD`, a calendar day.
  let targetDate: String?
  let displayName: String
  /// What the goal is about, which search also matches; screens show `displayName`.
  let title: String
  /// Nil for a goal that isn't a language goal with countries to choose from.
  var variety: LanguageVariety? = nil
  /// The row its plan shows: the country a learn goal's content is about, or a foreign exam's;
  /// nil for a goal whose content doesn't change by country.
  var contentCountry: ContentCountry? = nil
  /// The country a general goal's lessons take their examples from, shown when the learner lives
  /// elsewhere.
  var examplesCountry: CountryChoice? = nil
  /// The countries a picker for this goal offers first.
  var suggestedCountries: [CountryChoice] = []

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

/// A goal typed with the learner's goals that their plan didn't start, kept so it starts without
/// typing it again.
struct LearnerWaitingGoal: Hashable, Identifiable, Sendable {
  let id: String
  /// POST /goals as it is, with the learner's time zone, starts it.
  let input: Components.Schemas.GoalCreateInputOutput
  let locked: Bool
  let displayName: String
}

struct LearnerAnalytics: Equatable, Sendable {
  let disabled: Bool
  let goalKind: LearnerGoal.Kind?
  let plan: String
  let planPhase: Int?
  /// Only true lets the app send usage data.
  var usageDataSharing: Bool?
  let username: String?
}

struct LearnerLevel: Equatable, Sendable {
  let belt: ProgressBelt
  let level: Int
}

struct LearnerPlaces: Equatable, Sendable {
  let certificates: Bool
  let completedLessons: Bool
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
  /// False when the goal's language doesn't offer the country.
  func setTargetRegion(token: String, goalID: String, region: String?) async throws -> Bool
  /// The goal's new row; nil when the goal's content doesn't change by country.
  func setContentCountry(token: String, goalID: String, country: String?) async throws
    -> ContentCountryChange
  /// Only from the learner's tap: runs a failed rebuild again.
  func retryRebuild(token: String, goalID: String) async throws
}

enum ContentCountryChange: Equatable, Sendable {
  case saved(ContentCountry?)
  /// Exam and language goals keep theirs.
  case notOffered
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

  func setTargetRegion(token: String, goalID: String, region: String?) async throws -> Bool {
    try await clients.perform(token: token, sendingNull: ["targetRegion"]) { client in
      switch try await client.updateGoal(
        path: .init(goalId: goalID), body: .json(.init(targetRegion: region)))
      {
      case .ok: return true
      case .unprocessableContent: return false
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func setContentCountry(token: String, goalID: String, country: String?) async throws
    -> ContentCountryChange
  {
    try await clients.perform(token: token, sendingNull: ["contentCountry"]) { client in
      switch try await client.updateGoal(
        path: .init(goalId: goalID), body: .json(.init(contentCountry: country)))
      {
      case .ok(let response):
        return .saved(ContentCountry(try response.body.json.goal.contentCountry))
      case .unprocessableContent: return .notOffered
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func retryRebuild(token: String, goalID: String) async throws {
    try await clients.perform(token: token) { client in
      switch try await client.createGoalGeneration(path: .init(goalId: goalID)) {
      case .accepted: return
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }
}

func makeLearnerSummary(_ summary: Components.Schemas.LearnerSummary) -> LearnerSummary {
  LearnerSummary(
    activeGoalID: summary.activeGoalId,
    analytics: LearnerAnalytics(
      disabled: summary.analytics.disabled,
      goalKind: summary.analytics.goal.flatMap { LearnerGoal.Kind(rawValue: $0.kind.rawValue) },
      plan: summary.analytics.plan,
      planPhase: summary.analytics.goal?.phase,
      usageDataSharing: summary.analytics.usageDataSharing,
      username: summary.analytics.username),
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
        languageFlag: goal.languageFlag,
        status: LearnerGoal.Status(rawValue: goal.status.rawValue) ?? .active,
        targetDate: goal.targetDate,
        displayName: goal.displayName, title: goal.title,
        variety: LanguageVariety(
          language: goal.targetLanguage, region: goal.targetRegion, choices: goal.regionChoices),
        contentCountry: ContentCountry(goal.contentCountry),
        examplesCountry: CountryChoice(goal.examplesCountry),
        suggestedCountries: .init(suggested: goal.suggested))
    },
    homeCountry: summary.homeCountry,
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
      certificates: summary.places.certificates,
      completedLessons: summary.places.completedLessons,
      exam: summary.places.exam,
      mindMaps: summary.places.mindMaps,
      readyMistakes: summary.places.readyMistakes,
      speaking: summary.places.speaking),
    readAt: dateFromEpochMilliseconds(summary.readAt),
    tier: LearnerTier(rawValue: summary.tier.rawValue) ?? .free,
    timeZone: summary.timeZone,
    todayBlocksLeft: summary.today?.blocksLeft,
    waitingGoals: summary.waitingGoals.map { goal in
      LearnerWaitingGoal(
        id: goal.id, input: goal.input.value1, locked: goal.locked, displayName: goal.displayName)
    })
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
