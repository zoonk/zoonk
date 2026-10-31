import Foundation

// Re-read from the generated types (`PracticeJSON.recode`), so the runner can change its drafts and
// plays as the learner goes.

enum MockPurpose: String, Decodable, Sendable {
  case planned
  case practice
  case placement
}

struct MockShape: Hashable, Codable, Sendable {
  enum Kind: String, Codable, Sendable {
    case full
    case half
    case area
  }

  var area: String?
  var day: Int?
  var kind: Kind
}

struct MockDraft: Hashable, Codable, Sendable {
  var answer: PracticeAnswer?
  var durationMs: Int
  var flagged: Bool
  var itemId: String

  /// A number counts even when it's zero.
  var isAnswered: Bool {
    switch answer {
    case nil, .dontKnow: false
    case .text(let text): !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    default: true
    }
  }

  static func empty(_ itemId: String) -> MockDraft {
    MockDraft(answer: nil, durationMs: 0, flagged: false, itemId: itemId)
  }
}

struct MockQuestion: Identifiable, Hashable, Sendable, Decodable {
  enum Format: String, Decodable, Sendable {
    case multipleChoice
    case numeric
    case trueFalse
    case typed
    case essay
  }

  var area: String?
  var context: String?
  var format: Format
  var itemId: String
  var number: Int
  var question: String
  var set: PracticeItemSet?
  /// Nil for an essay.
  var practice: PracticeQuestion?

  var id: String { itemId }

  private enum CodingKeys: String, CodingKey {
    case area, context, format, itemId, number, question, set
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    area = try container.decodeIfPresent(String.self, forKey: .area)
    context = try container.decodeIfPresent(String.self, forKey: .context)
    format = try container.decode(Format.self, forKey: .format)
    itemId = try container.decode(String.self, forKey: .itemId)
    number = try container.decode(Int.self, forKey: .number)
    question = try container.decode(String.self, forKey: .question)
    set = try container.decodeIfPresent(PracticeItemSet.self, forKey: .set)
    practice = format == .essay ? nil : try PracticeQuestion(from: decoder)
  }
}

struct MockSection: Hashable, Decodable, Sendable {
  enum Status: String, Decodable, Sendable {
    case current
    case done
    case upcoming
  }

  struct Navigation: Hashable, Decodable, Sendable {
    var answerChanges: Int?
    var forwardOnly: Bool
    var itemSeconds: Int?
    var mustAnswer: Bool
  }

  var breakAfterMinutes: Int?
  var essays: Int
  var index: Int
  var minutes: Int
  var name: String?
  var navigation: Navigation?
  var questions: Int
  var status: Status
  var tools: String?
}

struct MockCurrent: Hashable, Decodable, Sendable {
  enum Kind: String, Decodable, Sendable {
    case listening
    case speaking
  }

  struct Plays: Hashable, Decodable, Sendable {
    var played: Int
    var setId: String
  }

  var changesLeft: Int?
  var deadline: Date
  var drafts: [MockDraft]
  var kind: Kind?
  var plays: [Plays]
  var questions: [MockQuestion]
  var resume: Int
  var section: Int
}

struct MockResult: Hashable, Decodable, Sendable {
  struct Area: Hashable, Decodable, Sendable {
    struct Score: Hashable, Decodable, Sendable {
      var high: Double
      var low: Double
      var score: Double
    }

    var correct: Double
    var name: String
    var score: Score?
    var secondsPerQuestion: Double
    var targetSecondsPerQuestion: Double?
    var total: Int
  }

  struct Coherence: Hashable, Decodable, Sendable {
    var easyWrong: Int
    var hardRight: Int
    var isCoherent: Bool
  }

  struct IRT: Hashable, Decodable, Sendable {
    var high: Double
    var low: Double
    var score: Double
  }

  struct Net: Hashable, Decodable, Sendable {
    var blank: Int
    var max: Int
    var net: Double
    var partial: Int
    var penalty: Double
    var right: Int
    var wrong: Int
  }

  struct Preparation: Hashable, Decodable, Sendable {
    var after: Double
    var before: Double
  }

  struct Topic: Hashable, Decodable, Sendable, Identifiable {
    var area: String?
    var correct: Int
    var name: String
    var skillId: String
    var total: Int

    var id: String { skillId }
  }

  var areas: [Area]
  var blank: Int
  var calibration: NetCalibration?
  var coherence: Coherence?
  var correct: Double
  var irt: IRT?
  var minutesUsed: Double
  var net: Net?
  var plannedMinutes: Double
  /// Nil for an exam not scored in points.
  var points: MockPoints?
  var preparation: Preparation?
  var previous: Double?
  var topics: [Topic]
  var total: Int
  var unansweredAtTimeout: Int

  /// Since the learner's previous mock; nil when it rounds to zero. A half rounds up, as main's
  /// `Math.round` does.
  var change: Int? {
    guard let current = irt?.score ?? net?.net, let previous else {
      return nil
    }

    let change = Int((current - previous + 0.5).rounded(.down))
    return change == 0 ? nil : change
  }
}

struct PointsMinimum: Hashable, Decodable, Sendable {
  enum Unit: String, Decodable, Sendable {
    case points
    case percent
  }

  var unit: Unit
  var value: Double
}

struct MockPoints: Hashable, Decodable, Sendable {
  struct Test: Hashable, Decodable, Sendable {
    var asked: Double
    var earned: Double
    var max: Double?
    /// Judged only by a full mock that asked the whole test.
    var met: Bool?
    var minimum: PointsMinimum?
    /// For a mock that asked part of the test: its estimate for the whole test.
    var projected: Double?
    var short: Double?
    /// Nil for the objective tests together.
    var name: String?
    /// It only has to reach its minimum and doesn't count toward the total.
    var qualifying: Bool
  }

  struct Unjudged: Hashable, Decodable, Sendable {
    var minimum: PointsMinimum
    var name: String?
  }

  var asked: Double
  var earned: Double
  var max: Double?
  var met: Bool?
  var minimum: PointsMinimum?
  var projected: Double?
  var short: Double?
  var parts: [Test]
  var unjudged: [Unjudged]

  /// Each test, and the tests together when they have a minimum. Misses come first, so what would
  /// eliminate the learner is read before what went fine.
  var tests: [Test] {
    let together =
      minimum == nil
      ? []
      : [
        Test(
          asked: asked, earned: earned, max: max, met: met, minimum: minimum,
          projected: projected, short: short, name: nil, qualifying: false)
      ]

    let tests = parts + together
    return tests.filter { $0.met == false } + tests.filter { $0.met != false }
  }

  var hasTests: Bool { !parts.isEmpty || minimum != nil || !unjudged.isEmpty }
}

struct NetCalibration: Hashable, Decodable, Sendable {
  struct Count: Hashable, Decodable, Sendable {
    var answered: Int
    var right: Int
  }

  enum Advice: String, Decodable, Sendable {
    case blankUnsure
    case keepAnswering
  }

  var advice: Advice?
  var blankingGain: Double
  var sure: Count
  var unsure: Count
}

struct MockEssay: Hashable, Decodable, Sendable, Identifiable {
  enum Status: String, Decodable, Sendable {
    case blank
    case graded
    case pending
  }

  var area: String?
  var grade: EssayGrade?
  var itemId: String
  var question: String
  var status: Status
  var text: String?

  var id: String { itemId }
}

struct MockReviewItem: Hashable, Decodable, Sendable, Identifiable {
  enum Outcome: String, Decodable, Sendable {
    case blank
    case partial
    case wrong
  }

  var area: String?
  var context: String?
  var correctAnswer: String?
  var explanation: String?
  var itemId: String
  var learnerAnswer: String?
  var number: Int
  var outcome: Outcome
  var question: String

  var id: String { itemId }
}

struct MockAdapt: Hashable, Decodable, Sendable {
  struct Focus: Hashable, Decodable, Sendable {
    var area: String
    var correct: Double
    var total: Int
  }

  struct Skip: Hashable, Decodable, Sendable {
    var lessons: Int
    var topics: [String]
  }

  var focus: Focus?
  var skip: Skip?
}

struct MockScoreNotes: Hashable, Decodable, Sendable {
  struct Scale: Hashable, Decodable, Sendable {
    var max: Double
    var min: Double
    var name: String?
    var passScore: Double?
    var score: Double?
  }

  var noticeScoring: String?
  var relative: Bool
  var scale: Scale?
}

struct MockLeftOut: Hashable, Decodable, Sendable {
  enum Part: String, Decodable, Sendable {
    case choice
    case listening
    case numeric
    case practical
    case shortAnswer
    case speaking
    case written
    case writtenInFull
  }

  var name: String?
  var part: Part
}

struct MockSizeSource: Hashable, Decodable, Sendable {
  enum Source: String, Decodable, Sendable {
    case even
    case notice
    case pastEdition
    case unstated
  }

  struct PastEdition: Hashable, Decodable, Sendable {
    var edition: String?
    var url: String
  }

  var formats: Source?
  var material: Bool
  var pastEdition: PastEdition?
  var questions: Source
  var subjects: Source?
  var time: Source
}

struct PassMarks: Hashable, Decodable, Sendable {
  var language: String
  var texts: [String]
}

struct MockSpeaking: Hashable, Decodable, Sendable {
  struct Task: Hashable, Decodable, Sendable, Identifiable {
    enum Status: String, Decodable, Sendable {
      case ready
      case completed
    }

    var conversationId: String
    var key: String
    var name: String
    var status: Status

    var id: String { key }
  }

  /// Never an official score.
  struct Estimate: Hashable, Decodable, Sendable {
    var complete: Bool
    var high: Double?
    var low: Double?
    var total: Double
    var typed: Bool

    var points: (low: Double, high: Double)? {
      guard complete, let low, let high else { return nil }
      return (low, high)
    }
  }

  enum PassRule: Hashable, Decodable, Sendable {
    /// A minimum shared with another paper (DELE's with listening).
    case group(min: Double, of: Double)
    case paper(min: Double)
    /// Below it the whole exam fails (DELF).
    case floor(min: Double)
    case none

    private enum CodingKeys: String, CodingKey {
      case kind, min, of
    }

    init(from decoder: any Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)

      switch try container.decode(String.self, forKey: .kind) {
      case "group":
        self = .group(
          min: try container.decode(Double.self, forKey: .min),
          of: try container.decode(Double.self, forKey: .of))
      case "paper": self = .paper(min: try container.decode(Double.self, forKey: .min))
      case "floor": self = .floor(min: try container.decode(Double.self, forKey: .min))
      default: self = .none
      }
    }
  }

  var estimate: Estimate
  var paper: String
  var pass: PassRule
  var tasks: [Task]
  var title: String
}

struct MockView: Hashable, Decodable, Sendable {
  enum Status: String, Decodable, Sendable {
    case ready
    case running
    case finished
    case expired
  }

  enum Scoring: String, Decodable, Sendable {
    case irt
    case net
    case raw
  }

  struct Mistake: Hashable, Decodable, Sendable {
    enum Cause: String, Decodable, Sendable {
      case gap
      case misread
      case trap
      case time
      case guess
    }

    var cause: Cause?
    var count: Int
  }

  var adapt: MockAdapt?
  var blockId: String
  var breakUntil: Date?
  var ceremony: Milestone?
  var current: MockCurrent?
  var essayRubric: EssayRubric?
  var essays: [MockEssay]
  var examDocument: ExamDocument
  var examName: String?
  var examQuestions: Int?
  var goalId: String?
  var leftOut: [MockLeftOut]
  var minutes: Int
  var missionMoment: DayResult.MissionMoment?
  var mistakes: [Mistake]
  var number: Int
  var passMarks: PassMarks?
  var planItemId: String?
  var purpose: MockPurpose
  var questions: Int
  var reached: DayResult.Reached?
  var result: MockResult?
  var review: [MockReviewItem]
  var scoreNotes: MockScoreNotes
  var scoring: Scoring
  var sections: [MockSection]
  var sessionId: String?
  var shape: MockShape?
  var sizeSource: MockSizeSource
  var speaking: MockSpeaking?
  var status: Status
  var trueFalseLabels: PracticeTrueFalseLabels

  var currentSection: MockSection? {
    sections.first { $0.status == .current }
  }

  var day: DayResult {
    DayResult(ceremony: ceremony, missionMoment: missionMoment, reached: reached)
  }

  var isLastSectionCurrent: Bool {
    sections.last?.status == .current
  }

  var hasPendingEssays: Bool {
    essays.contains { $0.status == .pending }
  }
}

enum ExamDocument: String, Decodable, Sendable {
  case guide
  case notice
}

struct MockOption: Hashable, Decodable, Sendable, Identifiable {
  var area: String?
  var areas: [String]
  var covers: [String]?
  var day: Int?
  var estimatedMinutes: Int
  var kind: MockShape.Kind
  var leftOut: [MockLeftOut]
  var minutes: Int
  var objectiveOnly: Bool
  var questions: Int
  var written: [String]

  var id: String { [kind.rawValue, day.map(String.init) ?? "", area ?? ""].joined(separator: ":") }

  var shape: MockShape { MockShape(area: area, day: day, kind: kind) }
}

struct PlacementMockOption: Hashable, Decodable, Sendable, Identifiable {
  enum Length: String, Codable, Sendable {
    case short
    case medium
    case long
  }

  var areas: [String]
  var coversAllAreas: Bool
  var estimatedMinutes: Int
  var length: Length
  var minutes: Int
  var questions: Int

  var id: Length { length }
}

struct ExamMockSummary: Hashable, Decodable, Sendable, Identifiable {
  var blockId: String?
  var correct: Double
  var examQuestions: Int?
  var finishedAt: Date
  var measure: Double
  var number: Int
  var purpose: MockPurpose
  var scoring: MockView.Scoring
  var shape: MockShape?
  var total: Int

  var id: Int { number }
}

struct MockOptions: Hashable, Decodable, Sendable {
  enum Access: String, Decodable, Sendable {
    case open
    case plusRequired
  }

  struct Placement: Hashable, Decodable, Sendable {
    struct Mock: Hashable, Decodable, Sendable {
      enum Status: String, Decodable, Sendable {
        case finished
        case running
      }

      var id: String
      var status: Status
    }

    var mock: Mock?
    var options: [PlacementMockOption]
    var recommended: PlacementMockOption.Length
  }

  struct Running: Hashable, Decodable, Sendable {
    var id: String
    var purpose: MockPurpose
  }

  var access: Access
  var examDocument: ExamDocument
  var examName: String
  var lastMock: ExamMockSummary?
  var options: [MockOption]
  var placement: Placement?
  var running: Running?
  var sizeSource: MockSizeSource

  var offersMock: Bool { running != nil || !options.isEmpty }
}
