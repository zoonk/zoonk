import Foundation

public struct ChallengeContent: Codable, Hashable, Sendable {
  public enum Variant: String, Codable, Hashable, Sendable {
    case work, whatIf
  }

  public struct Meter: Codable, Hashable, Sendable, Identifiable {
    public enum GoodWhen: String, Codable, Hashable, Sendable {
      case high, low
    }

    public let id: String
    public let label: String
    public let start: Int
    public let goodWhen: GoodWhen
  }

  public struct Message: Codable, Hashable, Sendable {
    /// A team slot id, or the learner's own role.
    public let from: String
    public let text: String
  }

  public struct Panel: Codable, Hashable, Sendable {
    public struct Metric: Codable, Hashable, Sendable {
      public let label: String
      public let value: String
      public let note: String?
    }

    public let title: String?
    public let note: String?
    public let metrics: [Metric]
  }

  public struct Choice: Codable, Hashable, Sendable, Identifiable {
    public enum Quality: String, Codable, Hashable, Sendable {
      case strong, fair, weak
    }

    public struct Effect: Codable, Hashable, Sendable {
      public let meter: String
      public let change: Int
    }

    public struct Note: Codable, Hashable, Sendable {
      public enum Kind: String, Codable, Hashable, Sendable {
        case good, improve
      }

      public let kind: Kind
      public let skill: String
      public let text: String
      public let example: String?
    }

    public struct TimeJump: Codable, Hashable, Sendable {
      public let label: String
      public let panel: Panel?
    }

    public let id: String
    public let text: String
    public let next: String
    public let quality: Quality
    public let effects: [Effect]
    public let replies: [Message]
    public let notes: [Note]
    public let timeJump: TimeJump?
  }

  public struct Node: Codable, Hashable, Sendable, Identifiable {
    public let id: String
    public let prompt: String
    public let messages: [Message]
    public let choices: [Choice]
  }

  public struct Ending: Codable, Hashable, Sendable, Identifiable {
    public let id: String
    public let outcome: String
  }

  public struct TeamSlot: Codable, Hashable, Sendable, Identifiable {
    public let id: String
    public let role: String
    public let expertise: String
    public let ai: Bool
  }

  public struct Skill: Codable, Hashable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let practice: String
  }

  public let title: String
  public let variant: Variant
  public let setting: String
  public let mission: String
  public let deadline: String?
  public let team: [TeamSlot]
  public let meters: [Meter]
  public let panels: [Panel]
  public let skills: [Skill]
  public let startNodeId: String
  public let nodes: [Node]
  public let endings: [Ending]
}
