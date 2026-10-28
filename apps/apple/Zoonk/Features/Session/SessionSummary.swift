import Foundation

/// What changed in a session (`GET /v1/study-sessions/{sessionId}/summary`), as the summary screen
/// draws it.
struct SessionSummary: Decodable, Equatable, Sendable {
  struct Belt: Decodable, Equatable, Sendable {
    struct Level: Decodable, Equatable, Sendable {
      let color: String
      let level: Int
    }

    let after: Level
    let colorChanged: Bool
  }

  struct ComesBack: Decodable, Equatable, Sendable {
    let date: String
    let skills: Int
  }

  struct Energy: Decodable, Equatable, Sendable {
    let after: Double
    let before: Double
  }

  struct NewCard: Decodable, Equatable, Sendable {
    let description: String
    let name: String
    let skillId: String
  }

  struct SkillMove: Decodable, Equatable, Sendable {
    let from: String
    let name: String
    let skillId: String
    let to: String
  }

  struct Tomorrow: Decodable, Equatable, Sendable {
    let title: String
  }

  let accuracy: Double?
  let belt: Belt?
  let bestStreak: Int
  let brainPower: Int
  let ceremony: Milestone?
  let comesBack: [ComesBack]
  let correct: Int
  let energy: Energy?
  let extraTime: StudyDay.ExtraTime
  let finished: Bool
  let fullMeal: Bool
  let minutes: Int
  let missions: [StudyMission]
  let mistakesSaved: Int
  let newCards: [NewCard]
  let questions: Int
  let sessionId: String
  let skillsMoved: [SkillMove]
  let tomorrow: Tomorrow?
}

/// What a block finished on the session screen earned (`StudyBlockCompletion`), as its moment
/// says it.
struct BlockMoment: Decodable, Equatable, Sendable {
  struct FullMeal: Decodable, Equatable, Sendable {
    let bonus: Int
    let paid: Bool
  }

  let blockId: String
  let brainPower: Int
  let ceremony: Milestone?
  /// The day a lesson in it comes back for review, `YYYY-MM-DD`.
  let comesBackOn: String?
  let correct: Int
  let fullMeal: FullMeal
  let sessionCompleted: Bool
  let total: Int
}

/// Something the learner earned once (`Milestone` in the API): a belt, new glasses, a buddy stage
/// or a badge. `key` is the belt color, the glasses, the stage, or `trapHunter:<boss>` for a badge.
struct Milestone: Decodable, Equatable, Identifiable, Sendable {
  let id: String
  let key: String
  let kind: String
}

extension Milestone {
  /// A milestone another feature read through the generated client, such as a practice run's.
  init(_ milestone: Components.Schemas.Milestone) {
    self.init(id: milestone.id, key: milestone.key, kind: milestone.kind.rawValue)
  }
}

/// A belt color's name, as main says it.
func beltName(_ color: String) -> String? {
  switch color {
  case "white": String(localized: "White belt", table: "Session", comment: "A belt")
  case "yellow": String(localized: "Yellow belt", table: "Session", comment: "A belt")
  case "orange": String(localized: "Orange belt", table: "Session", comment: "A belt")
  case "green": String(localized: "Green belt", table: "Session", comment: "A belt")
  case "blue": String(localized: "Blue belt", table: "Session", comment: "A belt")
  case "purple": String(localized: "Purple belt", table: "Session", comment: "A belt")
  case "brown": String(localized: "Brown belt", table: "Session", comment: "A belt")
  case "red": String(localized: "Red belt", table: "Session", comment: "A belt")
  case "gray": String(localized: "Gray belt", table: "Session", comment: "A belt")
  case "black": String(localized: "Black belt", table: "Session", comment: "A belt")
  default: nil
  }
}
