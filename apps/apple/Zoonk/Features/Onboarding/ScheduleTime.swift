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

  enum TooClose: Equatable {
    case date
    case days
  }

  static let everyDay = Array(0..<7)

  private static let weekdays = [1, 2, 3, 4, 5]

  /// Core's daily times, with the times shown that fall between them.
  static func dailyTimes(_ times: [Int], with shown: Int?...) -> [Int] {
    Set(times + shown.compactMap { $0 }).sorted()
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

  /// Core's split of the time shown: the question's own times carry theirs, and a suggestion between
  /// them its own, which stays the learner's pick once later weeks suggest other times.
  static func split(minutes: Int?, choices: [TimeChoice], answers: [TimeToCover]) -> DaySplit? {
    guard let minutes else {
      return nil
    }

    if let choice = choices.first(where: { $0.minutes == minutes }) {
      return choice.split
    }

    return answers.compactMap(\.suggested).first { $0.minutes == minutes }?.split
  }

  /// Why no time covers everything: only when not even a whole day does while more time would still
  /// cover more, as main says it. Nil when a time covers everything, even past the suggestion, when
  /// part never fits whatever the time, when the time shown covers it, or when the date passed. The
  /// date is to blame only once every day is a study day: until then, more days bring the time down.
  static func tooClose(found: TimeToCover?, line: Line, studiesEveryDay: Bool) -> TooClose? {
    guard let found, !found.pastDate, !line.coversEverything, found.recommendedMinutes == nil,
      found.most == nil
    else {
      return nil
    }

    return studiesEveryDay ? .date : .days
  }

  /// The time shown is a suggestion it follows, still the one for the days before: Continue waits
  /// for the new one.
  static func waitsForSuggestion(
    failed: Bool, first: TimeToCover?, found: TimeToCover?, picked: Int?
  ) -> Bool {
    picked == nil && found == nil && !failed && suggestedMinutes(first) != nil
  }

  /// Only while the time shown falls short of everything, and only a suggestion its label is true of.
  static func offer(found: TimeToCover?, line: Line, minutes: Int?) -> TimeToCover.Suggested? {
    guard let suggested = found?.suggested, suggested.minutes != minutes, !line.coversEverything,
      suggested.kind == .everything || suggested.everyTopic
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
      if suggested.kind == .everything {
        return .everything(suggested: true)
      }

      return suggested.everyTopic ? .everyTopic : .share(suggested.coveredShare)
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
