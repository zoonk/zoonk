import Foundation

struct LearningPreferences: Equatable, Sendable {
  var buddy: BuddyChoice
  var buddyPicked: Bool
  var availableGlasses: [BuddyGlasses]
  var soundsEnabled: Bool
}

enum PreferencesUpdate: Equatable, Sendable {
  case buddy(BuddyChoice)
  /// The summary shows it, so it changes nothing here.
  case shareUsageData(Bool)
  case soundsEnabled(Bool)

  func applied(to preferences: LearningPreferences) -> LearningPreferences {
    var next = preferences

    switch self {
    case .buddy(let buddy):
      next.buddy = buddy
      next.buddyPicked = true
    case .shareUsageData:
      break
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
    case .shareUsageData:
      break
    case .soundsEnabled:
      next.soundsEnabled = source.soundsEnabled
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
    case .shareUsageData(let shares):
      .init(shareUsageData: shares)
    case .soundsEnabled(let enabled):
      .init(soundsEnabled: enabled)
    }
  }
}

/// What undoing a memory change did, on the Memory page and in the buddy's answers.
enum MemoryUndo: Equatable, Sendable {
  /// One of the changes was undone or changed since, which no retry undoes.
  case changedSince
  case failed
  case undoing
  case undone

  var canUndo: Bool {
    self == .failed
  }
}

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
    case call
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

/// What a free account can do; nil means no cap.
struct FreePlan: Decodable, Equatable, Sendable {
  let activeGoals: Int?
  let examPrepDays: Int?
  let guestLessons: Int?
  let lessonsPerDay: Int?
  let lessonsPerMonth: Int?
  let tutorMessagesPerDay: Int?
  let uploadsPerDay: Int?
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
      soundsEnabled: profile.soundsEnabled)
  }
}

extension MemoryFact {
  init(_ fact: Components.Schemas.MemoryFact) {
    let source: Source =
      switch (fact.origin, fact.source?.value1.kind) {
      case (.noticed, _): .noticed
      case (_, .call): .call
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
