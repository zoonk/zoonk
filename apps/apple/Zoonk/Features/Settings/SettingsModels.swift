import Foundation

struct LearningPreferences: Equatable, Sendable {
  var buddy: BuddyChoice
  var buddyPicked: Bool
  var availableGlasses: [BuddyGlasses]
  var dailyLimitMinutes: Int?
  var soundsEnabled: Bool
}

enum PreferencesUpdate: Equatable, Sendable {
  case buddy(BuddyChoice)
  case dailyLimitMinutes(Int?)
  case soundsEnabled(Bool)

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

  /// `preferences` with the setting this update changes as `source` has it.
  func copied(from source: LearningPreferences, to preferences: LearningPreferences)
    -> LearningPreferences
  {
    var next = preferences

    switch self {
    case .buddy:
      next.buddy = source.buddy
      next.buddyPicked = source.buddyPicked
    case .dailyLimitMinutes:
      next.dailyLimitMinutes = source.dailyLimitMinutes
    case .soundsEnabled:
      next.soundsEnabled = source.soundsEnabled
    }

    return next
  }

  /// "No limit" clears the daily limit, which the generated body would leave out.
  var nullKeys: [String] {
    self == .dailyLimitMinutes(nil) ? ["dailyLimitMinutes"] : []
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

/// Core's `DAILY_LIMIT_CHOICES`, in minutes.
let dailyLimitChoices = [15, 30, 45, 60, 90, 120, 180]

struct LearnerMemory: Equatable, Sendable {
  var enabled: Bool
  var facts: [MemoryFact]
}

struct MemoryFact: Equatable, Identifiable, Sendable {
  /// Listed in this order: what learners aim for first, then who they are.
  enum Category: String, CaseIterable, Sendable {
    case goals
    case background
    case routine
    case preferences
    case learning
    case context
  }

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
