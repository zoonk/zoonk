import Foundation
import OpenAPIRuntime

protocol ProgressAPIClient {
  func getActivity(token: String) async throws -> ActivityProgress
  func getEnergy(token: String) async throws -> EnergyProgress?
  func getLevel(token: String) async throws -> LevelProgress?
  func getScore(token: String) async throws -> ScoreProgress?
  func getScorePatterns(token: String) async throws -> ScorePatterns?
}

struct ProgressAPI {
  private let clients: APIClientFactory

  init(clients: APIClientFactory) {
    self.clients = clients
  }

  func getActivity(token: String) async throws -> ActivityProgress {
    try await clients.perform(token: token) { client in
      let output = try await client.getCurrentUserActivity(.init())

      switch output {
      case .ok(let response):
        return try makeActivityProgress(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func getEnergy(token: String) async throws -> EnergyProgress? {
    try await clients.perform(token: token) { client in
      let output = try await client.getCurrentUserEnergy(.init())

      switch output {
      case .ok(let response):
        return try makeEnergyProgress(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func getLevel(token: String) async throws -> LevelProgress? {
    try await clients.perform(token: token) { client in
      let output = try await client.getCurrentUserLevel(.init())

      switch output {
      case .ok(let response):
        return try makeLevelProgress(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func getScore(token: String) async throws -> ScoreProgress? {
    try await clients.perform(token: token) { client in
      let output = try await client.getCurrentUserScore(.init())

      switch output {
      case .ok(let response):
        return try makeScoreProgress(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func getScorePatterns(token: String) async throws -> ScorePatterns? {
    try await clients.perform(token: token) { client in
      let output = try await client.getCurrentUserScorePatterns(.init())

      switch output {
      case .ok(let response):
        return try makeScorePatterns(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }
}

extension ProgressAPI: ProgressAPIClient {}

private func makeActivityProgress(
  _ response: Components.Schemas.CurrentUserActivityResponse
) throws -> ActivityProgress {
  ActivityProgress(
    days: try response.activity.days.map(makeActivityProgressDay),
    summary: ActivitySummary(
      learningDays: response.activity.learningDays,
      totalLearningSeconds: response.activity.totalLearningSeconds,
      totalLessonCompletions: response.activity.totalLessonCompletions))
}

private func makeActivityProgressDay(
  _ payload: Components.Schemas.CurrentUserActivityResponse.ActivityPayload.DaysPayloadPayload
) throws -> ActivityProgressDay {
  ActivityProgressDay(
    activitiesCompleted: payload.activitiesCompleted,
    date: try makeProgressDate(payload.date))
}

private func makeEnergyProgress(
  _ response: Components.Schemas.CurrentUserEnergyResponse
) throws -> EnergyProgress? {
  guard let energy = response.energy else {
    return nil
  }

  return EnergyProgress(
    currentEnergy: energy.currentEnergy,
    days: try energy.days.map(makeEnergyProgressDay),
    insights: energy.insights.map(makeEnergyInsights))
}

private func makeEnergyProgressDay(
  _ payload: Components.Schemas.CurrentUserEnergyResponse.EnergyPayload.DaysPayloadPayload
) throws -> EnergyProgressDay {
  EnergyProgressDay(
    date: try makeProgressDate(payload.date),
    energy: payload.energy)
}

private func makeEnergyInsights(
  _ payload: Components.Schemas.CurrentUserEnergyResponse.EnergyPayload.InsightsPayload
) -> EnergyInsights {
  EnergyInsights(
    averageEnergy: payload.averageEnergy,
    fullEnergyDays: payload.fullEnergyDays)
}

private func makeLevelProgress(
  _ response: Components.Schemas.CurrentUserLevelResponse
) throws -> LevelProgress? {
  try response.level.map(makeDetailedLevelProgress)
}

private func makeDetailedLevelProgress(
  _ payload: Components.Schemas.CurrentUserLevelResponse.LevelPayload
) throws -> LevelProgress {
  LevelProgress(
    belt: try makeDomainValue(payload.belt),
    bpPerLevel: payload.bpPerLevel,
    bpToNextLevel: payload.bpToNextLevel,
    isMaxLevel: payload.isMaxLevel,
    level: payload.level,
    nextBelt: try payload.nextBelt.map { next in
      NextBelt(
        belt: try makeDomainValue(next.belt),
        brainPowerToGo: next.brainPowerToGo,
        startBrainPower: next.startBrainPower)
    },
    progressInLevel: payload.progressInLevel,
    totalBrainPower: payload.totalBrainPower)
}

private func makeScoreProgress(
  _ response: Components.Schemas.CurrentUserScoreResponse
) throws -> ScoreProgress? {
  guard let score = response.score else {
    return nil
  }

  return ScoreProgress(
    dataPoints: try score.dataPoints.map(makeScoreProgressPoint),
    performance: makeScorePerformance(
      .init(
        correctAnswers: score.correctAnswers,
        incorrectAnswers: score.incorrectAnswers,
        score: score.score,
        totalAnswers: score.totalAnswers)),
    periodEnd: try makeProgressDate(score.periodEnd),
    periodStart: try makeProgressDate(score.periodStart))
}

private func makeScoreProgressPoint(
  _ payload: Components.Schemas.CurrentUserScoreResponse.ScorePayload.DataPointsPayloadPayload
) throws -> ScoreProgressPoint {
  ScoreProgressPoint(
    date: try makeProgressDate(payload.date),
    performance: makeScorePerformance(
      .init(
        correctAnswers: payload.correctAnswers,
        incorrectAnswers: payload.incorrectAnswers,
        score: payload.score,
        totalAnswers: payload.totalAnswers)))
}

private func makeScorePatterns(
  _ response: Components.Schemas.CurrentUserScorePatternsResponse
) throws -> ScorePatterns? {
  guard let patterns = response.patterns else {
    return nil
  }

  let strongestDaypart = try patterns.strongestTime.map(makeStrongestDaypartScorePattern)
  let strongestWeekday = try patterns.strongestWeekday.map(makeStrongestWeekdayScorePattern)

  return ScorePatterns(
    dayparts: try patterns.times.map(makeDaypartScorePattern),
    dayVerdict: makePatternVerdict(patterns.dayVerdict, strongest: strongestWeekday),
    minimumAnswers: patterns.minimumAnswers,
    strongestDaypart: strongestDaypart,
    strongestWeekday: strongestWeekday,
    timeVerdict: makePatternVerdict(patterns.timeVerdict, strongest: strongestDaypart),
    weekdays: try patterns.weekdays.map(makeWeekdayScorePattern),
    weekSpread: patterns.weekSpread.map { ScoreSpread(high: $0.high, low: $0.low) })
}

private func makePatternVerdict<Pattern>(
  _ verdict: Components.Schemas.ScorePatternVerdict, strongest: Pattern?
) -> PatternVerdict<Pattern> {
  switch (verdict.kind, strongest, verdict.points) {
  case (.best, let strongest?, _):
    .best(strongest)
  case (.even, _, let points?):
    .even(points: points)
  default:
    .notEnough
  }
}

private typealias GeneratedScorePatterns =
  Components.Schemas.CurrentUserScorePatternsResponse.PatternsPayload

private func makeDaypartScorePattern(
  _ payload: GeneratedScorePatterns.TimesPayloadPayload
) throws -> DaypartScorePattern {
  DaypartScorePattern(
    daypart: try makeDomainValue(payload.period),
    performance: makeScorePerformance(
      .init(
        correctAnswers: payload.correctAnswers,
        incorrectAnswers: payload.incorrectAnswers,
        score: payload.score,
        totalAnswers: payload.totalAnswers)))
}

private func makeStrongestDaypartScorePattern(
  _ payload: GeneratedScorePatterns.StrongestTimePayload
) throws -> DaypartScorePattern {
  DaypartScorePattern(
    daypart: try makeDomainValue(payload.period),
    performance: makeScorePerformance(
      .init(
        correctAnswers: payload.correctAnswers,
        incorrectAnswers: payload.incorrectAnswers,
        score: payload.score,
        totalAnswers: payload.totalAnswers)))
}

private func makeStrongestWeekdayScorePattern(
  _ payload: GeneratedScorePatterns.StrongestWeekdayPayload
) throws -> WeekdayScorePattern {
  WeekdayScorePattern(
    performance: makeScorePerformance(
      .init(
        correctAnswers: payload.correctAnswers,
        incorrectAnswers: payload.incorrectAnswers,
        score: payload.score,
        totalAnswers: payload.totalAnswers)),
    weekday: try makeDomainValue(payload.dayOfWeek))
}

private func makeWeekdayScorePattern(
  _ payload: GeneratedScorePatterns.WeekdaysPayloadPayload
) throws -> WeekdayScorePattern {
  WeekdayScorePattern(
    performance: makeScorePerformance(
      .init(
        correctAnswers: payload.correctAnswers,
        incorrectAnswers: payload.incorrectAnswers,
        score: payload.score,
        totalAnswers: payload.totalAnswers)),
    weekday: try makeDomainValue(payload.dayOfWeek))
}

private struct ScorePerformanceValues {
  let correctAnswers: Int
  let incorrectAnswers: Int
  let score: Double
  let totalAnswers: Int
}

private func makeScorePerformance(_ values: ScorePerformanceValues) -> ScorePerformance {
  ScorePerformance(
    correctAnswers: values.correctAnswers,
    incorrectAnswers: values.incorrectAnswers,
    score: values.score,
    totalAnswers: values.totalAnswers)
}

private func makeProgressDate(_ rawValue: String) throws -> ProgressDate {
  guard let date = ProgressDate(rawValue) else {
    throw APIError.unavailable
  }

  return date
}

private func makeDomainValue<Source, Destination>(_ source: Source) throws -> Destination
where
  Source: RawRepresentable,
  Destination: RawRepresentable,
  Source.RawValue == String,
  Destination.RawValue == String
{
  guard let destination = Destination(rawValue: source.rawValue) else {
    throw APIError.unavailable
  }

  return destination
}
