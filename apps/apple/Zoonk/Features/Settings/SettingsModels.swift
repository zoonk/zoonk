import Foundation

/// Every buddy in the order learners meet them.
enum BuddyKind: String, CaseIterable, Sendable {
  case zu
  case noodle
  case beep
  case otto
}

/// Round comes with the buddy; the rest in the order they're usually earned.
enum BuddyGlasses: String, CaseIterable, Sendable {
  case round
  case star
  case aviator
  case catEye
  case retro
  case monocle
}

/// The buddy the learner picked: kind, an optional own name and glasses. Growth and glow come from
/// the belt and Energy, so only these are saved.
struct BuddyChoice: Equatable, Sendable {
  var kind: BuddyKind
  var name: String?
  var glasses: BuddyGlasses
}

/// Preferences' part of the learning profile.
struct LearningPreferences: Equatable, Sendable {
  var buddy: BuddyChoice
  /// False until the learner saves a buddy: the row then offers "Choose your buddy".
  var buddyPicked: Bool
  var availableGlasses: [BuddyGlasses]
  var dailyLimitMinutes: Int?
  var soundsEnabled: Bool
}

/// One change to Preferences; only the field that changed is sent.
enum PreferencesUpdate: Equatable, Sendable {
  case buddy(BuddyChoice)
  case dailyLimitMinutes(Int?)
  case soundsEnabled(Bool)

  /// Applies the change to what's shown, so the control moves before the server answers.
  func applied(to preferences: LearningPreferences) -> LearningPreferences {
    var next = preferences

    switch self {
    case .buddy(let buddy):
      next.buddy = buddy
      next.buddyPicked = true
    case .dailyLimitMinutes(let minutes):
      next.dailyLimitMinutes = minutes
    case .soundsEnabled(let enabled):
      next.soundsEnabled = enabled
    }

    return next
  }

  var body: Components.Schemas.LearningProfileUpdate {
    switch self {
    case .buddy(let buddy):
      .init(
        buddy: .init(
          value1: .init(
            glasses: .init(rawValue: buddy.glasses.rawValue),
            kind: .init(rawValue: buddy.kind.rawValue) ?? .zu,
            name: buddy.name)))
    case .dailyLimitMinutes(let minutes):
      .init(dailyLimitMinutes: minutes)
    case .soundsEnabled(let enabled):
      .init(soundsEnabled: enabled)
    }
  }
}

/// The daily limits Preferences offers, in minutes (core's `DAILY_LIMIT_CHOICES`).
let dailyLimitChoices = [15, 30, 45, 60, 90, 120, 180]

struct LearnerMemory: Equatable, Sendable {
  var enabled: Bool
  var facts: [MemoryFact]
}

struct MemoryFact: Equatable, Identifiable, Sendable {
  /// The order the Memory screen lists categories in: what learners aim for first, then who they are.
  enum Category: String, CaseIterable, Sendable {
    case goals
    case background
    case routine
    case preferences
    case learning
    case context
  }

  /// Where a fact came from, so the learner can tell what they said from what was noticed.
  enum Source: Equatable, Sendable {
    case chat
    case noticed
    case onboarding
    case session
    case told
  }

  let id: String
  var statement: String
  let category: Category
  let source: Source
  let createdAt: Date
}

/// What the subscription screen shows of a free plan: its buddy messages today.
struct PlanAllowance: Equatable, Sendable {
  enum Tier: String, Sendable {
    case free
    case guest
    case plus
  }

  let tier: Tier
  let buddyMessagesToday: Int
  let buddyMessagesDailyLimit: Int?
}

extension LearningPreferences {
  init(_ profile: Components.Schemas.LearningProfile) {
    self.init(
      buddy: BuddyChoice(
        kind: BuddyKind(rawValue: profile.buddy.kind.rawValue) ?? .zu,
        name: profile.buddy.name,
        glasses: BuddyGlasses(rawValue: profile.buddy.glasses.rawValue) ?? .round),
      buddyPicked: profile.buddy.picked,
      availableGlasses: profile.availableGlasses.compactMap { BuddyGlasses(rawValue: $0.rawValue) },
      dailyLimitMinutes: profile.dailyLimitMinutes,
      soundsEnabled: profile.soundsEnabled)
  }
}

extension MemoryFact {
  init(_ fact: Components.Schemas.MemoryFact) {
    let source: Source =
      switch (fact.origin, fact.source?.value1.kind) {
      case (.noticed, _): .noticed
      case (_, .chat): .chat
      case (_, .onboarding): .onboarding
      case (_, .session): .session
      case (_, nil): .told
      }

    self.init(
      id: fact.id,
      statement: fact.statement,
      category: Category(rawValue: fact.category.rawValue) ?? .context,
      source: source,
      createdAt: fact.createdAt)
  }
}

extension PlanAllowance {
  init(_ allowance: Components.Schemas.AllowanceResponse) {
    let messages = allowance.items.first { $0.kind == .tutorMessage }

    self.init(
      tier: Tier(rawValue: allowance.tier.rawValue) ?? .free,
      buddyMessagesToday: messages?.usedToday ?? 0,
      buddyMessagesDailyLimit: messages?.dailyLimit)
  }
}
