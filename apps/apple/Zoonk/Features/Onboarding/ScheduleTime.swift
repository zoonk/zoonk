import Foundation

/// Main's `schedule-time.ts` and `time-answer.ts`. `found` is the plan's answer for the days shown and
/// `advice` its answer for the time shown on them, which only a goal without a date asks for; either
/// is nil while it's asked for.
enum ScheduleTime {
  enum Line: Equatable {
    case asking
    case askFailed
    case findFailed
    /// A goal without a date's line: when the time picked finishes it, which its readout says.
    case finish(PlanForecast)
    case noDays
    case pastDate
    /// A dated goal's line: the time the plan suggests, whatever time is picked.
    case suggests(TimeToCover.Suggested)
    /// A dated plan with no time to suggest, or a plan with nothing left, says nothing.
    case quiet
    case working

    var isBusy: Bool { self == .asking || self == .working }
  }

  enum Wait: Equatable {
    case building
    case readingNotice
  }

  /// Main's `getPlanWait`, nil for the question. Until the plan's first answer, the onboarding view's
  /// readiness decides, so a run replayed on opening never switches screens; after it, a run that
  /// ended leaves the question to say the plan is still working the time out.
  static func wait(opened: PlanReadiness, last: PlanReadiness?, runEnded: Bool) -> Wait? {
    let readiness = last ?? opened

    if readiness.ready || (last != nil && !readiness.readingNotice && runEnded) {
      return nil
    }

    return readiness.readingNotice ? .readingNotice : .building
  }

  static let everyDay = Array(0..<7)
  /// How every list of the week reads, whatever the region's first weekday (Sunday is 0).
  static let mondayFirst = [1, 2, 3, 4, 5, 6, 0]

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

  static func studyWeek(days: [Int], minutes: Int, weekend: Int?) -> ScheduleWeek {
    ScheduleWeek(studyDays: days, weekendMinutes: weekend == minutes ? nil : weekend)
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
  /// none is coming (no date, or asking failed), so the screen's own time shows, as it does when core
  /// says the screen `startsOnRecommended` (a learner who asked for shorter days).
  static func shownMinutes(
    fallback: Int,
    startsOnRecommended: Bool,
    first: TimeToCover?,
    found: TimeToCover?,
    picked: Int?,
    settled: Bool
  ) -> Int? {
    if let picked {
      return picked
    }

    if startsOnRecommended {
      return fallback
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
  static func pickedMinutes(
    startsOnRecommended: Bool, first: TimeToCover?, found: TimeToCover?, minutes: Int
  ) -> Int? {
    !startsOnRecommended && suggestedMinutes(first) != nil && suggestedMinutes(found) == minutes
      ? nil : minutes
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

  /// The time shown is a suggestion it follows, still the one for the days before: Continue waits
  /// for the new one.
  static func waitsForSuggestion(
    startsOnRecommended: Bool, failed: Bool, first: TimeToCover?, found: TimeToCover?, picked: Int?
  ) -> Bool {
    picked == nil && !startsOnRecommended && found == nil && !failed
      && suggestedMinutes(first) != nil
  }

  /// Continue saves only a time the learner picked, or one the screen has finished working out.
  static func waitsToSave(line: Line, picked: Int?) -> Bool {
    picked == nil && line.isBusy
  }

  static func canContinue(hasDays: Bool, minutes: Int?, line: Line, picked: Int?) -> Bool {
    hasDays && minutes != nil && !waitsToSave(line: line, picked: picked)
  }

  /// While the line is worked out again, the last one stays in place, marked as updating.
  static func shownLine(last: Line, now: Line) -> (line: Line, updating: Bool) {
    let updating = now.isBusy && !last.isBusy
    return (updating ? last : now, updating)
  }

  /// The time the plan suggests, offered while a shorter time is picked.
  static func offer(line: Line, minutes: Int?) -> Int? {
    guard case .suggests(let suggested) = line, let minutes, minutes < suggested.minutes else {
      return nil
    }

    return suggested.minutes
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

    guard minutes != nil else {
      return .working
    }

    guard dated else {
      guard let advice else {
        return askFailed ? .askFailed : .asking
      }

      return advice.forecast.map { .finish($0) } ?? .quiet
    }

    if found?.pastDate == true {
      return .pastDate
    }

    guard let found else {
      return findFailed ? .findFailed : .working
    }

    return found.suggested.map { .suggests($0) } ?? .quiet
  }

  /// Only a goal without a date asks what the time picked gets it: a dated goal's line is about
  /// the suggestion.
  static func asksAboutTime(dated: Bool, minutes: Int?) -> Bool {
    !dated && minutes != nil
  }
}
