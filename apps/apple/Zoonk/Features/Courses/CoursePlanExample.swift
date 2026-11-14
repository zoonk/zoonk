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
    case toEnd(weeks: Int, firstDay: [FirstDayLesson])
    /// The exam's subjects, in the course's order.
    case byDate(areas: [String])
  }

  struct FirstDayLesson: Codable, Equatable, Identifiable, Sendable {
    let chapterID: String?
    let dayMinutes: Double
    let id: String
    let title: String
  }

  struct ChapterPlace: Codable, Equatable, Sendable {
    let area: String?
    let chapterID: String
  }

  let reach: Reach
  let chapters: [ChapterPlace]
}
