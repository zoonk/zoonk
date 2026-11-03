import Foundation

/// Replaces the generated `LessonMap` (`typeOverrides` in `openapi-generator-config.yaml`): a
/// lesson's ideas, drawn at its end. Maps saved before labels have none.
public struct LessonSummary: Codable, Hashable, Sendable {
  public enum Shape: String, Codable, Hashable, Sendable {
    case hub
    /// Each idea is a level that holds the one before it, smallest first.
    case nested
  }

  public struct Idea: Codable, Hashable, Sendable {
    public let text: String
    public let label: String?
  }

  public let shape: Shape
  public let ideas: [Idea]
}
