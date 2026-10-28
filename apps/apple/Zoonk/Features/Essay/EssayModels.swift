import Foundation

enum EssayRubric: String, Decodable, Sendable {
  case ap
  case custom
  case enem
  case oab
}

struct EssayGrade: Hashable, Decodable, Sendable {
  struct Criterion: Hashable, Decodable, Sendable, Identifiable {
    var comment: String
    var example: String?
    var id: String
    var maxScore: Double
    var name: String
    var quote: String?
    var score: Double
  }

  struct InterventionElements: Hashable, Decodable, Sendable {
    var action: Bool
    var agent: Bool
    var detail: Bool
    var effect: Bool
    var means: Bool
  }

  struct NextStep: Hashable, Decodable, Sendable {
    var criterionId: String
    var text: String
  }

  struct Range: Hashable, Decodable, Sendable {
    var high: Double
    var low: Double
  }

  struct Total: Hashable, Decodable, Sendable {
    var maxScore: Double
    var score: Double
  }

  enum ZeroReason: String, Decodable, Sendable {
    case notArgumentative
    case offTopic
    case tooShort
  }

  var criteria: [Criterion]
  var enemInterventionElements: InterventionElements?
  var nextStep: NextStep?
  var range: Range
  var total: Total
  var zeroReason: ZeroReason?

  var nextStepCriterion: Criterion? {
    criteria.first { $0.id == nextStep?.criterionId }
  }
}

/// Drafts are latest first.
struct EssayView: Hashable, Decodable, Sendable {
  struct Draft: Hashable, Decodable, Sendable {
    var grade: EssayGrade
    var submittedAt: Date
    var text: String
  }

  enum Status: String, Decodable, Sendable {
    case active
    case completed
    case pending
    case skipped
  }

  var blockId: String
  var context: String?
  var drafts: [Draft]
  var gradesLeft: Int
  var question: String
  var rubric: EssayRubric
  var sessionId: String
  var status: Status
}
