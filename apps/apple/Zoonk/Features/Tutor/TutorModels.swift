import Foundation

struct TutorTurn: Identifiable, Equatable, Sendable {
  enum Status: String, Equatable, Sendable {
    case pending
    case running
    case completed
    case failed
  }

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
  var planChange: Components.Schemas.PlanChange?
  var toolOffer: Components.Schemas.TutorToolOffer?
  /// A streamed answer links nothing until the server checked its links.
  var linksVerified = true

  var isInProgress: Bool {
    status == .pending || status == .running
  }
}

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

struct TutorAskedQuestion: Equatable, Sendable {
  let turn: TutorTurn
  let missionMoment: Components.Schemas.StudyMissionMoment?
}

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

enum TutorAnswerEvent: Equatable, Sendable {
  case text(String)
  /// Its links are checked; it replaces the streamed text.
  case savedAnswer(String)
  case planChange(Components.Schemas.PlanChange)
  /// Earlier proposals of the conversation the new one replaced.
  case planChangesReplaced([String])
  case toolOffer(Components.Schemas.TutorToolOffer)
  case memory([TutorMemoryChange])
  /// Memory changes may still follow.
  case finish
}

enum TutorFailure: Error, Equatable, Sendable {
  /// A guest's help, or the day's budget all guests share, is used up.
  case signUpRequired
  case slowDown
  case limitReached(period: Period, tier: LearnerTier)
  case plusRequired
  case gone
  case invalid
  case signedOut
  /// The thread is read again instead.
  case conflict
  case failed

  enum Period: String, Decodable, Sendable {
    case day
    case month
    case total
  }

  var isLimit: Bool {
    switch self {
    case .signUpRequired, .limitReached:
      true
    case .slowDown, .plusRequired, .gone, .invalid, .signedOut, .conflict, .failed:
      false
    }
  }
}
