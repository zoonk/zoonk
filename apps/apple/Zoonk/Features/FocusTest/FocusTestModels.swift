import Foundation

/// An exam goal's Focus test as core sends it with its placement and its completion. Core owns the
/// sitting's count, its time, each subject's state and the suggested focus; the screens only say
/// them.
struct FocusTest: Decodable, Equatable, Sendable {
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
    /// "I don't know yet" answers, counted in `asked` and never graded.
    let dontKnow: Int
    let right: Int

    var id: String { key }
    var shown: String { shortName ?? name }
  }

  struct Sitting: Decodable, Equatable, Sendable {
    enum Hint: String, Decodable, Sendable {
      case manyUnknown
    }

    /// The count promised when it started: "Question 7 of 15".
    let questions: Int
    let answered: Int
    /// About how long what's left takes.
    let minutes: Int
    /// The subject the next question asks about.
    let subject: SubjectName?
    let hint: Hint?
  }

  /// What Start or Continue the test opens, said before the tap. A sitting left before its first
  /// answer is still offered as it was promised.
  struct Offer: Decodable, Equatable, Sendable {
    let minutes: Int
  }

  struct Checkpoint: Decodable, Equatable, Sendable {
    let focus: Focus?
    /// 0: subjects start from the basics for now.
    let lessonsSkipped: Int
  }

  struct Focus: Decodable, Equatable, Sendable {
    enum State: String, Decodable, Sendable {
      /// The plan isn't shown yet: saving a daily time that's short sets it.
      case ifTimeShort
      case proposed
      case current
      case handPicked
      /// The learner dismissed this suggestion with "Not now" or Undo.
      case declined
      /// The rows alone, with no claim about the plan.
      case suggested
    }

    let rows: [Row]
    let state: State
    /// For `proposed`.
    let proposal: TodayView.PlanChange?
  }

  struct Row: Decodable, Equatable, Identifiable, Sendable {
    let subject: SubjectName

    var id: String { subject.key }
  }

  let checkpoint: Checkpoint?
  let offer: Offer?
  let sessionQuestions: FocusTestSessionQuestions
  let sitting: Sitting?
  /// Every subject, in the notice's order.
  let subjects: [Subject]
  /// The goal has a date and more than one subject, so the test can suggest where to focus.
  let suggestsFocus: Bool

  /// Up to three subjects the plan should give more time, the most needed first.
  var focusRows: [Row] { checkpoint?.focus?.rows ?? [] }
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
  }

  /// `notStarted`: the first sitting; `sitting`: what's left of it; `checked`: a further one.
  let offer: Size?
  let sessionQuestions: FocusTestSessionQuestions
  let state: State
  /// As the test's own: the row says "where to focus" or "where to start".
  let suggestsFocus: Bool

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
