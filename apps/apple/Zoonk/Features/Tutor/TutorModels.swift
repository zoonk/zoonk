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

  /// The lesson screen a question is about: its id, or its number once it was deleted.
  enum Step: Equatable, Sendable {
    case id(String)
    case number(Int)

    init(id: String?, number: Int) {
      self = id.map(Step.id) ?? .number(number)
    }
  }

  let id: String
  let question: String
  var answer: String?
  var status: Status
  let createdAt: Date
  let about: About
  /// Nil when the question isn't about one lesson screen.
  var step: Step?
  var planChange: Components.Schemas.PlanChange?
  var toolOffer: Components.Schemas.TutorToolOffer?
  /// A streamed answer links nothing until the server checked its links.
  var linksVerified = true

  var isInProgress: Bool {
    status == .pending || status == .running
  }

  /// Mirrors main's `isSameTopic`: "About …" shows where the topic changes, to another part of the
  /// lesson or to the answer once it's checked.
  func sharesTopic(with previous: TutorTurn?) -> Bool {
    previous.map { $0.about == about && $0.step == step } ?? false
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
  /// A short break, over at `until`.
  case slowDown(until: Date)
  case limit(HelpLimit)
  case plusRequired
  case gone
  case invalid
  case signedOut
  /// The thread is read again instead.
  case conflict
  case failed

  /// Nothing can be asked while it holds: the composer keeps the learner's words, and its notice
  /// says why.
  var isLimit: Bool {
    switch self {
    case .signUpRequired, .slowDown, .limit:
      true
    case .plusRequired, .gone, .invalid, .signedOut, .conflict, .failed:
      false
    }
  }

  /// When asking is back without the server saying so: a short break's end, or a monthly cap's
  /// day.
  var liftsAt: Date? {
    switch self {
    case .slowDown(let until): until
    case .limit(let limit): limit.availableAt
    default: nil
    }
  }

  func isLifted(at now: Date) -> Bool {
    liftsAt.map { $0 <= now } ?? false
  }
}
