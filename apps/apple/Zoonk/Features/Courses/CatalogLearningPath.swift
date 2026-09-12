import Foundation

/// The server owns selected chapters and progress; native views only select a browsing presentation.
struct CatalogLearningPath: Codable, Equatable, Sendable {
  let chapterIDs: [String]
  let chapterProgress: [CourseChapterProgress]
  let depth: String?
  let hasPlan: Bool
  let needsCurriculumUpdate: Bool
  let needsPlan: Bool
  let nextChapterID: String?
  let summary: String?
  var supportsLearningPlan = true

  var requiresFocusedReselection: Bool { hasPlan && needsPlan && depth == "focused" }
}

extension CourseDetail {
  var selectedChapters: [CourseChapter] {
    guard let learningPath, !learningPath.needsCurriculumUpdate else { return chapters }
    let byID = Dictionary(uniqueKeysWithValues: chapters.map { ($0.id, $0) })
    let selected = learningPath.chapterIDs.compactMap { byID[$0] }
    guard learningPath.depth != "focused" else { return selected }
    let currentLevel =
      selected.first { $0.id == learningPath.nextChapterID }?.level ?? selected.first?.level
    return selected.filter { $0.level == currentLevel }
  }

  var availableLevels: [String] {
    var seen = Set<String>()
    return chapters.compactMap(\.level).filter { seen.insert($0).inserted }
  }

  var pathProgress: CourseProgress? {
    guard let learningPath, !learningPath.needsCurriculumUpdate else { return progress }
    let totals = learningPath.chapterProgress
    let total = totals.reduce(0) { $0 + $1.totalLessons }
    let completed = totals.reduce(0) { $0 + $1.completedLessons }
    let percent =
      total > 0 && !totals.contains { $0.totalLessons == 0 }
      ? Int((Double(completed) / Double(total) * 100).rounded()) : nil
    return CourseProgress(chapters: totals, percentComplete: percent)
  }
}
