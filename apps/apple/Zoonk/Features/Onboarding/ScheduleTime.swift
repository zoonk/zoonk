import Foundation

/// Main's `schedule-time.ts` and `time-answer.ts`. `found` is the plan's answer for the days shown and
/// `advice` its answer for the time shown on them; either is nil while it's asked for.
enum ScheduleTime {
  enum Line: Equatable {
    case asking
    case askFailed
    case everything(suggested: Bool)
    case findFailed
    case finish(endDate: String)
    case focus(coveredShare: Double, everyTopic: Bool)
    case noDays
    case noFinish
    case pastDate
    case share(Double)
    case working

    var isBusy: Bool { self == .asking || self == .working }

    var coversEverything: Bool {
      if case .everything = self {
        return true
      }

      return false
    }
  }

  /// The longest time worth studying: what covers everything, or as much as any time does when part
  /// never fits.
  struct FullTime: Equatable {
    let coveredShare: Double
    let everything: Bool
    let minutes: Int
  }

  enum FullTimeNote: Equatable {
    /// What the longest useful time takes; nil when not even a whole day covers everything.
    case takes(FullTime?, moreDays: Bool)
    /// The time shown covers everything, which is more than most people keep up.
    case tooLong
  }

  struct Offer: Equatable {
    enum Kind: Equatable {
      case everything
      case focus
      case full
    }

    let kind: Kind
    let minutes: Int
  }

  struct Answer: Equatable {
    let found: TimeToCover?
    let line: Line
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

  /// The time shown is a suggestion it follows, still the one for the days before: Continue waits
  /// for the new one.
  static func waitsForSuggestion(
    failed: Bool, first: TimeToCover?, found: TimeToCover?, picked: Int?
  ) -> Bool {
    picked == nil && found == nil && !failed && suggestedMinutes(first) != nil
  }

  /// Continue saves only a time the learner picked, or one the screen has said what it covers.
  static func waitsToSave(line: Line, picked: Int?) -> Bool {
    picked == nil && line.isBusy
  }

  static func canContinue(hasDays: Bool, minutes: Int?, line: Line, picked: Int?) -> Bool {
    hasDays && minutes != nil && !waitsToSave(line: line, picked: picked)
  }

  /// While the time shown is worked out again, the last answer stays in place, marked as updating.
  static func shownAnswer(last: Answer, now: Answer) -> (answer: Answer, updating: Bool) {
    let updating = now.line.isBusy && !last.line.isBusy
    return (updating ? last : now, updating)
  }

  static func fullTime(_ found: TimeToCover?) -> FullTime? {
    if let minutes = found?.recommendedMinutes {
      return FullTime(coveredShare: 1, everything: true, minutes: minutes)
    }

    return found?.most.map {
      FullTime(coveredShare: $0.coveredShare, everything: false, minutes: $0.minutes)
    }
  }

  /// The picker marks the suggestion, and beside a focus the time that covers everything.
  static func markedTimes(_ found: TimeToCover?) -> (full: Int?, suggested: Int?) {
    (
      full: found?.suggested?.kind == .focus ? found?.recommendedMinutes : nil,
      suggested: suggestedMinutes(found)
    )
  }

  /// Beside a focus suggestion: what the longest useful time takes, or that the time shown, which
  /// covers everything, is more than most people keep up. More days bring the time down until every
  /// day is a study day, except where part never fits whatever the time.
  static func fullTimeNote(found: TimeToCover?, line: Line, studiesEveryDay: Bool) -> FullTimeNote?
  {
    guard let suggested = found?.suggested, suggested.kind == .focus else {
      return nil
    }

    if case .everything = line {
      return .tooLong
    }

    let full = fullTime(found)

    if let full, full.minutes <= suggested.minutes {
      return nil
    }

    let neverFits = full.map { !$0.everything } ?? false
    return .takes(full, moreDays: !studiesEveryDay && !neverFits)
  }

  /// The suggestion while another time is shown, unless that time covers everything anyway; on a
  /// focus suggestion, the longest useful time.
  static func offer(found: TimeToCover?, line: Line, minutes: Int?) -> Offer? {
    guard let suggested = found?.suggested else {
      return nil
    }

    if suggested.minutes != minutes {
      let covered = suggested.kind == .everything && line.coversEverything
      return covered
        ? nil
        : Offer(
          kind: suggested.kind == .everything ? .everything : .focus, minutes: suggested.minutes)
    }

    guard suggested.kind == .focus, let full = fullTime(found), full.minutes > suggested.minutes
    else {
      return nil
    }

    return Offer(kind: .full, minutes: full.minutes)
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

    if found?.pastDate == true {
      return .pastDate
    }

    if let suggested = found?.suggested, suggested.minutes == minutes {
      return suggested.kind == .everything
        ? .everything(suggested: true)
        : .focus(coveredShare: suggested.coveredShare, everyTopic: suggested.everyTopic)
    }

    // The plan's own time can say what it covers before the time question answers.
    if let advice {
      let share = advice.coveredShare ?? 0
      return share >= 1 ? .everything(suggested: false) : .share(share)
    }

    guard found != nil else {
      return findFailed ? .findFailed : .working
    }

    return askFailed ? .askFailed : .asking
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
