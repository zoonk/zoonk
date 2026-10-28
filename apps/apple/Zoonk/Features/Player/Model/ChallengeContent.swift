import Foundation

/// A team challenge: a short case at work (or a "what if"), decided step by step with the team.
/// Every path reaches an ending; it's right when at least half of the decisions were good.
struct ChallengeContent: Codable, Hashable, Sendable {
  enum Variant: String, Codable, Hashable, Sendable {
    case work, whatIf
  }

  struct Meter: Codable, Hashable, Sendable, Identifiable {
    enum GoodWhen: String, Codable, Hashable, Sendable {
      case high, low
    }

    let id: String
    let label: String
    let start: Int
    let goodWhen: GoodWhen
  }

  struct Message: Codable, Hashable, Sendable {
    /// A team slot id, or the learner's own role.
    let from: String
    let text: String
  }

  struct Panel: Codable, Hashable, Sendable {
    struct Metric: Codable, Hashable, Sendable {
      let label: String
      let value: String
      let note: String?
    }

    let title: String?
    let note: String?
    let metrics: [Metric]
  }

  struct Choice: Codable, Hashable, Sendable, Identifiable {
    enum Quality: String, Codable, Hashable, Sendable {
      case strong, fair, weak
    }

    struct Effect: Codable, Hashable, Sendable {
      let meter: String
      let change: Int
    }

    struct Note: Codable, Hashable, Sendable {
      enum Kind: String, Codable, Hashable, Sendable {
        case good, improve
      }

      let kind: Kind
      let skill: String
      let text: String
      let example: String?
    }

    struct TimeJump: Codable, Hashable, Sendable {
      let label: String
      let panel: Panel?
    }

    let id: String
    let text: String
    let next: String
    let quality: Quality
    let effects: [Effect]
    let replies: [Message]
    let notes: [Note]
    let timeJump: TimeJump?
  }

  struct Node: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let prompt: String
    let messages: [Message]
    let choices: [Choice]
  }

  struct Ending: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let outcome: String
  }

  struct TeamSlot: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let role: String
    let expertise: String
    let ai: Bool
  }

  struct Skill: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let name: String
    let practice: String
  }

  let title: String
  let variant: Variant
  let setting: String
  let mission: String
  let deadline: String?
  let team: [TeamSlot]
  let meters: [Meter]
  let panels: [Panel]
  let skills: [Skill]
  let startNodeId: String
  let nodes: [Node]
  let endings: [Ending]
}
