import SwiftUI

/// The Plan's "…" options. What acts on the goal itself (rename, pause or resume, archive) lives
/// here, on its own page, so it's clear which goal changes. None of it needs a plan, so the Plan
/// keeps it while the goal is set up or its plan is built; a ready plan's own items go above.
struct GoalOptionsToolbar<PlanItems: View>: ViewModifier {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @State private var confirming: Confirmation?
  @State private var isArchiving = false
  @State private var failure: GoalStatusOutcome?
  @State private var isSaving = false
  @State private var isRenaming = false
  @State private var name = ""
  @State private var renameFailed = false

  let goal: LearnerGoal
  @ViewBuilder let planItems: PlanItems

  private enum Confirmation: Identifiable {
    case resume

    var id: Self { self }
  }

  func body(content: Content) -> some View {
    content
      .taskOptions(
        label: Text("Plan options", tableName: "Plan", comment: "Spoken label of the Plan's … menu")
      ) {
        planItems

        Section {
          statusItems
        }
        .disabled(isSaving)
      }
      .environment(\.resumeGoal, ResumeGoal(isBusy: isSaving, action: resume))
      .confirmationDialog(
        Text(
          "Resume your \(goal.displayName) goal?", tableName: "Plan",
          comment: "Asks before resuming the paused goal named here"),
        isPresented: isConfirming, titleVisibility: .visible, presenting: confirming
      ) { _ in
        Button {
          set(.active)
        } label: {
          Text("Resume", tableName: "Plan", comment: "Confirms resuming the paused goal")
        }
      } message: { _ in
        Text(
          "Your plan picks up from today, starting with the lessons planned for the days you paused.",
          tableName: "Plan", comment: "Explains how resuming the paused goal changes its plan")
      }
      .archiveGoalConfirmation(goal, isPresented: $isArchiving) {
        set(.archived)
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
            "You're following as many goals as the free plan allows. Pause another goal to resume this one, or subscribe to follow more.",
            tableName: "Plan",
            comment:
              "Explains why resuming a goal failed: the learner follows as many goals at once as the free plan allows; it's about goals followed at the same time, not new goals started per day or month. Pausing a goal keeps its progress"
          )
        } else {
          Text(
            "Check your connection and try again.", tableName: "Plan",
            comment: "Explains a failed save")
        }
      }
  }

  @ViewBuilder
  private var statusItems: some View {
    if goal.kind != .explain {
      Button {
        name = goal.displayName
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

    switch goal.status {
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
      isArchiving = true
    } label: {
      Label {
        Text("Archive this goal", tableName: "Plan", comment: "Archives the goal, after asking")
      } icon: {
        Image(systemName: "archivebox")
      }
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
      let preview = store.resumeChangesPlan(goalId: goal.id)
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
      let result = await store.rename(goalId: goal.id, displayName: displayName)
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
      let outcome = await store.setStatus(status, goalId: goal.id)
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

extension GoalOptionsToolbar where PlanItems == EmptyView {
  init(goal: LearnerGoal) {
    self.init(goal: goal) { EmptyView() }
  }
}

extension View {
  func archiveGoalConfirmation(
    _ goal: LearnerGoal, isPresented: Binding<Bool>, archive: @escaping () -> Void
  ) -> some View {
    archiveGoalConfirmation(named: goal.displayName, isPresented: isPresented, archive: archive)
  }

  /// The one archive confirm: the "…" menu's, and the Plan's and Today's question after an exam's
  /// date.
  func archiveGoalConfirmation(
    named name: String, isPresented: Binding<Bool>, archive: @escaping () -> Void
  ) -> some View {
    confirmationDialog(
      Text(
        "Archive your \(name) goal?", tableName: "Plan",
        comment: "Asks before archiving the goal named here"),
      isPresented: isPresented, titleVisibility: .visible
    ) {
      Button(role: .destructive, action: archive) {
        Text("Archive", tableName: "Plan", comment: "Confirms archiving the goal")
      }
    } message: {
      Text(
        "It leaves your goals and its plan stops. What you learned stays in your progress.",
        tableName: "Plan", comment: "Explains what archiving a goal does")
    }
  }
}

/// The menu's "Resume this goal", for a page whose main action resumes its paused goal.
struct ResumeGoal {
  var isBusy = false
  var action: () -> Void = {}
}

extension EnvironmentValues {
  @Entry var resumeGoal = ResumeGoal()
}

/// Core's `MAX_TITLE_LENGTH`, which bounds a goal's name.
private let goalNameLimit = 120
