import Foundation
import OpenAPIRuntime

enum ProgressAPIError: Error, Equatable {
  case invalidResponse
  case network
  case unauthorized
}

protocol ProgressAPIClient {
  func getOverview(token: String) async throws -> ProgressOverview
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

  func getOverview(token: String) async throws -> ProgressOverview {
    try await perform(token: token) { client in
      let output = try await client.getCurrentUserProgress(.init())

      switch output {
      case .ok(let response):
        return try makeProgressOverview(try response.body.json)
      case .unauthorized:
        throw ProgressAPIError.unauthorized
      case .internalServerError, .undocumented:
        throw ProgressAPIError.invalidResponse
      }
    }
  }

  func getActivity(token: String) async throws -> ActivityProgress {
    try await perform(token: token) { client in
      let output = try await client.getCurrentUserActivity(.init())

      switch output {
      case .ok(let response):
        return try makeActivityProgress(try response.body.json)
      case .unauthorized:
        throw ProgressAPIError.unauthorized
      case .internalServerError, .undocumented:
        throw ProgressAPIError.invalidResponse
      }
    }
  }

  func getEnergy(token: String) async throws -> EnergyProgress? {
    try await perform(token: token) { client in
      let output = try await client.getCurrentUserEnergy(.init())

      switch output {
      case .ok(let response):
        return try makeEnergyProgress(try response.body.json)
      case .unauthorized:
        throw ProgressAPIError.unauthorized
      case .internalServerError, .undocumented:
        throw ProgressAPIError.invalidResponse
      }
    }
  }

  func getLevel(token: String) async throws -> LevelProgress? {
    try await perform(token: token) { client in
      let output = try await client.getCurrentUserLevel(.init())

      switch output {
      case .ok(let response):
        return try makeLevelProgress(try response.body.json)
      case .unauthorized:
        throw ProgressAPIError.unauthorized
      case .internalServerError, .undocumented:
        throw ProgressAPIError.invalidResponse
      }
    }
  }

  func getScore(token: String) async throws -> ScoreProgress? {
    try await perform(token: token) { client in
      let output = try await client.getCurrentUserScore(.init())

      switch output {
      case .ok(let response):
        return try makeScoreProgress(try response.body.json)
      case .unauthorized:
        throw ProgressAPIError.unauthorized
      case .internalServerError, .undocumented:
        throw ProgressAPIError.invalidResponse
      }
    }
  }

  func getScorePatterns(token: String) async throws -> ScorePatterns? {
    try await perform(token: token) { client in
      let output = try await client.getCurrentUserScorePatterns(.init())

      switch output {
      case .ok(let response):
        return try makeScorePatterns(try response.body.json)
      case .unauthorized:
        throw ProgressAPIError.unauthorized
      case .internalServerError, .undocumented:
        throw ProgressAPIError.invalidResponse
      }
    }
  }

  /// Keeps generated transport and decoding details behind the progress feature's stable recovery states.
  private func perform<Output: Sendable>(
    token: String,
    operation: @Sendable (Client) async throws -> Output
  ) async throws -> Output {
    do {
      return try await operation(clients.makeClient(token: token))
    } catch {
      if isRequestCancellation(error) {
        throw CancellationError()
      }

      if let error = error as? ProgressAPIError {
        throw error
      }

      if isNetworkError(error) {
        throw ProgressAPIError.network
      }

      throw ProgressAPIError.invalidResponse
    }
  }

  private func isRequestCancellation(_ error: Error) -> Bool {
    if error is CancellationError {
      return true
    }

    if let urlError = error as? URLError {
      return urlError.code == .cancelled
    }

    if let clientError = error as? ClientError {
      return isRequestCancellation(clientError.underlyingError)
    }

    return false
  }

  private func isNetworkError(_ error: Error) -> Bool {
    if error is URLError {
      return true
    }

    if let clientError = error as? ClientError {
      return isNetworkError(clientError.underlyingError)
    }

    return false
  }
}

extension ProgressAPI: ProgressAPIClient {}

private func makeProgressOverview(
  _ response: Components.Schemas.CurrentUserProgressResponse
) throws -> ProgressOverview {
  ProgressOverview(
    activity: makeOverviewActivitySummary(response.activity),
    energy: response.energy?.currentEnergy,
    level: try response.level.map(makeOverviewLevelProgress),
    score: response.score.map(makeOverviewScorePerformance),
    strongestDaypart: try makeOverviewStrongestDaypart(response.scorePatterns),
    strongestWeekday: try makeOverviewStrongestWeekday(response.scorePatterns))
}

private func makeOverviewActivitySummary(
  _ payload: Components.Schemas.CurrentUserProgressResponse.ActivityPayload
) -> ActivitySummary {
  ActivitySummary(
    learningDays: payload.learningDays,
    totalLearningSeconds: payload.totalLearningSeconds,
    totalLessonCompletions: payload.totalLessonCompletions)
}

private func makeOverviewLevelProgress(
  _ payload: Components.Schemas.CurrentUserProgressResponse.LevelPayload
) throws -> LevelProgress {
  LevelProgress(
    belt: try makeDomainValue(payload.belt),
    bpPerLevel: payload.bpPerLevel,
    bpToNextLevel: payload.bpToNextLevel,
    isMaxLevel: payload.isMaxLevel,
    level: payload.level,
    progressInLevel: payload.progressInLevel,
    totalBrainPower: payload.totalBrainPower)
}

private func makeOverviewScorePerformance(
  _ payload: Components.Schemas.CurrentUserProgressResponse.ScorePayload
) -> ScorePerformance {
  makeScorePerformance(
    .init(
      correctAnswers: payload.correctAnswers,
      incorrectAnswers: payload.incorrectAnswers,
      score: payload.score,
      totalAnswers: payload.totalAnswers))
}

private func makeOverviewStrongestDaypart(
  _ payload: Components.Schemas.CurrentUserProgressResponse.ScorePatternsPayload?
) throws -> DaypartScorePattern? {
  guard let strongestTime = payload?.strongestTime else {
    return nil
  }

  return DaypartScorePattern(
    daypart: try makeDomainValue(strongestTime.period),
    performance: makeScorePerformance(
      .init(
        correctAnswers: strongestTime.correctAnswers,
        incorrectAnswers: strongestTime.incorrectAnswers,
        score: strongestTime.score,
        totalAnswers: strongestTime.totalAnswers)))
}

private func makeOverviewStrongestWeekday(
  _ payload: Components.Schemas.CurrentUserProgressResponse.ScorePatternsPayload?
) throws -> WeekdayScorePattern? {
  guard let strongestWeekday = payload?.strongestWeekday else {
    return nil
  }

  return WeekdayScorePattern(
    performance: makeScorePerformance(
      .init(
        correctAnswers: strongestWeekday.correctAnswers,
        incorrectAnswers: strongestWeekday.incorrectAnswers,
        score: strongestWeekday.score,
        totalAnswers: strongestWeekday.totalAnswers)),
    weekday: try makeDomainValue(strongestWeekday.dayOfWeek))
}

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
    date: try makeProgressDate(payload.date),
    lessonCompletions: payload.lessonCompletions)
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

  return ScorePatterns(
    dayparts: try patterns.times.map(makeDaypartScorePattern),
    strongestDaypart: try patterns.strongestTime.map(makeStrongestDaypartScorePattern),
    strongestWeekday: try patterns.strongestWeekday.map(makeStrongestWeekdayScorePattern),
    weekdays: try patterns.weekdays.map(makeWeekdayScorePattern))
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
    throw ProgressAPIError.invalidResponse
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
    throw ProgressAPIError.invalidResponse
  }

  return destination
}
