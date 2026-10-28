import Foundation

/// One question to the buddy and its answer, as the conversation shows it.
struct TutorTurn: Identifiable, Equatable, Sendable {
  enum Status: String, Equatable, Sendable {
    case pending
    case running
    case completed
    case failed
  }

  /// What a question was about, said above it in a panel ("About your answer").
  enum About: Equatable, Sendable {
    case answer
    case chapter
    case item
    case lesson
    case mock
    case plan
    case step
    case subject
  }

  let id: String
  let question: String
  var answer: String?
  var status: Status
  let createdAt: Date
  let about: About
  /// A plan change the answer proposed, waiting for the learner's Apply or Not now.
  var planChange: Components.Schemas.PlanChange?
  /// One of the app's tools the answer offered.
  var toolOffer: Components.Schemas.TutorToolOffer?
  /// Whether the answer's links were checked by the server: read from it, or its saved text
  /// arrived after streaming. A streamed answer links nothing until then.
  var linksVerified = true

  /// An answer still to come, which blocks a new question until it's done.
  var isInProgress: Bool {
    status == .pending || status == .running
  }
}

/// The conversation as read: its newest page, and where the earlier one continues.
struct TutorThreadPage: Equatable, Sendable {
  var turns: [TutorTurn]
  var hasMore: Bool
  var nextCursor: String?

  static let empty = TutorThreadPage(turns: [], hasMore: false, nextCursor: nil)

  func updating(_ id: String, _ change: (inout TutorTurn) -> Void) -> TutorThreadPage {
    var page = self

    if let index = page.turns.firstIndex(where: { $0.id == id }) {
      change(&page.turns[index])
    }

    return page
  }
}

/// A question just asked, and what asking did to the day's missions (nil when it completed none).
struct TutorAskedQuestion: Equatable, Sendable {
  let turn: TutorTurn
  let missionMoment: Components.Schemas.StudyMissionMoment?
}

/// What an exchange changed in the buddy's memory, to show with an undo.
struct TutorMemoryChange: Decodable, Equatable, Sendable {
  enum Action: String, Decodable, Sendable {
    case added
    case removed
    case replaced
  }

  struct Fact: Decodable, Equatable, Sendable {
    let id: String
    let statement: String
  }

  let action: Action
  let fact: Fact?
  let previous: Fact?
}

/// One event of a streamed answer (an AI SDK UI message stream).
enum TutorAnswerEvent: Equatable, Sendable {
  /// More of the answer's text.
  case text(String)
  /// The answer as saved, its links checked; it replaces the streamed text.
  case savedAnswer(String)
  case planChange(Components.Schemas.PlanChange)
  /// Earlier proposals of the conversation the new one replaced.
  case planChangesReplaced([String])
  case toolOffer(Components.Schemas.TutorToolOffer)
  case memory([TutorMemoryChange])
  /// The answer is saved: the learner can ask again. Memory changes may still follow.
  case finish
}

/// Why the buddy didn't take a question or answer it, in the terms the conversation explains.
enum TutorFailure: Error, Equatable, Sendable {
  /// A guest needs a free account first (their plan's help, or the day's budget all guests share).
  case signUpRequired
  /// Fair use asks for a short break.
  case slowDown
  /// The plan's help for the day or the month is used up.
  case limitReached(period: Period, tier: LearnerTier)
  /// A free learner needs Plus.
  case plusRequired
  /// What it was about no longer exists.
  case gone
  /// The question wasn't valid.
  case invalid
  /// The session ended.
  case signedOut
  /// The question was already asked: the thread is read again instead.
  case conflict
  /// Anything else: try again.
  case failed

  enum Period: String, Decodable, Sendable {
    case day
    case month
    case total
  }

  /// A limit stops every question until it resets, so it takes the composer's place.
  var isLimit: Bool {
    switch self {
    case .signUpRequired, .limitReached:
      true
    case .slowDown, .plusRequired, .gone, .invalid, .signedOut, .conflict, .failed:
      false
    }
  }
}
