import SwiftUI

/// The Plan's toolbar: "Adjust plan" and the "…" options. What acts on the goal itself (pause or
/// resume, archive) lives here, on its own page, so it's clear which goal changes.
struct PlanToolbar: ViewModifier {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @Environment(LearnerSummaryStore.self) private var learner
  @State private var confirming: Confirmation?
  @State private var failure: GoalStatusOutcome?
  @State private var isSaving = false
  @State private var isRenaming = false
  @State private var name = ""
  @State private var renameFailed = false

  let context: PlanContext

  private enum Confirmation: Identifiable {
    case archive
    case resume

    var id: Self { self }
  }

  func body(content: Content) -> some View {
    content
      .taskAction {
        Button {
          context.adjust(.top)
        } label: {
          Label {
            Text(
              "Adjust plan", tableName: "Plan", comment: "Opens the plan's settings to change them")
          } icon: {
            Image(systemName: "slider.horizontal.3")
          }
        }
      }
      .taskOptions(
        label: Text("Plan options", tableName: "Plan", comment: "Spoken label of the Plan's … menu")
      ) {
        options
      }
      .confirmationDialog(
        confirmationTitle, isPresented: isConfirming, titleVisibility: .visible,
        presenting: confirming
      ) { confirmation in
        switch confirmation {
        case .archive:
          Button(role: .destructive) {
            set(.archived)
          } label: {
            Text("Archive", tableName: "Plan", comment: "Confirms archiving the goal")
          }
        case .resume:
          Button {
            set(.active)
          } label: {
            Text("Resume", tableName: "Plan", comment: "Confirms resuming the paused goal")
          }
        }
      } message: { confirmation in
        switch confirmation {
        case .archive:
          Text(
            "It leaves your goals and its plan stops. What you learned stays in your progress.",
            tableName: "Plan", comment: "Explains what archiving a goal does")
        case .resume:
          Text(
            "Your plan picks up from today, starting with the lessons planned for the days you paused.",
            tableName: "Plan", comment: "Explains how resuming the paused goal changes its plan")
        }
      }
      .alert(
        Text(
          "Rename goal", tableName: "Plan", comment: "Title of the dialog that renames the goal"),
        isPresented: $isRenaming
      ) {
        TextField(text: $name) {
          Text("Name", tableName: "Plan", comment: "Field holding the goal's name")
        }
        .onChange(of: name) { _, value in
          name = String(value.prefix(goalNameLimit))
        }

        Button(role: .cancel) {}

        Button(role: .confirm) {
          rename()
        } label: {
          Text("Save", tableName: "Plan", comment: "Saves the goal's new name")
        }
        .disabled(trimmedName.isEmpty)
      } message: {
        if renameFailed {
          Text(
            "Check your connection and try again.", tableName: "Plan",
            comment: "Explains a failed save")
        } else {
          Text(
            "Choose a name you recognize. Your study plan stays the same.", tableName: "Plan",
            comment: "Explains that renaming a goal changes only its name")
        }
      }
      .alert(
        Text("Couldn't save", tableName: "Plan", comment: "Title of an error saving the goal"),
        isPresented: hasFailed, presenting: failure
      ) { _ in
      } message: { outcome in
        if outcome == .limitReached {
          Text(
            "The free plan follows one goal at a time. Pause your other goal to resume this one, or get Plus for more.",
            tableName: "Plan", comment: "Explains why resuming a goal failed on the free plan")
        } else {
          Text(
            "Check your connection and try again.", tableName: "Plan",
            comment: "Explains a failed save")
        }
      }
  }

  @ViewBuilder
  private var options: some View {
    Section {
      if context.goal.kind == .exam {
        Button {
          router.open(.exam)
        } label: {
          Label {
            Text("About the exam", tableName: "Plan", comment: "Opens the exam's page")
          } icon: {
            Image(systemName: "graduationcap")
          }
        }
      }

      if let course = context.plan.libraryCourse {
        Button {
          router.open(.course(courseId: course.courseId, title: course.title))
        } label: {
          Label {
            Text(
              "See the full course", tableName: "Plan",
              comment: "Opens the Library course the plan is built from")
          } icon: {
            Image(systemName: "books.vertical")
          }
        }
      }
    }

    ShareLink(item: shareURL) {
      Label {
        Text("Share the plan", tableName: "Plan", comment: "Shares a link to the plan")
      } icon: {
        Image(systemName: "square.and.arrow.up")
      }
    }

    Button {
      router.select(.buddy)
    } label: {
      Label {
        Text(
          "Talk to \(learner.buddyDisplayName)", tableName: "Plan",
          comment: "Opens the buddy's conversation, where questions about the plan go")
      } icon: {
        Image(systemName: "questionmark.bubble")
      }
    }

    Button {
      context.report()
    } label: {
      Label {
        Text(
          "Report a problem", tableName: "Plan", comment: "Opens the feedback form about the plan"
        )
      } icon: {
        Image(systemName: "flag")
      }
    }

    Section {
      statusItems
    }
    .disabled(isSaving)
  }

  @ViewBuilder
  private var statusItems: some View {
    if context.goal.kind != .explain {
      Button {
        name = context.goal.displayName
        renameFailed = false
        isRenaming = true
      } label: {
        Label {
          Text("Rename goal", tableName: "Plan", comment: "Opens the dialog that renames the goal")
        } icon: {
          Image(systemName: "pencil")
        }
      }
    }

    switch context.goal.status {
    case .active:
      Button {
        set(.paused)
      } label: {
        Label {
          Text("Pause this goal", tableName: "Plan", comment: "Pauses the goal")
        } icon: {
          Image(systemName: "pause")
        }
      }
    case .paused:
      Button {
        resume()
      } label: {
        Label {
          Text("Resume this goal", tableName: "Plan", comment: "Resumes the paused goal")
        } icon: {
          Image(systemName: "play")
        }
      }
    case .archived, .completed:
      EmptyView()
    }

    Button(role: .destructive) {
      confirming = .archive
    } label: {
      Label {
        Text("Archive this goal", tableName: "Plan", comment: "Archives the goal, after asking")
      } icon: {
        Image(systemName: "archivebox")
      }
    }
  }

  private var shareURL: URL {
    URL(string: "https://www.zoonk.com/plan-link/\(context.plan.planId)")!
  }

  private var confirmationTitle: Text {
    switch confirming {
    case .resume:
      Text(
        "Resume your \(context.goal.displayName) goal?", tableName: "Plan",
        comment: "Asks before resuming the paused goal named here")
    default:
      Text(
        "Archive your \(context.goal.displayName) goal?", tableName: "Plan",
        comment: "Asks before archiving the goal named here")
    }
  }

  private var trimmedName: String {
    name.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private var isConfirming: Binding<Bool> {
    Binding(get: { confirming != nil }, set: { if !$0 { confirming = nil } })
  }

  private var hasFailed: Binding<Bool> {
    Binding(get: { failure != nil }, set: { if !$0 { failure = nil } })
  }

  /// Resuming asks first only when it changes the plan (the pause left lessons behind).
  private func resume() {
    Task {
      isSaving = true
      let preview = store.resumeChangesPlan(goalId: context.goal.id)
      await preview.load()
      isSaving = false

      if preview.value == true {
        confirming = .resume
      } else {
        set(.active)
      }
    }
  }

  private func rename() {
    let displayName = trimmedName

    guard !displayName.isEmpty else {
      return
    }

    Task {
      isSaving = true
      let result = await store.rename(goalId: context.goal.id, displayName: displayName)
      isSaving = false

      switch result {
      case .done(true), .obsolete:
        break
      case .done(false), .failed:
        renameFailed = true
        isRenaming = true
      }
    }
  }

  private func set(_ status: GoalStatusChange) {
    Task {
      isSaving = true
      let outcome = await store.setStatus(status, goalId: context.goal.id)
      isSaving = false

      switch outcome {
      case .done(.saved):
        if status == .archived {
          router.showRoot(of: .today)
        }
      case .done(let refused):
        failure = refused
      case .failed:
        failure = .failed
      case .obsolete:
        break
      }
    }
  }
}

/// Core's `MAX_TITLE_LENGTH`, which bounds a goal's name.
private let goalNameLimit = 120
