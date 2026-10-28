import Foundation

struct ActivitySummary: Codable, Equatable, Sendable {
  let learningDays: Int
  let totalLearningSeconds: Int
  let totalLessonCompletions: Int
}

/// Every learning day counts (a day of only reviews or practice too); the calendar is the past
/// 12 months, Sunday first, zero-filled up to today.
struct ActivityProgress: Codable, Equatable, Sendable {
  let days: [ActivityProgressDay]
  let summary: ActivitySummary
}

/// One calendar day lit by everything finished that day (lessons, reviews and practice), so the
/// calendar shows the same days that count as learning days.
struct ActivityProgressDay: Codable, Equatable, Identifiable, Sendable {
  let activitiesCompleted: Int
  let date: ProgressDate

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
  /// The belt after this one and the Brain Power it takes; nil on Black, the last belt.
  let nextBelt: NextBelt?
  let progressInLevel: Int
  let totalBrainPower: Int
}

struct NextBelt: Codable, Equatable, Sendable {
  let belt: ProgressBelt
  let brainPowerToGo: Int
  let startBrainPower: Int
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
