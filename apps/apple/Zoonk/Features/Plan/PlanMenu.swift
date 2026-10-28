import SwiftUI

/// The Plan's "…": what the learner does now and then. The exam's page (exam goals), sharing,
/// talking to the buddy; last, what acts on the goal itself (pause or resume, archive), here on its
/// own page so it's clear which goal changes. Archiving asks first, and so does resuming a goal
/// whose plan it changes.
struct PlanMenu: View {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @State private var confirming: Confirmation?
  @State private var failure: GoalStatusOutcome?
  @State private var isSaving = false

  let context: PlanContext

  private enum Confirmation: Identifiable {
    case archive
    case resume

    var id: Self { self }
  }

  var body: some View {
    Menu {
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
            "Ask about your plan", tableName: "Plan",
            comment: "Opens the buddy's conversation, where questions about the plan go")
        } icon: {
          Image(systemName: "questionmark.bubble")
        }
      }

      Section {
        statusItems
      }
    } label: {
      Label {
        Text("Plan options", tableName: "Plan", comment: "Spoken label of the Plan's … menu")
      } icon: {
        Image(systemName: "ellipsis")
      }
      .labelStyle(.iconOnly)
      .frame(maxHeight: .infinity)
    }
    .disabled(isSaving)
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
  private var statusItems: some View {
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
    URL(string: "https://zoonk.com/plan-link/\(context.plan.planId)")!
  }

  private var confirmationTitle: Text {
    switch confirming {
    case .resume:
      Text(
        "Resume \(context.goal.title)?", tableName: "Plan",
        comment: "Asks before resuming the paused goal named here")
    default:
      Text(
        "Archive \(context.goal.title)?", tableName: "Plan",
        comment: "Asks before archiving the goal named here")
    }
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

  private func set(_ status: GoalStatusChange) {
    Task {
      isSaving = true
      let outcome = await store.setStatus(status, goalId: context.goal.id)
      isSaving = false

      if outcome != .saved {
        failure = outcome
      } else if status == .archived {
        router.showRoot(of: .today)
      }
    }
  }
}
