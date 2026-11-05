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
    /// What the idea covers without its answer, since the opening map shows it before it's taught.
    public let about: String?
    public let icon: LessonIcon?
  }

  public let shape: Shape
  public let ideas: [Idea]
}

/// Its white sticker border reads on light and dark alike.
public struct LessonIcon: Codable, Hashable, Sendable {
  /// 256 px.
  public let url: String
  /// 96 px.
  public let smallUrl: String

  public init(url: String, smallUrl: String) {
    self.url = url
    self.smallUrl = smallUrl
  }
}
