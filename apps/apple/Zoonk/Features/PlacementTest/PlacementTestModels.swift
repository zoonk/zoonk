import Foundation

/// How much a test taken from the plan checks: about four minutes, or every topic still ahead in
/// parts.
enum PlacementLength: String, Codable, Equatable, Sendable {
  case quick
  case wholeCourse
}

/// A test taken from the plan, open or between its parts.
struct PlacementAttempt: Decodable, Equatable, Sendable {
  /// What's left of it.
  let estimatedMinutes: Int
  let id: String
  let length: PlacementLength
  let part: Int
  /// This part asks nothing more and closed: the next one starts on "Keep going".
  let partComplete: Bool
}

/// The levels a skill's answers place it between, such as B1 to B2.
struct LevelRange: Decodable, Hashable, Sendable {
  let high: String
  let low: String

  /// "B1–B2": never one level the answers can't promise.
  var shown: String { low == high ? low : "\(low)–\(high)" }
}

/// The last finished test, which stays readable while another is open. A language course's also
/// has each skill's range and the levels it skipped.
struct PlacementTestResult: Decodable, Equatable, Sendable {
  var attemptId: String?
  var changeId: String?
  let finishedAt: Date
  let lessonsSkipped: Int
  var levelsSkipped: [String]?
  var ranges: [String: LevelRange]?
  /// A language course's whole-course test goes on through the course's topics.
  var wholeCourseReady: Bool?

  init(finishedAt: Date, lessonsSkipped: Int) {
    self.finishedAt = finishedAt
    self.lessonsSkipped = lessonsSkipped
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    attemptId = try container.decodeIfPresent(String.self, forKey: .attemptId)
    changeId = try container.decodeIfPresent(String.self, forKey: .changeId)
    finishedAt = try container.decode(Date.self, forKey: .finishedAt)
    lessonsSkipped = try container.decodeIfPresent(Int.self, forKey: .lessonsSkipped) ?? 0
    levelsSkipped = try container.decodeIfPresent([String].self, forKey: .levelsSkipped)
    ranges = try container.decodeIfPresent([String: LevelRange].self, forKey: .ranges)
    wholeCourseReady = try container.decodeIfPresent(Bool.self, forKey: .wholeCourseReady)
  }

  private enum CodingKeys: String, CodingKey {
    case attemptId, changeId, finishedAt, lessonsSkipped, levelsSkipped, ranges, wholeCourseReady
  }

  struct SkillRange: Hashable, Sendable {
    let skill: LevelTest.Skill
    let range: LevelRange
  }

  /// Reading's and listening's ranges, in that order, for the skills the test assessed.
  var skillRanges: [SkillRange] {
    Self.skillRanges(in: ranges ?? [:])
  }

  static func skillRanges(in ranges: [String: LevelRange]) -> [SkillRange] {
    [LevelTest.Skill.reading, .listening].compactMap { skill in
      ranges[skill.rawValue].map { SkillRange(skill: skill, range: $0) }
    }
  }
}

/// The plan's way into the test of what the learner already knows (a learn or language course's;
/// an exam has its Focus test), and its last result.
struct PlanPlacementTest: Decodable, Equatable, Sendable {
  enum Kind: String, Decodable, Sendable {
    case learn
    case language
  }

  enum State: String, Decodable, Sendable {
    case start
    case `continue`
    case result
  }

  let attempt: PlacementAttempt?
  /// The whole-course test's length before it starts; what's left of an open test.
  let estimatedMinutes: Int
  let kind: Kind
  /// A language course's next level the learner can test out of; nil when none is left.
  var nextTestOutLevel: String?
  let result: PlacementTestResult?
  let state: State

  /// Nothing is left ahead to check and nothing was checked yet.
  var isShown: Bool { !(state == .start && estimatedMinutes == 0) }
}
