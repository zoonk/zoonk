import Foundation

/// Graded on the server; questions never come with the answer.
enum PracticeItemFormat: String, Decodable, Sendable {
  case matchPairs
  case multipleChoice
  case numeric
  case order
  case trueFalse
  case typed
}

/// The words a true-or-false statement is answered with, by the goal's exam: right or wrong where
/// a wrong answer cancels a right one (Cebraspe), true or false everywhere else.
enum PracticeTrueFalseLabels: String, Decodable, Sendable {
  case rightWrong
  case trueFalse
}

enum PracticeSelect: Hashable, Sendable, Decodable {
  case all
  case count(Int)

  static let one = PracticeSelect.count(1)

  var isMulti: Bool { self != .one }

  /// Exactly as many picks as asked, or at least one for "all".
  func isComplete(_ picks: [Int]) -> Bool {
    switch self {
    case .all: !picks.isEmpty
    case .count(let count): picks.count == count
    }
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.singleValueContainer()

    if let count = try? container.decode(Int.self) {
      self = .count(count)
    } else {
      self = .all
    }
  }
}

enum PracticeAnswer: Hashable, Sendable, Codable {
  case choice(Int)
  case choices([Int])
  case dontKnow
  case matches([Int])
  case number(Double)
  case order([Int])
  case text(String)
  case trueFalse(Bool)

  private enum CodingKeys: String, CodingKey {
    case dontKnow, isTrue, matches, number, order, selectedIndex, selectedIndexes, text
  }

  var isDontKnow: Bool { self == .dontKnow }

  var picks: [Int] {
    switch self {
    case .choice(let index): [index]
    case .choices(let indexes): indexes
    default: []
    }
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)

    if let index = try container.decodeIfPresent(Int.self, forKey: .selectedIndex) {
      self = .choice(index)
    } else if let indexes = try container.decodeIfPresent([Int].self, forKey: .selectedIndexes) {
      self = .choices(indexes)
    } else if let isTrue = try container.decodeIfPresent(Bool.self, forKey: .isTrue) {
      self = .trueFalse(isTrue)
    } else if let matches = try container.decodeIfPresent([Int].self, forKey: .matches) {
      self = .matches(matches)
    } else if let number = try container.decodeIfPresent(Double.self, forKey: .number) {
      self = .number(number)
    } else if let order = try container.decodeIfPresent([Int].self, forKey: .order) {
      self = .order(order)
    } else if let text = try container.decodeIfPresent(String.self, forKey: .text) {
      self = .text(text)
    } else {
      self = .dontKnow
    }
  }

  func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)

    switch self {
    case .choice(let index): try container.encode(index, forKey: .selectedIndex)
    case .choices(let indexes): try container.encode(indexes, forKey: .selectedIndexes)
    case .dontKnow: try container.encode(true, forKey: .dontKnow)
    case .matches(let matches): try container.encode(matches, forKey: .matches)
    case .number(let number): try container.encode(number, forKey: .number)
    case .order(let order): try container.encode(order, forKey: .order)
    case .text(let text): try container.encode(text, forKey: .text)
    case .trueFalse(let isTrue): try container.encode(isTrue, forKey: .isTrue)
    }
  }
}

struct PracticeImage: Hashable, Sendable, Decodable {
  let alt: String
  let height: Int?
  let url: String
  let width: Int?
}

enum PracticeVisual: Hashable, Sendable, Decodable {
  case chart(PracticeChart)
  case timeline(PracticeTimeline)

  private enum CodingKeys: String, CodingKey { case kind }

  init(from decoder: any Decoder) throws {
    let kind = try decoder.container(keyedBy: CodingKeys.self).decode(String.self, forKey: .kind)
    self =
      kind == "timeline"
      ? .timeline(try PracticeTimeline(from: decoder)) : .chart(try PracticeChart(from: decoder))
  }
}

struct PracticeChart: Hashable, Sendable, Decodable {
  enum Kind: String, Decodable, Sendable { case bar, line }

  struct Series: Hashable, Sendable, Decodable {
    let name: String
    let values: [Double]
  }

  let axisStart: Double?
  let categories: [String]
  let categoryLabel: String
  let chart: Kind
  let series: [Series]
  let source: String?
  let title: String
  let unit: String?
  let valueLabel: String
}

struct PracticeTimeline: Hashable, Sendable, Decodable {
  struct Event: Hashable, Sendable, Decodable {
    let date: String
    let detail: String?
    let label: String
  }

  let events: [Event]
  let title: String
}

struct PracticeTranscriptLine: Hashable, Sendable, Decodable {
  let speaker: String
  let text: String
}

struct PracticeItemSet: Hashable, Sendable, Decodable {
  enum Kind: String, Decodable, Sendable { case audio, `case`, chart, text }

  struct Listening: Hashable, Sendable, Decodable {
    struct Audio: Hashable, Sendable, Decodable {
      let durationMs: Int?
      let url: String
    }

    let audio: Audio?
    /// How many times the recording plays, as in the exam.
    let plays: Int
    let task: String?
    let title: String?
    /// Only once the set's questions are answered.
    let transcript: [PracticeTranscriptLine]?
  }

  let count: Int
  let id: String
  let kind: Kind
  let listening: Listening?
  let position: Int
  let source: String?
  let text: String?
  let title: String?
  let visual: PracticeVisual?
}

struct PracticeCitation: Hashable, Sendable, Decodable {
  let checkedAt: Date?
  let publisher: String?
  let text: String
  let title: String?
  let url: String?
}

struct PracticeDrill: Hashable, Sendable, Decodable {
  enum Kind: String, Decodable, Sendable {
    case noGuessing, readCarefully, reteach, retry, spotTheTrap, timed
  }

  struct Lesson: Hashable, Sendable, Decodable {
    let id: String
    let ideas: [String]
    let title: String
  }

  let kind: Kind
  let lesson: Lesson?
  let timeLimitSeconds: Int?

  /// A content gap brings its lesson's ideas back on a screen of their own before the questions.
  var isIdeaFirst: Bool { kind == .reteach && !(lesson?.ideas.isEmpty ?? true) }

  /// A misread is drilled by reading the whole question before its answers show.
  var isReadFirst: Bool { kind == .readCarefully }
}

/// The learner's last answer to this question before today; its text only when it was wrong.
struct PracticeTimeMachine: Hashable, Sendable, Decodable {
  let answer: String?
  let answeredAt: Date
  let isCorrect: Bool
}

/// What was already answered on an earlier visit: a blank counts as neither right nor wrong.
struct PracticeAnsweredMark: Hashable, Sendable, Decodable {
  let blank: Bool
  let isCorrect: Bool
}

struct PracticeNumericEntry: Hashable, Sendable, Decodable {
  enum Kind: String, Decodable, Sendable { case decimals, fraction, integer, number }

  let kind: Kind
  let places: Int?
}

struct PracticeNumericUnit: Hashable, Sendable, Decodable {
  enum Position: String, Decodable, Sendable { case prefix, suffix }

  let position: Position
  let symbol: String
}

/// Formats only fill the fields they use.
struct PracticeQuestion: Identifiable, Hashable, Sendable, Decodable {
  var answered: PracticeAnsweredMark?
  var area: String?
  var capsuleKey: String?
  var citation: PracticeCitation?
  var context: String?
  var drill: PracticeDrill?
  var entry: PracticeNumericEntry?
  var format: PracticeItemFormat
  var image: PracticeImage?
  var itemId: String
  var left: [String]
  var mistakeId: String?
  var options: [String]
  /// A placement question of the goal's first week: never saved as a mistake.
  var placement: Bool
  var question: String
  /// A real past exam question, shown with its source before it's answered.
  var quoted: Bool
  var right: [String]
  var select: PracticeSelect
  var set: PracticeItemSet?
  var skillId: String?
  var timeMachine: PracticeTimeMachine?
  var unit: PracticeNumericUnit?
  var visual: PracticeVisual?

  var id: String { itemId }

  private enum CodingKeys: String, CodingKey {
    case answered, area, capsuleKey, citation, context, drill, entry, format, image, itemId, left
    case mistakeId, options, placement, question, quoted, right, select, set, skillId, timeMachine
    case unit, visual
  }

  init(
    itemId: String, format: PracticeItemFormat, question: String, options: [String] = [],
    select: PracticeSelect = .one
  ) {
    self.itemId = itemId
    self.format = format
    self.question = question
    self.options = options
    self.select = select
    left = []
    right = []
    placement = false
    quoted = false
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    answered = try container.decodeIfPresent(PracticeAnsweredMark.self, forKey: .answered)
    area = try container.decodeIfPresent(String.self, forKey: .area)
    capsuleKey = try container.decodeIfPresent(String.self, forKey: .capsuleKey)
    citation = try container.decodeIfPresent(PracticeCitation.self, forKey: .citation)
    context = try container.decodeIfPresent(String.self, forKey: .context)
    drill = try container.decodeIfPresent(PracticeDrill.self, forKey: .drill)
    entry = try container.decodeIfPresent(PracticeNumericEntry.self, forKey: .entry)
    format = try container.decode(PracticeItemFormat.self, forKey: .format)
    image = try container.decodeIfPresent(PracticeImage.self, forKey: .image)
    itemId = try container.decode(String.self, forKey: .itemId)
    left = try container.decodeIfPresent([String].self, forKey: .left) ?? []
    mistakeId = try container.decodeIfPresent(String.self, forKey: .mistakeId)
    options = (try? container.decodeIfPresent([String].self, forKey: .options)) ?? []
    placement = try container.decodeIfPresent(Bool.self, forKey: .placement) ?? false
    question = try container.decode(String.self, forKey: .question)
    quoted = try container.decodeIfPresent(Bool.self, forKey: .quoted) ?? false
    right = try container.decodeIfPresent([String].self, forKey: .right) ?? []
    select = try container.decodeIfPresent(PracticeSelect.self, forKey: .select) ?? .one
    set = try container.decodeIfPresent(PracticeItemSet.self, forKey: .set)
    skillId = try container.decodeIfPresent(String.self, forKey: .skillId)
    timeMachine = try container.decodeIfPresent(PracticeTimeMachine.self, forKey: .timeMachine)
    unit = try container.decodeIfPresent(PracticeNumericUnit.self, forKey: .unit)
    visual = try container.decodeIfPresent(PracticeVisual.self, forKey: .visual)
  }
}

struct PracticeFeedback: Hashable, Sendable, Decodable {
  struct Hyperdrive: Hashable, Sendable, Decodable {
    let level: Int
    let streak: Int
  }

  /// A statement left blank where a wrong answer cancels a right one: neither right nor a mistake.
  var blank: Bool
  /// Null in checkpoints until they end.
  var correctAnswer: PracticeAnswer?
  var explanation: String?
  var hyperdrive: Hyperdrive
  var isCorrect: Bool
  var mistakeFixed: Bool
  var pauseSuggested: Bool
  var reinforcementLessons: Int?
  var savedToNotebook: Bool
  var transcript: [PracticeTranscriptLine]?
  var trap: String?
  var workedSteps: [String]
}

/// A swipe capsule scores net.
struct PracticeCapsule: Hashable, Sendable, Decodable {
  enum Format: String, Decodable, Sendable { case matchPairs, rapidFire, swipe }

  let format: Format
  let key: String
}

struct PracticeBlockCheckpoint: Hashable, Sendable, Decodable {
  enum Kind: String, Decodable, Sendable { case boss, finalBoss, weekly }

  let kind: Kind
  let mock: Bool
  let passMark: Int
  let rematch: Bool
}

struct PracticeBlock: Hashable, Sendable, Decodable {
  enum Kind: String, Decodable, Sendable { case checkpoint, learn, practice, produce, review }

  let capsules: [PracticeCapsule]
  let checkpoint: PracticeBlockCheckpoint?
  let estimatedMinutes: Int
  let extra: Bool
  let fullReview: Bool
  let id: String
  let kind: Kind
  let mistakesOnly: Bool
  let netScored: Bool
  let status: Status
  let title: String?

  enum Status: String, Decodable, Sendable { case active, completed, pending, skipped }
}

/// Questions never come with their answers.
struct QuestionBlockDetail: Hashable, Sendable, Decodable {
  var block: PracticeBlock
  /// False in checkpoints: a duel without hints.
  var hints: Bool
  var questions: [PracticeQuestion]
  var trueFalseLabels: PracticeTrueFalseLabels
}

struct PracticeReached: Hashable, Sendable, Decodable {
  struct Level: Hashable, Sendable, Decodable {
    let color: String
    let level: Int
  }

  var energy: Int?
  var level: Level?

  static let nothing = PracticeReached(energy: nil, level: nil)

  /// Each count of a run reaches its own; the run's end celebrates the highest of them.
  func merged(with other: PracticeReached) -> PracticeReached {
    PracticeReached(
      energy: [energy, other.energy].compactMap(\.self).max(),
      level: [level, other.level].compactMap(\.self).max { $0.level < $1.level })
  }
}

/// Re-reads a generated payload as a practice model. The generator writes one nested type per
/// place a schema is inlined (a block's question, a checkpoint's, a drill's), all with the same
/// JSON, so each practice model decodes from that JSON once instead of mapping every copy.
enum PracticeJSON {
  static func recode<Value: Decodable>(_ payload: some Encodable, as type: Value.Type) throws
    -> Value
  {
    try JSONDecoder().decode(type, from: JSONEncoder().encode(payload))
  }

  static func recode<Value: Decodable>(_ payload: some Encodable) throws -> Value {
    try recode(payload, as: Value.self)
  }
}
