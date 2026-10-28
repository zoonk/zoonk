import Foundation

struct CoursePlanExample: Codable, Equatable, Sendable {
  /// Days are counted in the exam's own time zone.
  struct Exam: Codable, Equatable, Sendable {
    let days: [String]
    let daysLeft: Int
    let estimated: Bool
  }

  struct Pace: Codable, Equatable, Sendable {
    let estimate: CoursePlanEstimate
    let minutes: Int
  }

  let exam: Exam?
  let pace: Pace?

  /// Nil for a course read to its end, or while any of its chapters has no area: its levels place
  /// them then.
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

struct CoursePlanEstimate: Codable, Equatable, Sendable {
  enum Reach: Codable, Equatable, Sendable {
    case toEnd(weeks: Int, endDate: String?, firstDay: [FirstDayLesson])
    case byDate(fittingLessons: Int, publishedLessons: Int, areas: [Area])
  }

  struct FirstDayLesson: Codable, Equatable, Identifiable, Sendable {
    let chapterID: String?
    let dayMinutes: Double
    let id: String
    let title: String
  }

  struct Area: Codable, Equatable, Sendable {
    let fitting: Int
    let name: String?
    let plannedMinutes: Double
    let quickLessons: Int
    let total: Int
    let unwrittenMinutes: Double
  }

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

  struct Workload: Codable, Equatable, Sendable {
    let checkpointMinutes: Double
    let lessonMinutes: Double
    let practiceMinutes: Double
    let unwrittenLessonMinutes: Double
  }

  struct Coverage: Codable, Equatable, Sendable {
    let coveredShare: Double
    let measuresGoal: Bool
  }

  let reach: Reach
  let chapters: [ChapterPlace]
  let afterDeadlineMinutes: Double?
  let beforeDeadlineMinutes: Double?
  let coverage: Coverage?
  let fromDate: String
  /// After-date work included.
  let scheduledMinutes: Double
  let unwrittenLessonMinutes: Double
  let workload: Workload

  var studyMinutes: Double {
    beforeDeadlineMinutes ?? scheduledMinutes
  }
}
