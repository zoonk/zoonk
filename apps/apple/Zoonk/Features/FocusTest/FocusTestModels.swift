import Foundation

/// An exam goal's Focus test as core sends it with its placement and its completion. Core owns the
/// sitting's count, its time, each subject's state and the suggested focus; the screens only say
/// them.
struct FocusTest: Decodable, Equatable, Sendable {
  struct Counts: Decodable, Equatable, Sendable {
    /// Subjects with at least one test answer.
    let asked: Int
    /// Subjects the test can ask about.
    let quick: Int
    /// Every subject, written and listening parts included.
    let total: Int
  }

  struct SubjectName: Decodable, Equatable, Sendable {
    let key: String
    let name: String
    let shortName: String?

    var shown: String { shortName ?? name }
  }

  /// A subject as a sentence names it.
  struct SubjectLabel: Decodable, Equatable, Sendable {
    let name: String
    let shortName: String?

    var shown: String { shortName ?? name }
  }

  enum Part: String, Decodable, Sendable {
    case written
    case listening
    case speaking
    case practical
  }

  struct Subject: Decodable, Equatable, Identifiable, Sendable {
    enum State: String, Decodable, Sendable {
      case answered
      case notAsked
      case notChecked
    }

    let key: String
    let name: String
    let shortName: String?
    let state: State
    /// Only for `notChecked`.
    let part: Part?
    let asked: Int
    let right: Int

    var id: String { key }
    var shown: String { shortName ?? name }
  }

  enum SittingKind: String, Decodable, Sendable {
    case first
    case continuation
  }

  struct Sitting: Decodable, Equatable, Sendable {
    enum End: String, Decodable, Sendable {
      case ceiling
      case settled
      case noQuestionsReady
    }

    enum Hint: String, Decodable, Sendable {
      case manyUnknown
    }

    let kind: SittingKind
    /// The count promised when it started: "Question 7 of 15".
    let questions: Int
    let answered: Int
    let left: Int
    /// About how long `left` takes.
    let minutes: Int
    /// The subject the next question asks about.
    let subject: SubjectName?
    let hint: Hint?
    /// Why it asks nothing more; nil while it goes on.
    let end: End?
  }

  struct Offer: Decodable, Equatable, Sendable {
    let kind: SittingKind
    let questions: Int
    let minutes: Int
    /// Subjects without an answer this sitting can't reach.
    let pastCeiling: Int
  }

  struct Checkpoint: Decodable, Equatable, Sendable {
    let focus: Focus?
    /// 0: subjects start from the basics for now.
    let lessonsSkipped: Int
  }

  struct Focus: Decodable, Equatable, Sendable {
    enum Basis: String, Decodable, Sendable {
      case answers
      case importance
    }

    enum State: String, Decodable, Sendable {
      /// The plan isn't shown yet: saving a daily time that's short sets it.
      case ifTimeShort
      case proposed
      case current
      case handPicked
    }

    let basis: Basis
    let rows: [Row]
    let state: State
    /// For `proposed`.
    let proposal: TodayView.PlanChange?
  }

  struct Row: Decodable, Equatable, Identifiable, Sendable {
    enum Reason: String, Decodable, Sendable {
      case answers
      case minimumScore
      case notChecked
      case notAsked
      case weight
    }

    let subject: SubjectName
    let areas: [String]
    let reason: Reason
    let part: Part?

    var id: String { subject.key }
  }

  let checkpoint: Checkpoint?
  let counts: Counts
  let dated: Bool
  let offer: Offer?
  let sessionQuestions: FocusTestSessionQuestions
  let sitting: Sitting?
  /// Every subject, in the notice's order.
  let subjects: [Subject]

  /// What Start or Continue the test opens. A sitting opened and left before its first answer is
  /// offered again with its own numbers.
  var nextSitting: NextSitting? {
    if let offer {
      return NextSitting(
        questions: offer.questions, minutes: offer.minutes, pastCeiling: offer.pastCeiling)
    }

    guard let sitting, sitting.answered == 0, sitting.left > 0 else {
      return nil
    }

    return NextSitting(questions: sitting.questions, minutes: sitting.minutes, pastCeiling: 0)
  }

  /// A sitting's size, said before the tap that opens it.
  struct NextSitting: Equatable, Sendable {
    let questions: Int
    let minutes: Int
    let pastCeiling: Int
  }
}

/// Whether sessions ask a few test questions each.
enum FocusTestSessionQuestions: String, Codable, Sendable {
  case off
  case on
  case paused
  case skippedToday
}

/// The test as the plan's row, the reveal and the switches read it.
struct FocusTestSummary: Decodable, Equatable, Sendable {
  enum State: String, Decodable, Sendable {
    case notStarted
    case sitting
    case checked
  }

  struct Size: Decodable, Equatable, Sendable {
    let minutes: Int
    let questions: Int
  }

  struct Subjects: Decodable, Equatable, Sendable {
    let asked: Int
    let total: Int
  }

  /// `notStarted`: the first sitting; `sitting`: what's left of it; `checked`: a further one.
  let offer: Size?
  let sessionQuestions: FocusTestSessionQuestions
  /// The plan's focus came from the test.
  let setsFocus: Bool
  let state: State
  let subjects: Subjects?

  /// The first sitting, for a learner who hasn't started the test: what a plan whose time is short
  /// offers.
  var notStartedOffer: Size? { state == .notStarted ? offer : nil }
}

/// The learner's switches on the test.
struct FocusTestControls: Encodable, Sendable {
  enum Suggestion: String, Encodable, Sendable {
    case dismissed
  }

  var sessionQuestions: FocusTestSessionQuestions?
  var suggestion: Suggestion?
  var timeZone = TimeZone.current.identifier
}
