import SwiftUI

/// A course's or a chapter's way in (main's `CourseStart`): "Build my plan", whose start screen
/// asks the learner's level first and creates nothing until they start, and "Try a lesson" beside
/// it when the page has a written lesson to try. A visitor reads that it's free (`note`).
struct CatalogStartActions: View {
  @Environment(AppRouter.self) private var router
  @Environment(SessionStore.self) private var session

  let courseID: String
  /// The chapter a chapter page starts the plan from; nil for the whole course.
  var chapterID: String?
  /// A goal of the learner's follows the course: "Continue your plan" leads back to Today.
  var continues = false
  let tryLessonID: String?
  /// What starting takes, under the buttons; nil for the visitor's "Start free, no account
  /// needed.", which nobody with a session reads.
  var note: Text?

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      ViewThatFits(in: .horizontal) {
        HStack(spacing: 8) {
          startButtons
        }

        VStack(alignment: .leading, spacing: 8) {
          startButtons
        }
      }
      .controlSize(.large)

      if let note {
        note
          .font(.footnote)
          .foregroundStyle(.secondary)
      } else if session.authenticatedSession == nil {
        Label {
          Text(
            "Start free, no account needed.",
            tableName: "Courses",
            comment: "Note under a course's start buttons for someone who isn't signed in")
        } icon: {
          Image(systemName: "play.circle")
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
      }
    }
  }

  @ViewBuilder
  private var startButtons: some View {
    if continues {
      Button {
        router.showRoot(of: .today)
      } label: {
        Text(
          "Continue your plan", tableName: "Courses",
          comment: "Takes a learner whose goal follows this course back to Today")
      }
      .buttonStyle(.mainAction)
    } else {
      Button {
        router.open(.courseStart(courseId: courseID, chapterId: chapterID))
      } label: {
        Text(
          "Build my plan", tableName: "Courses",
          comment: "Opens the start screen that builds the learner's plan from this course")
      }
      .buttonStyle(.mainAction)
    }

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

/// A course's or a chapter's "…" in the bar, with its feedback (main's `ContentFeedbackMenu`).
struct CatalogOptionsMenu: ToolbarContent {
  let label: LocalizedStringResource
  let showFeedback: () -> Void

  var body: some ToolbarContent {
    ToolbarItem(placement: .topBarTrailing) {
      Menu {
        Button(action: showFeedback) {
          Label {
            Text(
              "Send feedback",
              tableName: "Courses",
              comment: "Opens a form for sending feedback about catalog content.")
          } icon: {
            Image(systemName: "bubble.left")
          }
        }
      } label: {
        Label {
          Text(label)
        } icon: {
          Image(systemName: "ellipsis")
        }
      }
    }
  }
}
