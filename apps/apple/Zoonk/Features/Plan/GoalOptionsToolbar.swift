import SwiftUI

/// The Plan's "…" options. What acts on the goal itself (rename, pause or resume, archive) lives
/// here, on its own page, so it's clear which goal changes. None of it needs a plan, so the Plan
/// keeps it while the goal is set up or its plan is built; a ready plan's own items go above. A
/// ready plan's header holds them beside its title as main's does, so the bar keeps the goal's
/// name, the level and the account.
struct GoalOptionsToolbar<PlanItems: View>: ViewModifier {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @State private var changes = GoalChanges()
  @State private var isArchiving = false
  @State private var name = ""

  let goal: LearnerGoal
  var inPageHeader = false
  @ViewBuilder let planItems: PlanItems

  func body(content: Content) -> some View {
    content
      .taskOptions(isShown: !inPageHeader, label: label) { items }
      .environment(\.planOptions, inPageHeader ? AnyView(headerMenu) : nil)
      .environment(
        \.resumeGoal,
        ResumeGoal(isBusy: changes.isSaving, failure: changes.resumeFailure, action: resume)
      )
      .confirmationDialog(
        Text(
          "Resume your \(goal.displayName) goal?", tableName: "Plan",
          comment: "Asks before resuming the paused goal named here"),
        isPresented: Bindable(changes).confirmsResume, titleVisibility: .visible
      ) {
        Button {
          set(.active)
        } label: {
          Text("Resume", tableName: "Plan", comment: "Confirms resuming the paused goal")
        }
      } message: {
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
        isPresented: Bindable(changes).isRenaming
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
        if changes.renameFailed {
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
        isPresented: hasFailed, presenting: changes.failure
      ) { _ in
      } message: { _ in
        Text(
          "Check your connection and try again.", tableName: "Plan",
          comment: "Explains a failed save")
      }
      .onDisappear { changes.leave() }
  }

  private var label: Text {
    Text("Plan options", tableName: "Plan", comment: "Spoken label of the Plan's … menu")
  }

  @ViewBuilder
  private var items: some View {
    planItems

    Section {
      statusItems
    }
    .disabled(changes.isSaving)
  }

  /// Main's phone header: a quiet icon button after "Adjust plan".
  private var headerMenu: some View {
    Menu {
      items
    } label: {
      Label {
        label
      } icon: {
        Image(systemName: "ellipsis")
      }
      .labelStyle(.iconOnly)
    }
    .buttonStyle(.ghost.icon)
    .controlSize(.small)
  }

  @ViewBuilder
  private var statusItems: some View {
    if goal.kind != .explain {
      Button {
        name = goal.displayName
        changes.startRenaming()
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

  private var hasFailed: Binding<Bool> {
    Binding(get: { changes.failure != nil }, set: { if !$0 { changes.failure = nil } })
  }

  private func resume() {
    changes.resume(goalId: goal.id, store: store, router: router)
  }

  private func rename() {
    let displayName = trimmedName

    guard !displayName.isEmpty else {
      return
    }

    changes.rename(displayName, goalId: goal.id, store: store)
  }

  private func set(_ status: GoalStatusChange) {
    changes.set(status, goalId: goal.id, store: store, router: router)
  }
}

/// The Plan's changes to the goal itself (rename, pause, resume, archive): the visit's, not its
/// bar's or menu's. The Plan calls `leave()` as it closes: a change still out saves and shows
/// nothing, and a failure said before is gone on the next visit.
@MainActor
@Observable
final class GoalChanges {
  private(set) var isSaving = false
  /// Said in an alert.
  var failure: GoalStatusOutcome?
  /// Said over the paused page's bar, where its Resume is.
  private(set) var resumeFailure: GoalStatusOutcome?
  /// Resuming changes the plan, so it asks first.
  var confirmsResume = false
  var isRenaming = false
  private(set) var renameFailed = false
  @ObservationIgnored private let tasks = ScreenTasks()

  /// Resuming asks first only when it changes the plan (the pause left lessons behind).
  func resume(goalId: String, store: PlanStore, router: AppRouter) {
    resumeFailure = nil
    isSaving = true

    tasks.run {
      let preview = store.resumeChangesPlan(goalId: goalId)
      await preview.load()

      guard !Task.isCancelled else {
        return
      }

      if preview.value == true {
        self.isSaving = false
        self.confirmsResume = true
      } else {
        await self.change(.active, goalId: goalId, store: store, router: router)
      }
    }
  }

  func set(_ status: GoalStatusChange, goalId: String, store: PlanStore, router: AppRouter) {
    tasks.run {
      await self.change(status, goalId: goalId, store: store, router: router)
    }
  }

  func startRenaming() {
    renameFailed = false
    isRenaming = true
  }

  func rename(_ displayName: String, goalId: String, store: PlanStore) {
    isSaving = true

    tasks.run {
      let result = await store.rename(goalId: goalId, displayName: displayName)

      guard !Task.isCancelled else {
        return
      }

      self.isSaving = false

      switch result {
      case .done(true), .obsolete:
        break
      case .done(false), .failed:
        self.renameFailed = true
        self.isRenaming = true
      }
    }
  }

  func leave() {
    tasks.cancel()
    isSaving = false
    failure = nil
    resumeFailure = nil
    confirmsResume = false
    renameFailed = false
  }

  private func change(
    _ status: GoalStatusChange, goalId: String, store: PlanStore, router: AppRouter
  ) async {
    isSaving = true
    let outcome = await store.setStatus(status, goalId: goalId)

    guard !Task.isCancelled else {
      return
    }

    isSaving = false

    switch outcome {
    case .done(.saved):
      if status == .archived {
        router.showRoot(of: .today)
      }
    case .done(let refused) where status == .active:
      resumeFailure = refused
    case .failed where status == .active:
      resumeFailure = .failed
    case .done(let refused):
      failure = refused
    case .failed:
      failure = .failed
    case .obsolete:
      break
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
  var failure: GoalStatusOutcome?
  var action: () -> Void = {}
}

extension View {
  /// A shown bar holds the page's main action. The Plan stacks its bars and shows one at a time, so
  /// a hidden one writes nothing and leaves the shown one's word.
  fileprivate func holdsMainActionInBar(_ isShown: Bool) -> some View {
    transformEnvironment(\.barHoldsMainAction) { holds in
      if isShown {
        holds = true
      }
    }
  }

  /// A paused goal's page: "Resume" is its bottom bar's main action, and a refused resume is said
  /// over the bar.
  func resumeGoalBar(isShown: Bool = true) -> some View {
    modifier(ResumeGoalBar(isShown: isShown))
  }
}

private struct ResumeGoalBar: ViewModifier {
  @Environment(\.resumeGoal) private var resumeGoal

  let isShown: Bool

  func body(content: Content) -> some View {
    content
      .holdsMainActionInBar(isShown)
      .bottomBar(note: isShown ? note : nil) {
        if isShown {
          BusyButton(isBusy: resumeGoal.isBusy, action: resumeGoal.action) {
            Text("Resume", tableName: "Plan", comment: "Resumes the paused goal")
          }
          .buttonStyle(.mainAction)
          .keyboardShortcut(.defaultAction)
        }
      }
  }

  private var note: BarNote? {
    switch resumeGoal.failure {
    case .limitReached:
      BarNote(GoalError.resumeLimit)
    case .failed:
      BarNote(
        LocalizedStringResource(
          "That didn't save. Try again.", table: "Plan",
          comment: "Resuming the paused goal didn't save"))
    case .saved, nil:
      nil
    }
  }
}

extension EnvironmentValues {
  @Entry var resumeGoal = ResumeGoal()
}

/// An exam whose date passed with lessons left, answered the same on Today and the Plan: archive the
/// goal (it asks first), or keep studying, the main action.
struct ExamOverButtons: View {
  enum Answer {
    case archive
    case keepStudying
  }

  let goalName: String
  let pressed: Answer?
  let archive: () -> Void
  let keepStudying: () -> Void

  @State private var isArchiving = false

  var body: some View {
    BusyButton(isBusy: pressed == .archive, icon: .archive) {
      isArchiving = true
    } label: {
      Text("Archive goal", tableName: "Plan", comment: "Archives the goal, after asking")
    }
    .buttonStyle(.outline)
    .disabled(pressed == .keepStudying)
    .archiveGoalConfirmation(named: goalName, isPresented: $isArchiving, archive: archive)

    BusyButton(isBusy: pressed == .keepStudying, action: keepStudying) {
      Text(
        "Keep studying", tableName: "Plan",
        comment: "Keeps studying the lessons left after the exam's date passed")
    }
    .buttonStyle(.mainAction)
    .keyboardShortcut(.defaultAction)
    .disabled(pressed == .archive)
  }
}

extension View {
  /// The Plan of an exam whose date passed with lessons left asks in its bar, as Today does.
  func examOverBar(goal: LearnerGoal, isShown: Bool) -> some View {
    modifier(ExamOverBar(goal: goal, isShown: isShown))
  }
}

private struct ExamOverBar: ViewModifier {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @State private var pressed: ExamOverButtons.Answer?
  @State private var failed = false
  @State private var saving: Task<Void, Never>?

  let goal: LearnerGoal
  let isShown: Bool

  func body(content: Content) -> some View {
    content
      .holdsMainActionInBar(isShown)
      .bottomBar(note: isShown && failed ? BarNote(saveFailure) : nil) {
        if isShown {
          ExamOverButtons(
            goalName: goal.displayName, pressed: pressed, archive: { save(.archive) },
            keepStudying: { save(.keepStudying) })
        }
      }
      .onDisappear { saving?.cancel() }
  }

  private var saveFailure: LocalizedStringResource {
    LocalizedStringResource(
      "That didn't save. Try again.", table: "Plan", comment: "A change couldn't be saved")
  }

  private func save(_ answer: ExamOverButtons.Answer) {
    guard pressed == nil else {
      return
    }

    pressed = answer
    failed = false

    saving = Task {
      defer { pressed = nil }

      switch answer {
      case .archive:
        failed = await !store.archive(goalId: goal.id) { router.showRoot(of: .today) }
      case .keepStudying:
        switch await store.change(goalId: goal.id, edits: [.fullCourse(true)]) {
        case .done(.invalid), .failed: failed = true
        case .done, .obsolete: break
        }
      }
    }
  }
}

extension PlanStore {
  /// Archives the goal, then `leave`s it. False when it didn't save. A canceled archive, its learner
  /// gone from the Plan meanwhile, leaves nothing, so what they opened since stays open.
  func archive(goalId: String, then leave: () -> Void) async -> Bool {
    switch await setStatus(.archived, goalId: goalId) {
    case .done(.saved):
      leave()
      return true
    case .done, .failed:
      return false
    case .obsolete:
      return true
    }
  }
}

/// Core's `MAX_TITLE_LENGTH`, which bounds a goal's name.
private let goalNameLimit = 120

extension EnvironmentValues {
  /// The Plan's "…" options for its header to draw, where the bar leaves them out.
  @Entry var planOptions: AnyView?
}
