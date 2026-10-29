import Foundation

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

  /// A goal's share before and after the session: progress for a goal that isn't an exam,
  /// preparation for an exam.
  struct Share: Decodable, Equatable, Sendable {
    let after: Double?
    let before: Double?
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
  let netScore: Int?
  let newCards: [NewCard]
  let preparation: Share
  let progress: Share
  let questions: Int
  let sessionId: String
  let skillsMoved: [SkillMove]
  let tomorrow: Tomorrow?
}

struct BlockMoment: Decodable, Equatable, Sendable {
  struct FullMeal: Decodable, Equatable, Sendable {
    let bonus: Int
    let paid: Bool
  }

  let blockId: String
  let brainPower: Int
  let ceremony: Milestone?
  /// `YYYY-MM-DD`.
  let comesBackOn: String?
  let completedMissions: [StudyMission.Kind]
  let correct: Int
  let fullMeal: FullMeal
  let missions: [StudyMission]
  let reached: DayResult.Reached?
  let sessionCompleted: Bool
  let total: Int

  var ownBrainPower: Int {
    Self.ownBrainPower(brainPower, bonus: fullMeal.bonus, paid: fullMeal.paid)
  }

  /// A block's Brain Power without the day's bonus it paid, which its missions show.
  static func ownBrainPower(_ brainPower: Int, bonus: Int, paid: Bool) -> Int {
    brainPower - (paid ? bonus : 0)
  }

  var day: DayResult {
    DayResult(
      ceremony: ceremony,
      missionMoment: completedMissions.isEmpty
        ? nil
        : DayResult.MissionMoment(
          completed: completedMissions,
          fullMeal: DayResult.MissionMoment.FullMeal(bonus: fullMeal.bonus, paid: fullMeal.paid),
          missions: missions),
      reached: reached)
  }
}

/// `key` is the belt color, the glasses, the stage, or `trapHunter:<boss>` for a badge.
extension Components.Schemas.StudyBlockCompletion {
  var ownBrainPower: Int {
    BlockMoment.ownBrainPower(brainPower, bonus: fullMeal.bonus, paid: fullMeal.paid)
  }
}

struct Milestone: Decodable, Equatable, Identifiable, Sendable {
  let id: String
  let key: String
  let kind: String
}

extension Milestone {
  init(_ milestone: Components.Schemas.Milestone) {
    self.init(id: milestone.id, key: milestone.key, kind: milestone.kind.rawValue)
  }
}

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
