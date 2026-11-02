import SwiftUI

struct CatalogStartActions: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session

  let courseID: String
  /// The chapter a chapter page starts the plan from; nil for the whole course.
  var chapterID: String?
  /// The learner's goal that follows this course, which they continue instead of starting again.
  var goal: LearnerGoal?
  let tryLessonID: String?
  /// Nil shows the visitor's "Start free, no account needed."
  var note: Text?

  @State private var switchingTo: LearnerGoal.ID?

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
      .task(id: switchingTo) {
        guard let switchingTo else {
          return
        }

        if await learner.switchGoal(to: switchingTo), !Task.isCancelled {
          router.showRoot(of: .today)
        }

        self.switchingTo = nil
      }

      if let note {
        note
          .font(.footnote)
          .foregroundStyle(.secondary)
      } else if session.authenticatedSession == nil {
        Text(
          "Start free, no account needed.",
          tableName: "Courses",
          comment: "Note under a course's start buttons for someone who isn't signed in"
        )
        .font(.footnote)
        .foregroundStyle(.secondary)
      }
    }
  }

  @ViewBuilder
  private var startButtons: some View {
    if let goal {
      Button {
        continuePlan(goal)
      } label: {
        Text(
          "Continue your plan", tableName: "Courses",
          comment: "Takes a learner whose goal follows this course back to Today")
      }
      .buttonStyle(.mainAction)
      .disabled(switchingTo != nil)
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

  /// Goes where the plan is: its setup while questions are left, or Today, after making the goal the
  /// one the tabs show.
  private func continuePlan(_ goal: LearnerGoal) {
    if goal.isSettingUp {
      router.open(.goalSetup(goalId: goal.id))
    } else if learner.summary.value?.shownGoal?.id == goal.id {
      router.showRoot(of: .today)
    } else {
      switchingTo = goal.id
    }
  }
}

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
