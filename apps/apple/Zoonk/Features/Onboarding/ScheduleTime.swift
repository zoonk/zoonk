import Foundation

/// Main's `schedule-time.ts`. `found` is the plan's answer for the days shown and `advice` its answer
/// for the time shown on them; either is nil while it's asked for.
enum ScheduleTime {
  enum Line: Equatable {
    case asking
    case askFailed
    case everyTopic
    case everything(suggested: Bool)
    case findFailed
    case finish(endDate: String)
    case noDays
    case noFinish
    case pastDate
    case share(Double)
    case working
  }

  struct TooClose: Equatable {
    enum Cause: Equatable {
      case date
      case days
    }

    let cause: Cause
    let recommendedMinutes: Int?
  }

  /// The day the goals typed together share: this goal's time and the others' together.
  struct DaySplit: Equatable {
    let mine: Int
    let others: Int
    let rest: Int
  }

  static let everyDay = Array(0..<7)

  private static let weekdays = [1, 2, 3, 4, 5]

  private static let dailyTimes =
    Array(stride(from: 15, through: 240, by: 15)) + Array(stride(from: 270, through: 1440, by: 30))

  static func dailyTimes(with shown: Int?...) -> [Int] {
    Set(dailyTimes + shown.compactMap { $0 }).sorted()
  }

  /// A new goal's every-day week was never chosen, so the question opens on Monday to Friday unless
  /// someone chose fewer days.
  static func startingDays(_ goalDays: [Int]) -> [Int] {
    !goalDays.isEmpty && goalDays.count < everyDay.count ? goalDays.sorted() : weekdays
  }

  static func isWeekend(_ day: Int) -> Bool {
    day == 0 || day == 6
  }

  static func studyWeek(days: [Int], minutes: Int, weekend: Int?, fullCourse: Bool) -> ScheduleWeek
  {
    ScheduleWeek(
      studyDays: days, weekendMinutes: weekend == minutes ? nil : weekend, fullCourse: fullCourse)
  }

  /// The weekend's own time stays even when it equals the weekdays': only the weekdays' time is
  /// searched.
  static func findWeek(days: [Int], weekend: Int?) -> ScheduleWeek {
    ScheduleWeek(studyDays: days, weekendMinutes: weekend)
  }

  static func suggestedMinutes(_ found: TimeToCover?) -> Int? {
    found?.suggested?.minutes
  }

  /// Nil while the first time is still being worked out: no other time is shown in its place. The time
  /// follows the suggestion as the days change only when the screen started on one; `settled` says
  /// none is coming (no date, or asking failed), so the screen's own time shows.
  static func shownMinutes(
    fallback: Int,
    first: TimeToCover?,
    found: TimeToCover?,
    picked: Int?,
    settled: Bool
  ) -> Int? {
    if let picked {
      return picked
    }

    guard let first else {
      return settled ? fallback : nil
    }

    guard let firstSuggested = suggestedMinutes(first) else {
      return fallback
    }

    return suggestedMinutes(found) ?? firstSuggested
  }

  /// Picking the suggested time again follows the suggestion as the days change, where it's followed.
  static func pickedMinutes(first: TimeToCover?, found: TimeToCover?, minutes: Int) -> Int? {
    suggestedMinutes(first) != nil && suggestedMinutes(found) == minutes ? nil : minutes
  }

  /// Why no suggestion covers everything; nil when one does, the time shown does, or the date passed.
  /// The date is to blame only once every day is a study day: until then, more days bring the time
  /// down.
  static func tooClose(found: TimeToCover?, line: Line, studiesEveryDay: Bool) -> TooClose? {
    guard let found, !found.pastDate, !line.coversEverything,
      found.suggested?.kind != .everything
    else {
      return nil
    }

    return TooClose(
      cause: studiesEveryDay ? .date : .days, recommendedMinutes: found.recommendedMinutes)
  }

  /// The time shown is a suggestion it follows, still the one for the days before: Continue waits
  /// for the new one.
  static func waitsForSuggestion(
    failed: Bool, first: TimeToCover?, found: TimeToCover?, picked: Int?
  ) -> Bool {
    picked == nil && found == nil && !failed && suggestedMinutes(first) != nil
  }

  /// Mirrors core's `splitDailyBudget`: the main goal (`place` 0) weighs twice the others, which get
  /// whole 5-minute steps, and every goal at least 5 minutes. Nil for a goal typed alone.
  static func daySplit(minutes: Int?, count: Int, place: Int) -> DaySplit? {
    guard count > 1, let minutes else {
      return nil
    }

    let least = 5
    let step = 5
    let share = Double(minutes) / Double(2 + count - 1)
    let other = max(least, Int((share / Double(step)).rounded(.down)) * step)
    let main = max(least, minutes - other * (count - 1))
    let shares = [main] + Array(repeating: other, count: count - 1)
    let mine = shares.indices.contains(place) ? shares[place] : minutes

    return DaySplit(mine: mine, others: count - 1, rest: shares.reduce(0, +) - mine)
  }

  /// Only while the time shown falls short of everything.
  static func offer(found: TimeToCover?, line: Line, minutes: Int?) -> TimeToCover.Suggested? {
    guard let suggested = found?.suggested, suggested.minutes != minutes, !line.coversEverything
    else {
      return nil
    }

    return suggested
  }

  static func line(
    advice: TimeAdvice?,
    askFailed: Bool,
    dated: Bool,
    findFailed: Bool,
    found: TimeToCover?,
    hasDays: Bool,
    minutes: Int?
  ) -> Line {
    guard hasDays else {
      return .noDays
    }

    guard let minutes else {
      return .working
    }

    guard dated else {
      guard let advice else {
        return askFailed ? .askFailed : .asking
      }

      return advice.endDate.map { .finish(endDate: $0) } ?? .noFinish
    }

    guard let found else {
      return findFailed ? .findFailed : .working
    }

    if found.pastDate {
      return .pastDate
    }

    if let suggested = found.suggested, suggested.minutes == minutes {
      return suggested.kind == .everything ? .everything(suggested: true) : .everyTopic
    }

    guard let advice else {
      return askFailed ? .askFailed : .asking
    }

    let share = advice.coveredShare ?? 0
    return share >= 1 ? .everything(suggested: false) : .share(share)
  }

  /// The time picked needs the plan's own answer, except the one it suggested.
  static func asksAboutTime(
    dated: Bool,
    found: TimeToCover?,
    fullCourse: Bool,
    minutes: Int?
  ) -> Bool {
    guard minutes != nil else {
      return false
    }

    guard dated else {
      return true
    }

    guard let found, !found.pastDate else {
      return false
    }

    return fullCourse || found.suggested?.minutes != minutes
  }

  /// An exam's choice to study everything holds until the time picked is known to cover it all.
  static func keepsFullCourse(checked: Bool, line: Line) -> Bool {
    checked && !line.coversEverything
  }
}

extension ScheduleTime.Line {
  fileprivate var coversEverything: Bool {
    if case .everything = self {
      return true
    }

    return false
  }
}
