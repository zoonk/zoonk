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
  /// Main's secondary start, where the page's main action is something else (a lesson's start).
  var isSecondary = false

  @State private var switchingTo: LearnerGoal.ID?
  @State private var switchFailed = false

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

        switch await learner.switchGoal(to: switchingTo) {
        case .done where !Task.isCancelled:
          router.showRoot(of: .today)
        case .failed:
          switchFailed = true
        case .done, .obsolete:
          break
        }

        self.switchingTo = nil
      }
      .alert(
        Text(
          "We couldn't switch goals. Try again.", tableName: "Courses",
          comment: "Continuing the plan of a goal that follows this course didn't go through"),
        isPresented: $switchFailed
      ) {}

      if let note {
        note
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      } else if session.authenticatedSession == nil {
        Text(
          "Start free, no account needed.",
          tableName: "Courses",
          comment: "Note under a course's start buttons for someone who isn't signed in"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }
    }
  }

  @ViewBuilder
  private var startButtons: some View {
    if let goal {
      BusyButton(isBusy: switchingTo != nil) {
        continuePlan(goal)
      } label: {
        Text(
          "Continue your plan", tableName: "Courses",
          comment: "Takes a learner whose goal follows this course back to Today")
      }
      .buttonStyle(.mainAction)
    } else if isSecondary {
      buildPlan
        .buttonStyle(.outline)
    } else {
      buildPlan
        .buttonStyle(.mainAction)
    }

    if let tryLessonID {
      Button {
        router.open(.lesson(lessonId: tryLessonID, fromCatalog: true))
      } label: {
        Text(
          "Try a lesson", tableName: "Courses",
          comment: "Opens one of the course's lessons to try before starting a plan")
      }
      .buttonStyle(.outline)
    }
  }

  private var buildPlan: some View {
    Button {
      router.open(.courseStart(courseId: courseID, chapterId: chapterID))
    } label: {
      Text(
        "Build my plan", tableName: "Courses",
        comment: "Opens the start screen that builds the learner's plan from this course")
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
