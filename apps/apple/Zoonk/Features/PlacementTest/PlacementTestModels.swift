import Foundation

/// A course's open test: one test of up to `questions` answers that looks for where the learner
/// starts. Core fixes its ceiling when it starts; the screens only say it.
struct PlacementAttempt: Decodable, Equatable, Sendable {
  let answered: Int
  /// The chapter the next question asks about.
  let chapter: String?
  /// About how long the test takes.
  let estimatedMinutes: Int
  let id: String
  /// The test's ceiling, fixed when it started.
  let questions: Int
}

/// The levels a skill's answers place it between, such as B1 to B2.
struct LevelRange: Decodable, Hashable, Sendable {
  let high: String
  let low: String

  /// "B1–B2": never one level the answers can't promise.
  var shown: String { low == high ? low : "\(low)–\(high)" }
}

/// What a course's test asks before it starts: its ceiling and about how long it takes.
struct CoursePlacementOffer: Decodable, Equatable, Sendable {
  let estimatedMinutes: Int
  let questions: Int
}

/// A course as a test's result draws it: its chapters in plan order, each with its lessons, the
/// lessons the learner starts past and whether it holds the next lesson.
struct PlacementCourse: Decodable, Equatable, Sendable {
  struct Chapter: Decodable, Equatable, Sendable {
    let lessons: Int
    /// Lessons already behind the learner for any other reason than this start, such as studied.
    let done: Int
    /// Lessons the learner starts past.
    let skipped: Int
    /// Holds the lesson the learner starts on.
    let start: Bool
  }

  let lessons: Int
  let chapters: [Chapter]
}

/// The last finished test, which stays readable while another is open. A language course's also
/// has each skill's range and the levels it skipped; a course's, where the learner starts and the
/// lesson the plan goes on with.
struct PlacementTestResult: Decodable, Equatable, Sendable {
  struct NextLesson: Decodable, Equatable, Sendable {
    let id: String
    let title: String
    /// A course's next lesson's minutes and chapter.
    var estimatedMinutes: Int?
    var chapter: String?
  }

  var attemptId: String?
  var changeId: String?
  var heldUntilTomorrow: Bool?
  let finishedAt: Date
  let lessonsSkipped: Int
  var levelsSkipped: [String]?
  var nextLesson: NextLesson?
  /// The chapter a course's learner starts in; nil before the plan has one.
  var chapter: String?
  /// The course as the result draws it; nil when the result came before the plan.
  var course: PlacementCourse?
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
    chapter = try container.decodeIfPresent(String.self, forKey: .chapter)
    course = try container.decodeIfPresent(PlacementCourse.self, forKey: .course)
    ranges = try container.decodeIfPresent([String: LevelRange].self, forKey: .ranges)
  }

  private enum CodingKeys: String, CodingKey {
    case attemptId, changeId, chapter, course, finishedAt, heldUntilTomorrow, lessonsSkipped,
      levelsSkipped, nextLesson, ranges
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
  /// About how long the test takes.
  let estimatedMinutes: Int
  let kind: Kind
  /// A language course's next level the learner can test out of; nil when none is left.
  var nextTestOutLevel: String?
  /// A course's test before it starts.
  var offer: CoursePlacementOffer?
  let result: PlacementTestResult?
  let state: State

  var languageResult: PlacementTestResult? { kind == .language ? result : nil }

  /// Something to open: a test to start or go on with, or the last one's result. A course with
  /// neither has no row.
  var isShown: Bool {
    guard kind == .learn else { return !(state == .start && estimatedMinutes == 0) }
    return attempt != nil || offer != nil || result != nil
  }
}
