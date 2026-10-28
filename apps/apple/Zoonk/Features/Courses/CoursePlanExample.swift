import Foundation

/// A course's plan at one time a day, as core plans it from scratch: to the course's end, or for an
/// exam course, what fits by the exam's first day (main's `CoursePlanEstimate`).
struct CoursePlanEstimate: Equatable, Sendable {
  enum Reach: Equatable, Sendable {
    /// The whole course: the weeks it takes, the day it ends and its first day's lessons.
    case toEnd(weeks: Int, endDate: String?, firstDay: [FirstDayLesson])
    /// By the exam's date: the course's lessons that fit, of all it has, by the exam's areas.
    case byDate(fittingLessons: Int, publishedLessons: Int, areas: [Area])
  }

  /// The part of a lesson the plan's first day holds.
  struct FirstDayLesson: Equatable, Identifiable, Sendable {
    let chapterID: String?
    let dayMinutes: Double
    let id: String
    let title: String
  }

  /// An exam area: how many of its lessons fit, and its planned and still-to-write time.
  struct Area: Equatable, Sendable {
    let fitting: Int
    let name: String?
    let plannedMinutes: Double
    let quickLessons: Int
    let total: Int
    let unwrittenMinutes: Double
  }

  /// A chapter's place in the plan: the week it starts and, against a date, its area, how many of
  /// its lessons fit and the order it's studied in.
  struct ChapterPlace: Equatable, Sendable {
    let area: String?
    let chapterID: String
    let endWeek: Int?
    let lessonsInPlan: Int?
    let studyOrder: Int?
    let week: Int?
    let workKinds: Set<WorkKind>
  }

  enum WorkKind: String, Sendable {
    case original
    case quick
    case unwritten
  }

  /// What fills the plan's days.
  struct Workload: Equatable, Sendable {
    let checkpointMinutes: Double
    let lessonMinutes: Double
    let practiceMinutes: Double
    let unwrittenLessonMinutes: Double
  }

  /// Whether all of it fits in depth by the date, measured by the exam's topics or the goal's.
  struct Coverage: Equatable, Sendable {
    let coveredShare: Double
    let measuresGoal: Bool
  }

  let reach: Reach
  let chapters: [ChapterPlace]
  let afterDeadlineMinutes: Double?
  let beforeDeadlineMinutes: Double?
  let coverage: Coverage?
  /// The plan's first day, the estimate's today.
  let fromDate: String
  /// Everything scheduled from the first day, after-date work included.
  let scheduledMinutes: Double
  /// The course's lessons still to be written that the estimate plans.
  let unwrittenLessonMinutes: Double
  let workload: Workload

  /// The plan's study time: what an exam plan studies before its date, a course's plan to its end.
  var studyMinutes: Double {
    beforeDeadlineMinutes ?? scheduledMinutes
  }

  /// A plan with no end ("~0 weeks") or one studying nothing by the exam has nothing to show.
  var hasStudyToShow: Bool {
    switch reach {
    case .toEnd(let weeks, _, _):
      weeks > 0
    case .byDate(_, _, let areas):
      areas.reduce(0) { $0 + $1.plannedMinutes }.rounded() > 0
    }
  }
}

/// What the course page's example plan asks the estimate for, the inputs main's `course-plan.ts`
/// picks: Monday to Friday, a quarter hour a day to the course's end, or half an hour a day to an
/// exam course's next sitting.
struct CoursePlanExampleQuery: Hashable, Sendable {
  /// The planner numbers weekdays from Sunday, 0.
  static let studyDays = [1, 2, 3, 4, 5]

  let courseID: String
  let dailyMinutes: Int
  let targetDate: String?

  /// Nil when an exam's next day is today or earlier in UTC, where the estimate's calendar
  /// starts: there's no study day left to plan.
  init?(course: Course, exam: UpcomingExam?, now: Date = .now) {
    courseID = course.id
    targetDate = exam?.days.first
    dailyMinutes = targetDate == nil ? 15 : 30

    if let targetDate, targetDate <= isoDay(now, in: .gmt) {
      return nil
    }
  }
}

/// An exam course's next sitting from today on, counted in the exam's own time zone, so a night in
/// Brazil still reads as that day there.
struct UpcomingExam: Equatable, Sendable {
  let days: [String]
  let daysLeft: Int
  let estimated: Bool

  /// Nil for a course that isn't an exam's, or whose sittings are all past.
  init?(course: Course, now: Date = .now) {
    guard course.isExam, let exam = course.exam else {
      return nil
    }

    let timeZone = TimeZone(identifier: exam.timeZone) ?? .gmt
    let today = isoDay(now, in: timeZone)
    let days = exam.days.filter { $0 >= today }

    guard let first = days.first, let daysLeft = daysBetween(today, first) else {
      return nil
    }

    self.days = days
    self.daysLeft = daysLeft
    estimated = exam.estimated
  }
}

/// A date's ISO day (`2026-10-28`) in a time zone.
private func isoDay(_ date: Date, in timeZone: TimeZone) -> String {
  date.formatted(Date.ISO8601FormatStyle(timeZone: timeZone).year().month().day())
}

private func daysBetween(_ from: String, _ to: String) -> Int? {
  let style = Date.ISO8601FormatStyle(timeZone: .gmt).year().month().day()

  guard let start = try? style.parse(from), let end = try? style.parse(to) else {
    return nil
  }

  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = .gmt
  return calendar.dateComponents([.day], from: start, to: end).day
}
