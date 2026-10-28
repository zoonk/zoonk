import Foundation

// The mock exam as the app reads it: the generated `MockExam`, `MockOptions` and `ExamMockSummary`
// re-read into the fields the screens draw (`PracticeJSON.recode`), so the runner can change its
// drafts and plays as the learner goes.

enum MockPurpose: String, Decodable, Sendable {
  case planned
  case practice
  case placement
}

/// What a mock taken any time sits: a whole exam day, half of one, or one subject.
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

/// A running mock's answer to one question: a pick, several, true or false, a number or text
/// (`PracticeAnswer` encodes them in the API's shape). Nil leaves it blank.
struct MockDraft: Hashable, Codable, Sendable {
  var answer: PracticeAnswer?
  var durationMs: Int
  var flagged: Bool
  var itemId: String

  /// Whether it holds an answer: a pick, a number (zero too) or text the learner didn't clear.
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

/// One question of the running section. An essay (a full mock's written part) has no practice
/// format, so it's read apart; every other question is a practice question with its number.
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
  /// The practice question for every format but an essay.
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

  /// How the notice lets the learner move through it (see `MockSectionMoves`).
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

/// The section on the clock: its questions (never their answers), deadline and saved drafts.
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

  struct Topic: Hashable, Decodable, Sendable {
    var area: String?
    var correct: Int
    var name: String
    var total: Int
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
  var preparation: Preparation?
  var previous: Double?
  var topics: [Topic]
  var total: Int
  var unansweredAtTimeout: Int
}

/// How sure and unsure answers went, where a wrong answer costs points.
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

/// A full mock's essay: graded right after hand-in, by the exam's rubric.
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

/// A question of the finished mock to review: what the learner answered and the right answer.
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

/// What the finished mock offers to change in the plan, applied only once the learner says so.
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

/// Where the scale and the notice's scoring rule stand beside the mock's right answers.
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

/// A part of the real exam a mock leaves out, with why.
struct MockLeftOut: Hashable, Decodable, Sendable {
  enum Part: String, Decodable, Sendable {
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

/// What it takes to pass, in the notice's own words and language.
struct PassMarks: Hashable, Decodable, Sendable {
  var language: String
  var texts: [String]
}

/// The running mock's speaking paper: each task a live call, opened in turn.
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

  var tasks: [Task]
  var title: String
}

/// A mock exam by the id it opens by: before it starts, while it runs, and its result.
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
  var current: MockCurrent?
  var essayRubric: EssayRubric?
  var essays: [MockEssay]
  var examDocument: ExamDocument
  var examName: String?
  var examQuestions: Int?
  var goalId: String?
  var leftOut: [MockLeftOut]
  var minutes: Int
  var mistakes: [Mistake]
  var number: Int
  var passMarks: PassMarks?
  var planItemId: String?
  var purpose: MockPurpose
  var questions: Int
  var result: MockResult?
  var review: [MockReviewItem]
  var scoreNotes: MockScoreNotes
  var scoring: Scoring
  var sections: [MockSection]
  var sessionId: String?
  var shape: MockShape?
  var speaking: MockSpeaking?
  var status: Status
  var trueFalseLabels: PracticeTrueFalseLabels

  var currentSection: MockSection? {
    sections.first { $0.status == .current }
  }

  var isLastSectionCurrent: Bool {
    sections.last?.status == .current
  }

  var hasPendingEssays: Bool {
    essays.contains { $0.status == .pending }
  }
}

/// Whether the exam's own text is a notice (a public exam's) or an official guide.
enum ExamDocument: String, Decodable, Sendable {
  case guide
  case notice
}

/// One mock the learner can take whenever they want, with its honest size and time.
struct MockOption: Hashable, Decodable, Sendable, Identifiable {
  var area: String?
  var areas: [String]
  var covers: [String]?
  var day: Int?
  var estimatedMinutes: Int
  var kind: MockShape.Kind
  var minutes: Int
  var objectiveOnly: Bool
  var questions: Int
  var written: [String]

  /// One option's key among the goal's, as the chooser and a short start name it.
  var id: String { [kind.rawValue, day.map(String.init) ?? "", area ?? ""].joined(separator: ":") }

  var shape: MockShape { MockShape(area: area, day: day, kind: kind) }
}

/// A diagnostic mock's length in onboarding, with its real size and how fine a start it sets.
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

/// A finished mock in the exam's list, by the id its result opens by.
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

/// The goal's mocks to take any time, the one running, and the placement mock's lengths.
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

  /// Whether there's anything to offer: a mock running, or one to take.
  var offersMock: Bool { running != nil || !options.isEmpty }
}
