import Foundation

/// A course page's example plan, as core works it out for every reader (main's
/// `CoursePlanExample`): an exam course's next sitting, and the plan at the example's time a day,
/// nil when there's no plan with study to show.
struct CoursePlanExample: Codable, Equatable, Sendable {
  /// An exam's next sitting: its days from today on, counted in the exam's own time zone, and
  /// whether they're estimated from past editions.
  struct Exam: Codable, Equatable, Sendable {
    let days: [String]
    let daysLeft: Int
    let estimated: Bool
  }

  /// The plan at one time a day.
  struct Pace: Codable, Equatable, Sendable {
    let estimate: CoursePlanEstimate
    let minutes: Int
  }

  let exam: Exam?
  let pace: Pace?

  /// An exam course's chapters by the exam's area, as its plan against the exam's day reads them
  /// (main's `getExamChapterAreas`), for a chapter's page to place it in the exam. Nil for a
  /// course read to its end, or while any of its chapters has no area: its levels place them then.
  var chapterAreas: [String: String]? {
    guard let estimate = pace?.estimate, case .byDate = estimate.reach, !estimate.chapters.isEmpty
    else {
      return nil
    }

    var areas: [String: String] = [:]

    for chapter in estimate.chapters {
      guard let area = chapter.area else {
        return nil
      }

      areas[chapter.chapterID] = area
    }

    return areas
  }
}

/// A course's plan at one time a day, as core plans it from scratch: to the course's end, or for an
/// exam course, what fits by the exam's first day (main's `CoursePlanEstimate`).
struct CoursePlanEstimate: Codable, Equatable, Sendable {
  enum Reach: Codable, Equatable, Sendable {
    /// The whole course: the weeks it takes, the day it ends and its first day's lessons.
    case toEnd(weeks: Int, endDate: String?, firstDay: [FirstDayLesson])
    /// By the exam's date: the course's lessons that fit, of all it has, by the exam's areas.
    case byDate(fittingLessons: Int, publishedLessons: Int, areas: [Area])
  }

  /// The part of a lesson the plan's first day holds.
  struct FirstDayLesson: Codable, Equatable, Identifiable, Sendable {
    let chapterID: String?
    let dayMinutes: Double
    let id: String
    let title: String
  }

  /// An exam area: how many of its lessons fit, and its planned and still-to-write time.
  struct Area: Codable, Equatable, Sendable {
    let fitting: Int
    let name: String?
    let plannedMinutes: Double
    let quickLessons: Int
    let total: Int
    let unwrittenMinutes: Double
  }

  /// A chapter's place in the plan: the week it starts and, against a date, its area, how many of
  /// its lessons fit and the order it's studied in.
  struct ChapterPlace: Codable, Equatable, Sendable {
    let area: String?
    let chapterID: String
    let endWeek: Int?
    let lessonsInPlan: Int?
    let studyOrder: Int?
    let week: Int?
    let workKinds: Set<WorkKind>
  }

  enum WorkKind: String, Codable, Sendable {
    case original
    case quick
    case unwritten
  }

  /// What fills the plan's days.
  struct Workload: Codable, Equatable, Sendable {
    let checkpointMinutes: Double
    let lessonMinutes: Double
    let practiceMinutes: Double
    let unwrittenLessonMinutes: Double
  }

  /// Whether all of it fits in depth by the date, measured by the exam's topics or the goal's.
  struct Coverage: Codable, Equatable, Sendable {
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
}
