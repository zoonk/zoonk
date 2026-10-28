import Foundation

/// The verdict on one screen as the learner sees it.
struct LessonStepResult: Hashable, Sendable {
  struct Correction: Hashable, Sendable {
    let wrong: String
    let right: String
  }

  struct KeyPoint: Hashable, Sendable {
    let text: String
    let met: Bool
  }

  var isCorrect: Bool
  var answerText: String?
  var correctAnswer: String?
  var feedback: String?
  /// False for a typed answer the server recognized without grading it.
  var checked = true
  var corrections: [Correction] = []
  var keyPoints: [KeyPoint]?
  /// Partial credit from 0 to 1 (typed and spoken answers, challenges).
  var score: Double?
  /// A typed answer right apart from a typo: the right spelling.
  var spelling: String?
  /// A recording's words to say again.
  var wordsToPractice: [String] = []
  /// When the idea comes back, once the server recorded the answer.
  var nextReviewAt: Date?
  var savedMistake = false
  /// The id a device-graded answer is saved under, so a late server reply about an earlier
  /// answer to the same screen can't change this one.
  var attemptId: String?
  /// "I don't know yet": the screen's good answer, shown without a verdict.
  var isSampleAnswer = false

  init(_ grade: LocalGrade, attemptId: String? = nil) {
    isCorrect = grade.isCorrect
    answerText = grade.answerText
    correctAnswer = grade.correctAnswer
    feedback = grade.feedback
    self.attemptId = attemptId
  }

  init(isCorrect: Bool, answerText: String?, correctAnswer: String?, feedback: String?) {
    self.isCorrect = isCorrect
    self.answerText = answerText
    self.correctAnswer = correctAnswer
    self.feedback = feedback
  }
}

extension LessonStepResult {
  /// A written screen's good answer, for "I don't know yet": it counts neither way.
  static func sampleAnswer(_ text: String) -> LessonStepResult {
    var result = LessonStepResult(
      isCorrect: false, answerText: nil, correctAnswer: nil, feedback: nil)
    result.isSampleAnswer = true
    result.correctAnswer = text
    return result
  }
}

/// Where Hyperdrive stood when the run started: the session's streak and screens that are repeats.
struct LessonHyperdriveStart: Hashable, Sendable {
  /// Screens answered right before this run: a right answer on them doesn't build Hyperdrive.
  let knownStepIds: Set<String>
  /// Right answers in a row in the session before this run, 0 outside one.
  let streak: Int

  static let none = LessonHyperdriveStart(knownStepIds: [], streak: 0)
}

/// An answer the server holds for an open run, oldest first.
struct LessonRunAnswer: Hashable, Sendable {
  let stepId: String
  let isCorrect: Bool
  let answeredAt: Date
}

/// Why a lesson can't start or continue right now.
enum LessonRunRefusal: Hashable, Sendable, Error {
  enum Tier: Hashable, Sendable {
    case guest, free, plus
  }

  enum Period: Hashable, Sendable {
    case day, month, total
  }

  case failed
  /// The plan's lessons are used up: a guest signs up, a free learner upgrades, Plus comes back later.
  case limitReached(tier: Tier, period: Period)
  case notFound
  /// A free exam plan past its first week opens this new lesson with Plus only.
  case plusRequired
  case slowDown(retryAfterSeconds: Int)
}

/// What a finished lesson earned, as the server counted it.
struct LessonCompletionSummary: Hashable, Sendable {
  let brainPower: Int
  let totalBrainPower: Double
  let correctCount: Int
  let incorrectCount: Int
  let energyDelta: Double
  let seconds: Int
  let isFirstCompletion: Bool
  let nextReviewAt: Date?
  /// The belt level this lesson took the learner to, to celebrate.
  let reachedLevel: Int?
}
