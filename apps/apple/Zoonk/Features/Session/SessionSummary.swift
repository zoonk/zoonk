import Foundation

struct SessionSummary: Decodable, Equatable, Sendable {
  struct Belt: Decodable, Equatable, Sendable {
    struct Level: Decodable, Equatable, Sendable {
      let color: String
      let level: Int
    }

    let after: Level
    let colorChanged: Bool
    let stripesGained: Int
  }

  /// A goal's share before and after the session: progress for a goal that isn't an exam,
  /// preparation for an exam.
  struct Share: Decodable, Equatable, Sendable {
    let after: Double?
    let before: Double?
  }

  struct Tomorrow: Decodable, Equatable, Sendable {
    let title: String
  }

  let accuracy: Double?
  let belt: Belt?
  /// The most right answers in a row on new or due material.
  let bestStreak: Int
  let brainPower: Int
  let ceremony: Milestone?
  /// Unshown, so a moment whose completion response was lost still plays here.
  let certificates: [CertificateFacts]
  let correct: Int
  let extraTime: StudyDay.ExtraTime
  let finished: Bool
  let fullMeal: Bool
  let minutes: Int
  let missions: [StudyMission]
  let mistakesSaved: Int
  let netScore: Int?
  let preparation: Share
  let progress: Share
  let questions: Int
  /// Asked once per learner, on the day's summary (B2).
  let reminderOffer: ReminderOffer?
  let sessionId: String
  let tomorrow: Tomorrow?
}

struct BlockMoment: Decodable, Hashable, Sendable {
  struct Next: Decodable, Hashable, Sendable {
    let block: StudyBlock
    let target: StudyBlockOpeningTarget
    let opensInPlayer: Bool
  }
  let blocks: [StudyBlock]
  let dayProgress: DayProgress
  let minutes: StudyDay.Minutes
  let sessionId: String
  let goalId: String?
  let finishedChapterId: String?
  let next: Next?

  struct FullMeal: Decodable, Hashable, Sendable {
    let bonus: Int
    let paid: Bool
  }

  struct TestOutOffer: Decodable, Hashable, Sendable {
    let chapterId: String
  }

  let blockId: String
  let brainPower: Int
  let ceremony: Milestone?
  let certificates: [CertificateFacts]
  let completedMissions: [StudyMission.Kind]
  let finishedChapter: Components.Schemas.FinishedChapter?
  let fullMeal: FullMeal
  let missions: [StudyMission]
  /// The block the session goes on to; nil once it's done.
  let nextBlockId: String?
  let reached: DayResult.Reached?
  let sessionBar: SessionBar
  let sessionCompleted: Bool
  /// After a run of easy lessons in a chapter, its test, offered once.
  let testOutOffer: TestOutOffer?

  /// The line under a block end's title: without the day's bonus only where the missions' moment
  /// shows it (B2's R2).
  var ownBrainPower: Int {
    day.shownBrainPower(brainPower, bonus: fullMeal.bonus, hasChapter: finishedChapter != nil)
  }

  /// The step after this one, while the day goes on.
  var upNext: StudyBlock? {
    sessionCompleted ? nil : next?.block
  }

  /// The chapter whose test the end offers: core's offer, else the next lesson's when it starts
  /// another chapter the learner may already know.
  var testChapterID: String? {
    if let offer = testOutOffer {
      return offer.chapterId
    }

    guard let block = upNext, block.canTestOut, block.chapterId != finishedChapterId else {
      return nil
    }

    return block.chapterId
  }

  var day: DayResult {
    DayResult(
      ceremony: ceremony,
      certificates: certificates,
      missionMoment: completedMissions.isEmpty
        ? nil
        : DayResult.MissionMoment(
          completed: completedMissions,
          fullMeal: DayResult.MissionMoment.FullMeal(bonus: fullMeal.bonus, paid: fullMeal.paid),
          missions: missions),
      reached: reached)
  }
}

extension Components.Schemas.StudyBlockCompletion {
  var ownBrainPower: Int {
    (try? StudyJSON.recode(self, as: BlockMoment.self))?.ownBrainPower ?? brainPower
  }
}

/// `key` is the belt color, the glasses, the stage, or `trapHunter:<boss>` for a badge.
struct Milestone: Decodable, Hashable, Identifiable, Sendable {
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
