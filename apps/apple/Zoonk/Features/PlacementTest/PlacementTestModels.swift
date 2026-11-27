import Foundation

/// How much a course's test checks: one part of about twelve questions, or every topic still ahead
/// in parts. The quick test is the full test's first part, so it can go on as the full test.
enum PlacementLength: String, Codable, Equatable, Sendable {
  case quick
  case wholeCourse
}

/// A course's test, open or between its parts. Core fixes its parts and each part's question count
/// when it starts; the screens only say them.
struct PlacementAttempt: Decodable, Equatable, Sendable {
  /// Where a part the learner stopped midway goes on: "part 5 of 14, question 4".
  struct Resume: Decodable, Equatable, Sendable {
    let part: Int
    let question: Int
  }

  /// This part's answers, never more than `questions`.
  let answered: Int
  /// The chapter the next question asks about.
  let chapter: String?
  /// About how long the current part takes.
  let estimatedMinutes: Int
  let id: String
  let length: PlacementLength
  /// The next part with topics left; nil when none is.
  let nextPart: Int?
  let part: Int
  /// This part asks nothing more and closed: the next one starts on "Keep going".
  let partComplete: Bool
  let parts: Int
  /// Parts with questions left, the current one included while it has some.
  let partsLeft: Int
  /// Parts the current part removed because they build on topics the learner doesn't know yet;
  /// 0 until it closes.
  let partsRemoved: Int
  /// The current part's ceiling, fixed when it opened.
  let questions: Int
  /// Set once the learner stopped this part midway.
  let resume: Resume?
  let totalEstimatedMinutes: Int
  /// About how long the rest takes: this part's unanswered questions and every later part.
  let remainingEstimatedMinutes: Int

  /// The learner chose the quick test and it's over: what's left is its result's "Test the rest".
  var quickTestEnded: Bool { length == .quick && (partComplete || resume != nil) }
}

/// The levels a skill's answers place it between, such as B1 to B2.
struct LevelRange: Decodable, Hashable, Sendable {
  let high: String
  let low: String

  /// "B1–B2": never one level the answers can't promise.
  var shown: String { low == high ? low : "\(low)–\(high)" }
}

/// What a course's test offers before it starts: one part's questions and time, and the full
/// test's parts and time when the course has more than one part.
struct CoursePlacementOffer: Decodable, Equatable, Sendable {
  struct WholeCourse: Decodable, Equatable, Sendable {
    let estimatedMinutes: Int
    let parts: Int
  }

  let estimatedMinutes: Int
  let questions: Int
  let wholeCourse: WholeCourse?
}

/// The last finished test, which stays readable while another is open. A language course's also
/// has each skill's range and the levels it skipped; a course's, the part it closed and the lesson
/// the plan goes on with.
struct PlacementTestResult: Decodable, Equatable, Sendable {
  struct NextLesson: Decodable, Equatable, Sendable {
    let id: String
    let title: String
  }

  var attemptId: String?
  var changeId: String?
  var heldUntilTomorrow: Bool?
  let finishedAt: Date
  /// Every part's skips, for a course's test.
  let lessonsSkipped: Int
  var levelsSkipped: [String]?
  var nextLesson: NextLesson?
  /// A course's last closed part, and what that part skipped.
  var part: Int?
  var partLessonsSkipped: Int?
  /// The parts that part removed, as the attempt's `partsRemoved`.
  var partsRemoved: Int?
  var ranges: [String: LevelRange]?

  init(finishedAt: Date, lessonsSkipped: Int) {
    self.finishedAt = finishedAt
    self.lessonsSkipped = lessonsSkipped
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    attemptId = try container.decodeIfPresent(String.self, forKey: .attemptId)
    changeId = try container.decodeIfPresent(String.self, forKey: .changeId)
    heldUntilTomorrow = try container.decodeIfPresent(Bool.self, forKey: .heldUntilTomorrow)
    finishedAt = try container.decode(Date.self, forKey: .finishedAt)
    lessonsSkipped = try container.decodeIfPresent(Int.self, forKey: .lessonsSkipped) ?? 0
    levelsSkipped = try container.decodeIfPresent([String].self, forKey: .levelsSkipped)
    nextLesson = try container.decodeIfPresent(NextLesson.self, forKey: .nextLesson)
    part = try container.decodeIfPresent(Int.self, forKey: .part)
    partLessonsSkipped = try container.decodeIfPresent(Int.self, forKey: .partLessonsSkipped)
    partsRemoved = try container.decodeIfPresent(Int.self, forKey: .partsRemoved)
    ranges = try container.decodeIfPresent([String: LevelRange].self, forKey: .ranges)
  }

  private enum CodingKeys: String, CodingKey {
    case attemptId, changeId, finishedAt, heldUntilTomorrow, lessonsSkipped, levelsSkipped,
      nextLesson, part, partLessonsSkipped, partsRemoved, ranges
  }

  struct SkillRange: Hashable, Sendable {
    let skill: LevelTest.Skill
    let range: LevelRange
  }

  /// Reading's and listening's ranges, in that order, for the skills the test placed: a skill has
  /// one only once its questions were finished.
  var skillRanges: [SkillRange] {
    Self.skillRanges(in: ranges ?? [:])
  }

  static func skillRanges(in ranges: [String: LevelRange]) -> [SkillRange] {
    [LevelTest.Skill.reading, .listening].compactMap { skill in
      ranges[skill.rawValue].map { SkillRange(skill: skill, range: $0) }
    }
  }

  /// The test didn't finish listening's questions, so listening has no level yet.
  var listeningUntested: Bool { ranges?[LevelTest.Skill.listening.rawValue] == nil }
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
  /// A language's open level test: its answers and its ceiling.
  var answered: Int?
  var total: Int?
  /// A course's full test's length before it starts, or the test's own; a language's level test's.
  let estimatedMinutes: Int
  let kind: Kind
  /// A language course's next level the learner can test out of; nil when none is left.
  var nextTestOutLevel: String?
  /// A course's test before it starts.
  var offer: CoursePlacementOffer?
  let result: PlacementTestResult?
  let state: State

  var languageResult: PlacementTestResult? { kind == .language ? result : nil }

  /// Nothing is left ahead to check and nothing was checked yet.
  var isShown: Bool { !(state == .start && estimatedMinutes == 0) }

  /// A full test with parts left: the plan opens it on "Continue your test". A quick test that
  /// ended shows its result instead, with "Test the rest" on it.
  var continuesInParts: Bool {
    guard state == .continue, let attempt else { return false }
    return !attempt.quickTestEnded
  }
}
