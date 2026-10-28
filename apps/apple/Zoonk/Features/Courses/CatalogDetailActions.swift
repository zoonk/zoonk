import SwiftUI

/// A course's or a chapter's way in (main's `CourseStart`): "Build my plan", whose start screen
/// asks the learner's level first and creates nothing until they start, and "Try a lesson" beside
/// it when the page has a written lesson to try. A visitor reads that it's free.
struct CatalogDetailActions: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(AppRouter.self) private var router
  @Environment(SessionStore.self) private var session

  let courseID: String
  /// The chapter a chapter page starts the plan from; nil for the whole course.
  var chapterID: String?
  let tryLessonID: String?
  let showFeedback: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        ViewThatFits(in: .horizontal) {
          HStack(spacing: 8) {
            startButtons
          }

          VStack(alignment: .leading, spacing: 8) {
            startButtons
          }
        }

        CatalogActionsMenu(showFeedback: showFeedback)
      }

      if session.authenticatedSession == nil {
        Text(
          "Start free, no account needed.",
          tableName: "Courses",
          comment: "Note under a course's start buttons for someone who isn't signed in"
        )
        .font(.footnote)
        .foregroundStyle(.secondary)
      }
    }
    .controlSize(.large)
    .padding(
      .leading,
      CatalogDetailLayout.actionLeadingInset(
        for: horizontalSizeClass,
        dynamicTypeSize: dynamicTypeSize))
  }

  @ViewBuilder
  private var startButtons: some View {
    Button {
      router.open(.courseStart(courseId: courseID, chapterId: chapterID))
    } label: {
      Text(
        "Build my plan", tableName: "Courses",
        comment: "Opens the start screen that builds the learner's plan from this course")
    }
    .buttonStyle(.mainAction)

    if let tryLessonID {
      Button {
        router.open(.lesson(lessonId: tryLessonID))
      } label: {
        Text(
          "Try a lesson", tableName: "Courses",
          comment: "Opens one of the course's lessons to try before starting a plan")
      }
      .buttonStyle(.bordered)
    }
  }
}
