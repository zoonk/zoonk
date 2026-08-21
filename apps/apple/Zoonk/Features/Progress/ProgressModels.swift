import Foundation

struct ProgressOverview: Codable, Equatable, Sendable {
  let activity: ActivitySummary
  let energy: Double?
  let level: LevelProgress?
  let score: ScorePerformance?
  let strongestDaypart: DaypartScorePattern?
  let strongestWeekday: WeekdayScorePattern?

  var isEmpty: Bool {
    activity.isEmpty
      && energy == nil
      && level == nil
      && score == nil
      && strongestDaypart == nil
      && strongestWeekday == nil
  }
}

struct ActivitySummary: Codable, Equatable, Sendable {
  let learningDays: Int
  let totalLearningSeconds: Int
  let totalLessonCompletions: Int

  var isEmpty: Bool {
    learningDays == 0
      && totalLearningSeconds == 0
      && totalLessonCompletions == 0
  }
}

struct ActivityProgress: Codable, Equatable, Sendable {
  let days: [ActivityProgressDay]
  let summary: ActivitySummary

  var isEmpty: Bool {
    summary.isEmpty
  }
}

struct ActivityProgressDay: Codable, Equatable, Identifiable, Sendable {
  let date: ProgressDate
  let lessonCompletions: Int

  var id: ProgressDate { date }
}

struct EnergyProgress: Codable, Equatable, Sendable {
  let currentEnergy: Double
  let days: [EnergyProgressDay]
  let insights: EnergyInsights?
}

struct EnergyProgressDay: Codable, Equatable, Identifiable, Sendable {
  let date: ProgressDate
  let energy: Double?

  var id: ProgressDate { date }
}

struct EnergyInsights: Codable, Equatable, Sendable {
  let averageEnergy: Double
  let fullEnergyDays: Int
}

struct LevelProgress: Codable, Equatable, Sendable {
  let belt: ProgressBelt
  let bpPerLevel: Int
  let bpToNextLevel: Int
  let isMaxLevel: Bool
  let level: Int
  let progressInLevel: Int
  let totalBrainPower: Int
}

enum ProgressBelt: String, CaseIterable, Codable, Equatable, Sendable {
  case white
  case yellow
  case orange
  case green
  case blue
  case purple
  case brown
  case red
  case gray
  case black
}

struct ScorePerformance: Codable, Equatable, Sendable {
  let correctAnswers: Int
  let incorrectAnswers: Int
  let score: Double
  let totalAnswers: Int

  var hasAnswers: Bool { totalAnswers > 0 }
}

struct ScoreProgress: Codable, Equatable, Sendable {
  let dataPoints: [ScoreProgressPoint]
  let performance: ScorePerformance
  let periodEnd: ProgressDate
  let periodStart: ProgressDate
}

struct ScoreProgressPoint: Codable, Equatable, Identifiable, Sendable {
  let date: ProgressDate
  let performance: ScorePerformance

  var id: ProgressDate { date }
}

struct ScorePatterns: Codable, Equatable, Sendable {
  let dayparts: [DaypartScorePattern]
  let strongestDaypart: DaypartScorePattern?
  let strongestWeekday: WeekdayScorePattern?
  let weekdays: [WeekdayScorePattern]
}

struct DaypartScorePattern: Codable, Equatable, Identifiable, Sendable {
  let daypart: ProgressDaypart
  let performance: ScorePerformance

  var id: ProgressDaypart { daypart }
}

enum ProgressDaypart: String, CaseIterable, Codable, Equatable, Sendable {
  case night
  case morning
  case afternoon
  case evening
}

struct WeekdayScorePattern: Codable, Equatable, Identifiable, Sendable {
  let performance: ScorePerformance
  let weekday: ProgressWeekday

  var id: ProgressWeekday { weekday }
}

enum ProgressWeekday: String, CaseIterable, Codable, Equatable, Sendable {
  case sunday
  case monday
  case tuesday
  case wednesday
  case thursday
  case friday
  case saturday
}
