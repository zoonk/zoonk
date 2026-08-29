import SwiftUI

enum CatalogPrimaryAction: Equatable {
  case start
  case continueLearning
  case review
}

enum CatalogCurriculumProgress: Equatable {
  case notStarted
  case inProgress(completed: Int, total: Int)
  case completed
}

func catalogPrimaryAction(
  for continuation: CatalogContinuationTarget?
) -> CatalogPrimaryAction {
  if continuation?.completed == true {
    return .review
  }

  return continuation?.hasStarted == true ? .continueLearning : .start
}

func catalogChapterProgress(
  chapter: CourseChapter,
  progress: CourseProgress?
) -> CatalogCurriculumProgress? {
  guard let progress else {
    return nil
  }

  guard let chapterProgress = progress.chapters.first(where: { $0.chapterID == chapter.id }) else {
    return .notStarted
  }

  guard chapterProgress.completedLessons > 0 else {
    return .notStarted
  }

  guard
    chapterProgress.totalLessons > 0,
    chapterProgress.completedLessons >= chapterProgress.totalLessons
  else {
    return .inProgress(
      completed: chapterProgress.completedLessons,
      total: chapterProgress.totalLessons)
  }

  return .completed
}

func catalogLessonProgress(
  lesson: CourseLesson,
  progress: ChapterProgress?
) -> CatalogCurriculumProgress? {
  guard let progress else {
    return nil
  }

  let isCompleted = progress.lessons.first(where: { $0.lessonID == lesson.id })?.isCompleted
  return isCompleted == true ? .completed : .notStarted
}

struct CatalogProgressLabel: View {
  let progress: CatalogCurriculumProgress

  var body: some View {
    Group {
      switch progress {
      case .notStarted:
        Text(
          "Not started",
          tableName: "Courses",
          comment: "Progress state for a chapter or lesson with no completed lessons.")
      case .inProgress(let completed, let total):
        HStack(spacing: 4) {
          Image(systemName: "circle.dashed")
            .accessibilityHidden(true)

          Text(
            "\(completed)/\(total) done",
            tableName: "Courses",
            comment:
              "Chapter progress. The first value is completed lessons and the second is total lessons."
          )
        }
      case .completed:
        HStack(spacing: 4) {
          Image(systemName: "checkmark.circle.fill")
            .accessibilityHidden(true)

          Text(
            "Completed",
            tableName: "Courses",
            comment: "Progress state for a completed chapter or lesson.")
        }
      }
    }
    .font(.caption.weight(.semibold))
    .foregroundStyle(tint)
    .padding(.horizontal, 8)
    .padding(.vertical, 4)
    .background(tint.opacity(0.12), in: Capsule())
  }

  private var tint: Color {
    switch progress {
    case .notStarted: Color(uiColor: .secondaryLabel)
    case .inProgress: .blue
    case .completed: .green
    }
  }
}
