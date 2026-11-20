import Foundation

struct WritingRange: Hashable, Decodable, Sendable {
  var high: Double
  var low: Double
}

/// A written question: its topic, limits and criteria. The key that grades it never travels here.
struct WritingPrompt: Hashable, Decodable, Sendable {
  enum KeySource: String, Decodable, Sendable {
    case notice
    case practiceKey
    case publishedStandard
  }

  enum Unit: String, Decodable, Sendable {
    case answer
    case drill
  }

  struct Criterion: Hashable, Decodable, Sendable, Identifiable {
    var id: String
    var name: String
    var points: Double?
  }

  var charactersPerLine: Int
  var criteria: [Criterion]
  var keySource: KeySource
  var lines: Int?
  var minimumWords: Int
  var points: Double?
  var taskKey: String
  var title: String
  var unit: Unit
}

/// How long the task takes: the notice's clock, an estimate, the learner's own pace, or practice
/// pacing where the exam shares one clock.
struct WritingPacing: Hashable, Decodable, Sendable {
  enum Source: String, Decodable, Sendable {
    case estimated
    case official
    case personal
    case practice
  }

  var minutes: Int
  var source: Source
}

/// The unsent text saved with the block, so "Continue" works on any device.
struct WritingDraft: Hashable, Codable, Sendable {
  var admissionId: String
  var revision: Int
  var text: String
}

/// A graded written answer. `levels` has no total: no numbers are ever made up for it.
struct WritingResult: Hashable, Decodable, Sendable {
  enum Level: String, Decodable, Sendable {
    case complete
    case missing
    case partial
    case strong
  }

  struct Criterion: Hashable, Decodable, Sendable, Identifiable {
    var comment: String
    var id: String
    var level: Level
    var name: String
    var quote: String?
  }

  /// `start` is in UTF-16 code units into the text as sent.
  struct LanguageError: Hashable, Decodable, Sendable {
    var correction: String
    var kind: String
    var quote: String
    var start: Int
  }

  struct NextStep: Hashable, Decodable, Sendable {
    var criterionId: String
    var example: String?
    var quote: String?
    var text: String
  }

  struct Progress: Hashable, Decodable, Sendable {
    var fixed: [String]
    var persists: [String]
  }

  struct Row: Hashable, Decodable, Sendable, Identifiable {
    var earned: Double
    var id: String
    var max: Double
    var range: WritingRange?
  }

  struct Points: Hashable, Sendable {
    var content: WritingRange
    var deduction: WritingRange
    var max: Double
    var rows: [Row]
    var total: WritingRange
    var zeroReason: String?
  }

  var criteria: [Criterion]
  var errors: [LanguageError]
  var ignoredFrom: Int?
  var nextStep: NextStep?
  var progress: Progress?
  /// Nil while the rubric shows levels.
  var points: Points?

  var nextStepCriterion: Criterion? {
    criteria.first { $0.id == nextStep?.criterionId }
  }

  private enum CodingKeys: String, CodingKey {
    case content, criteria, deduction, errors, ignoredFrom, kind, max, nextStep, progress, rows,
      total, zeroReason
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    criteria = try container.decode([Criterion].self, forKey: .criteria)
    errors = try container.decode([LanguageError].self, forKey: .errors)
    ignoredFrom = try container.decodeIfPresent(Int.self, forKey: .ignoredFrom)
    nextStep = try container.decodeIfPresent(NextStep.self, forKey: .nextStep)
    progress = try container.decodeIfPresent(Progress.self, forKey: .progress)

    switch try container.decode(String.self, forKey: .kind) {
    case "levels":
      points = nil
    case "points":
      points = Points(
        content: try container.decode(WritingRange.self, forKey: .content),
        deduction: try container.decode(WritingRange.self, forKey: .deduction),
        max: try container.decode(Double.self, forKey: .max),
        rows: try container.decode([Row].self, forKey: .rows),
        total: try container.decode(WritingRange.self, forKey: .total),
        zeroReason: try container.decodeIfPresent(String.self, forKey: .zeroReason))
    case let kind:
      throw DecodingError.dataCorruptedError(
        forKey: .kind, in: container, debugDescription: "Unknown result kind \(kind)")
    }
  }
}

/// A graded answer with its text, latest first on a block.
struct WritingAnswer: Hashable, Decodable, Sendable {
  var attemptId: String
  var grade: WritingResult
  var submittedAt: Date
  var text: String
}

/// A past answer from the written part's page.
struct WritingAttempt: Hashable, Decodable, Sendable {
  var attemptId: String
  var grade: WritingResult
  var submittedAt: Date
  var text: String
  var writing: WritingPrompt
}

/// Drafts are latest first.
struct EssayView: Hashable, Decodable, Sendable {
  enum Status: String, Decodable, Sendable {
    case active
    case completed
    case pending
    case skipped
  }

  var blockId: String
  var context: String?
  var draft: WritingDraft?
  var drafts: [WritingAnswer]
  var gradesLeft: Int
  var pacing: WritingPacing
  var question: String
  var sessionId: String
  var status: Status
  var writing: WritingPrompt

  var isClosed: Bool { status == .completed || status == .skipped }
}

/// What a start answered: the grading is admitted, the question is being written, or the day's
/// extra grades are used.
enum WritingStart: Hashable, Sendable {
  case ready(admissionId: String)
  case writing(generationId: String)
  case limitReached(returnsOn: String)
  case signUpRequired
  case failed
}
