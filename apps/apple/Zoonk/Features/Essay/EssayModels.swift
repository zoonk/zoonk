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

  /// The written test's own minimum on the sum of its questions, never this question's.
  struct PartMinimum: Hashable, Decodable, Sendable {
    var max: Double?
    var minimum: PointsMinimum

    var share: Double? {
      switch minimum.unit {
      case .percent: minimum.value / 100
      case .points: max.map { minimum.value / $0 }
      }
    }

    var points: Double? {
      switch minimum.unit {
      case .percent: max.map { minimum.value / 100 * $0 }
      case .points: minimum.value
      }
    }
  }

  var charactersPerLine: Int
  var criteria: [Criterion]
  var keySource: KeySource
  var lines: Int?
  var maxCharactersPerLine: Int
  var minimumWords: Int
  /// Nil on prompts written before it was recorded.
  var partMinimum: PartMinimum?
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

  /// Older saved answers have no `kind` or `title`.
  struct NextStep: Hashable, Decodable, Sendable {
    enum Kind: String, Decodable, Sendable {
      case criterion
      case limit
      case short
      case zero
    }

    var criterionId: String
    var example: String?
    var kind: Kind?
    var quote: String?
    var text: String
    /// The change itself, in the grader's few words.
    var title: String?
  }

  /// Why an answer was zeroed, so its next step says what to do about it.
  enum ZeroKind: String, Decodable, Sendable {
    case blank
    case copiedSupport
    case identification
    case offTopic
    case tooFewLines
    case wrongForm
  }

  struct Progress: Hashable, Decodable, Sendable {
    var fixed: [String]
    var persists: [String]
  }

  struct Row: Hashable, Decodable, Sendable, Identifiable {
    var decimals: Int?
    var earned: Double
    var id: String
    var max: Double
    var range: WritingRange?
  }

  struct Points: Hashable, Sendable {
    var content: WritingRange
    /// The scale's own decimals; nil on older answers.
    var decimals: Int?
    var deduction: WritingRange
    var max: Double
    var rows: [Row]
    var total: WritingRange
    var zeroKind: ZeroKind?
    var zeroReason: String?
  }

  var criteria: [Criterion]
  var errors: [LanguageError]
  /// The answer's handwritten lines as the server counted them.
  var estimatedLines: Int?
  var ignoredFrom: Int?
  var nextStep: NextStep?
  var progress: Progress?
  /// Nil while the rubric shows levels.
  var points: Points?

  private enum CodingKeys: String, CodingKey {
    case content, criteria, decimals, deduction, errors, estimatedLines, ignoredFrom, kind, max,
      nextStep, progress, rows, total, zeroKind, zeroReason
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    criteria = try container.decode([Criterion].self, forKey: .criteria)
    errors = try container.decode([LanguageError].self, forKey: .errors)
    estimatedLines = try container.decodeIfPresent(Int.self, forKey: .estimatedLines)
    ignoredFrom = try container.decodeIfPresent(Int.self, forKey: .ignoredFrom)
    nextStep = try container.decodeIfPresent(NextStep.self, forKey: .nextStep)
    progress = try container.decodeIfPresent(Progress.self, forKey: .progress)

    switch try container.decode(String.self, forKey: .kind) {
    case "levels":
      points = nil
    case "points":
      points = Points(
        content: try container.decode(WritingRange.self, forKey: .content),
        decimals: try container.decodeIfPresent(Int.self, forKey: .decimals),
        deduction: try container.decode(WritingRange.self, forKey: .deduction),
        max: try container.decode(Double.self, forKey: .max),
        rows: try container.decode([Row].self, forKey: .rows),
        total: try container.decode(WritingRange.self, forKey: .total),
        zeroKind: try container.decodeIfPresent(ZeroKind.self, forKey: .zeroKind),
        zeroReason: try container.decodeIfPresent(String.self, forKey: .zeroReason))
    case let kind:
      throw DecodingError.dataCorruptedError(
        forKey: .kind, in: container, debugDescription: "Unknown result kind \(kind)")
    }
  }
}

/// The one thing to work on next. "Nothing left" only when every criterion is complete and every
/// line is read; a zeroed answer's step is the rule it broke; text past the limit is the step when
/// nothing else is. A quote is kept only when it's in the text, where it's underlined. Older saved
/// answers have no `kind` or `title`, so the same rules read them (main's `getNextStep`).
enum WritingNextStep: Equatable {
  case done
  case limit
  case short
  /// `text` is the server's, used only when `zeroKind` is unknown.
  case zero(text: String, zeroKind: WritingResult.ZeroKind?)
  case criterion(title: String?, text: String, quote: String?, example: String?)

  init(grade: WritingResult, text: String) {
    let step = grade.nextStep

    if step?.kind == .zero || grade.points?.zeroReason != nil {
      self = .zero(text: step?.text ?? "", zeroKind: grade.points?.zeroKind)
    } else if step?.kind == .short {
      self = .short
    } else if step?.kind == .limit || (grade.ignoredFrom != nil && grade.isComplete) {
      self = .limit
    } else if let step {
      self = .criterion(
        title: step.title ?? grade.criteria.first { $0.id == step.criterionId }?.name,
        text: step.text,
        quote: step.quote.flatMap { text.contains($0) ? $0 : nil },
        example: step.example)
    } else if grade.isComplete {
      self = .done
    } else {
      // Graded before the grader always named one: the first criterion still short of complete.
      let criterion = grade.criteria.first { $0.level != .complete }
      self = .criterion(
        title: criterion?.name, text: criterion?.comment ?? "", quote: nil, example: nil)
    }
  }

  /// The passage to underline in the text.
  var quote: String? {
    if case .criterion(_, _, let quote, _) = self { quote } else { nil }
  }
}

extension WritingResult {
  /// With points, full marks on every row; with levels, every criterion complete.
  var isComplete: Bool {
    guard let points else {
      return criteria.allSatisfy { $0.level == .complete }
    }

    return points.zeroReason == nil
      && points.rows.allSatisfy { ($0.range?.low ?? $0.earned) >= $0.max }
  }
}

/// A saved grade with the text it was given for.
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

  /// The start the learner is writing under, saved draft or not; a rewrite's once it starts.
  var admissionId: String?
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
  /// Which question of the written test this is; nil once the notice removed it.
  var writingTask: WritingTaskName?

  var isClosed: Bool { status == .completed || status == .skipped }
}

/// How a written task is named before its question is assigned: by its line limit when no other
/// task of the test shares it, else by its place in the test.
struct WritingTaskName: Hashable, Decodable, Sendable {
  var distinctLines: Bool
  var lines: Int?
  /// 1-based, in the written test.
  var number: Int
  var points: Double?
  var total: Int
}

/// What a start answered: the grading is admitted, the question is being written, or the day's
/// extra grades are used.
enum WritingStart: Hashable, Sendable {
  /// The task a refusal leaves for tomorrow, before any question is assigned.
  struct Task: Hashable, Decodable, Sendable {
    var description: String
    var distinctLines: Bool?
    var lines: Int?
    var minutes: Int
    var number: Int?
    var points: Double?
    var total: Int?
    var unit: WritingPrompt.Unit?

    /// Its place in the written test, which names it; nil from older servers.
    var writingTask: WritingTaskName? {
      guard let distinctLines, let number, let total else { return nil }
      return WritingTaskName(
        distinctLines: distinctLines, lines: lines, number: number, points: points, total: total)
    }
  }

  case ready(admissionId: String)
  /// `unit` names what's being written, so a drill's wait says so.
  case writing(generationId: String, unit: WritingPrompt.Unit?)
  case limitReached(returnsOn: String, task: Task?)
  case signUpRequired
  /// A notice read again removed the task: nothing was admitted or written.
  case unavailable
  case failed
}
