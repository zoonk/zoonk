import Foundation

/// An exam's days as the understanding card reads them, ported from core's `exams/kept-month.ts`
/// and `exams/_utils/exam-sittings.ts`: days close together are one sitting (ENEM's two Sundays),
/// days further apart are sittings to pick from (the SAT's March and May dates). Every date is an
/// ISO calendar day ("2027-03-14"), which compares in order as text.
enum ExamSittings {
  typealias Day = Components.Schemas.OnboardingExamDate

  /// Exam days further apart than this are separate sittings.
  private static let sittingGapDays = 14

  /// The days in sittings, in date order.
  static func group(_ days: [Day]) -> [[Day]] {
    days.sorted { $0.date < $1.date }.reduce(into: [[Day]]()) { sittings, day in
      if let previous = sittings.last?.last,
        PlanDate.days(from: previous.date, to: day.date) <= sittingGapDays
      {
        sittings[sittings.count - 1].append(day)
      } else {
        sittings.append([day])
      }
    }
  }

  /// Whether the days are more than one sitting (an exam held several times a year).
  static func hasSeveral(_ days: [Day]) -> Bool {
    group(days).count > 1
  }

  /// The first day of the next `count` sittings still open for registration, from `from`.
  static func openSittings(count: Int, days: [Day], from: String) -> [Day] {
    ahead(days, from: from).filter(isOpen).prefix(count).compactMap(\.first)
  }

  /// The sitting a learner prepares for, with every day it has: an exam of one sitting has only that one; without a date of theirs, the next one open for registration, else the next; with one, the sitting in their date's month nearest to it, and none when that month has no sitting, since any other would move their exam to a month they didn't choose.
  static func learnerSitting(days: [Day], from: String, goalDate: String?) -> [Day]? {
    let ahead = ahead(days, from: from)

    if group(days).count == 1 {
      return ahead.first
    }

    guard let goalDate else {
      return ahead.first(where: isOpen) ?? ahead.first
    }

    let month = goalDate.prefix(7)

    return
      ahead
      .filter { sitting in sitting.contains { $0.date.prefix(7) == month } }
      .min { first, second in distance(first, to: goalDate) < distance(second, to: goalDate) }
  }

  /// The first day of the month the learner named for the exam ("in March 2027"), while it's after `from`.
  static func namedMonthStart(month: Int?, year: Int?, from: String) -> String? {
    guard let month, (1...12).contains(month), let year else {
      return nil
    }

    let start = String(format: "%04d-%02d-01", year, month)
    return start > from ? start : nil
  }

  /// The month the learner named when the notice puts the exam's next day in another month: the plan counts down to their month while the notice's day waits, since they may mean another sitting.
  static func keptMonthStart(month: Int?, year: Int?, noticeDay: String, today: String)
    -> String?
  {
    guard let named = namedMonthStart(month: month, year: year, from: today),
      named.prefix(7) != noticeDay.prefix(7)
    else {
      return nil
    }

    return named
  }

  /// The first upcoming day of the sitting the learner means: of their own date while it's ahead, else of the month they named, else the next one.
  static func meantDay(days: [Day], month: Int?, year: Int?, from: String, goalDate: String?)
    -> Day?
  {
    let wanted =
      goalDate.flatMap { $0 >= from ? $0 : nil }
      ?? namedMonthStart(month: month, year: year, from: from)

    return (learnerSitting(days: days, from: from, goalDate: wanted) ?? [])
      .filter { $0.date >= from }
      .min { $0.date < $1.date }
  }

  private static func ahead(_ days: [Day], from: String) -> [[Day]] {
    group(days).filter { sitting in sitting.contains { $0.date >= from } }
  }

  private static func isOpen(_ sitting: [Day]) -> Bool {
    !sitting.contains(where: \.registrationClosed)
  }

  private static func distance(_ sitting: [Day], to date: String) -> Int {
    sitting.map { abs(PlanDate.days(from: date, to: $0.date)) }.min() ?? .max
  }
}
