import SwiftUI

/// Undo shows while the plan is still as the change left it.
struct TutorPlanChangeCard: View {
  let change: Components.Schemas.PlanChange
  let turnID: String
  let conversation: TutorConversation

  @State private var isSaving = false
  @State private var failed = false
  @AccessibilityFocusState private var isResultFocused: Bool

  var body: some View {
    GroupBox {
      VStack(alignment: .leading, spacing: 12) {
        if let reason = change.reason {
          Text(reason)
        }

        if let status = statusLine {
          status
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .accessibilityFocused($isResultFocused)
        }

        actions

        if failed {
          Text(
            "We couldn't save your answer. Try again.", tableName: "Tutor",
            comment: "Answering a plan change the buddy proposed failed"
          )
          .font(.footnote)
          .foregroundStyle(.destructive)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } label: {
      HStack {
        Label {
          Text(
            "Change to your plan", tableName: "Tutor",
            comment: "Title of a plan change the buddy proposed")
        } icon: {
          Image(systemName: "calendar.badge.clock")
        }

        if isForOneWeek {
          Spacer()
          Text("1 week", tableName: "Tutor", comment: "A plan change that lasts one week").chip()
        }
      }
    }
  }

  @ViewBuilder
  private var actions: some View {
    switch change.status {
    case .proposed:
      HStack {
        if change.canApply {
          Button {
            decide(.applied)
          } label: {
            Text("Apply", tableName: "Tutor", comment: "Applies a plan change the buddy proposed")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.mainAction)
        }

        Button {
          decide(.declined)
        } label: {
          Text("Not now", tableName: "Tutor", comment: "Declines a plan change the buddy proposed")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
      }
      .disabled(isSaving)
    case .applied where change.canUndo:
      Button {
        decide(.undone)
      } label: {
        Label {
          Text("Undo", tableName: "Tutor", comment: "Undoes a plan change the learner applied")
        } icon: {
          Image(systemName: "arrow.uturn.backward")
        }
      }
      .buttonStyle(.bordered)
      .disabled(isSaving)
    case .applied, .declined, .undone, .replaced:
      EmptyView()
    }
  }

  private var statusLine: Text? {
    switch change.status {
    case .applied:
      switch change.todaySession {
      case .changed:
        Text(
          "It's in your plan, and today's session follows it.", tableName: "Tutor",
          comment: "A plan change was applied")
      case .unchanged:
        Text(
          "It's in your plan from your next study day. Today's session stays as it is.",
          tableName: "Tutor", comment: "A plan change was applied")
      case nil:
        Text(
          "Your plan follows it from now on.", tableName: "Tutor",
          comment: "A plan change was applied")
      }
    case .declined:
      Text(
        "Not applied. Your plan stays as it was.", tableName: "Tutor",
        comment: "A plan change was declined")
    case .undone:
      Text(
        "Undone. Your plan is back as it was.", tableName: "Tutor",
        comment: "A plan change was undone")
    case .replaced:
      Text(
        "A newer suggestion replaced this one.", tableName: "Tutor",
        comment: "A newer plan change replaced this one")
    case .proposed:
      nil
    }
  }

  private var isForOneWeek: Bool {
    change.operations.contains { operation in
      switch operation.value1 {
      case .case3, .case4: true
      default: false
      }
    }
  }

  private func decide(_ decision: TutorPlanChangeDecision) {
    isSaving = true
    failed = false

    Task {
      let result = await conversation.decide(change, in: turnID, decision: decision)
      isSaving = false

      switch result {
      case .done:
        // The buttons leave with the answer, so VoiceOver lands on what it did.
        isResultFocused = true
      case .failed:
        failed = true
      case .obsolete:
        break
      }
    }
  }
}

struct TutorMemoryUpdate: View {
  let changes: [TutorMemoryChange]
  let turnID: String
  let conversation: TutorConversation

  @State private var result: Bool?

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      if let result {
        result
          ? Text("Change undone", tableName: "Tutor", comment: "A memory change was undone")
          : Text(
            "Couldn't undo. It changed since.", tableName: "Tutor",
            comment: "Undoing a memory change failed"
          )
          .foregroundStyle(.destructive)
      } else {
        Label {
          Text(
            "Memory updated: \(statement)", tableName: "Tutor",
            comment: "What the buddy now remembers; the argument is the fact")
        } icon: {
          Image(systemName: "brain")
        }

        Button {
          Task {
            switch await conversation.undoMemory(of: turnID) {
            case .done:
              result = true
            case .failed:
              result = false
            case .obsolete:
              break
            }
          }
        } label: {
          Text("Undo", tableName: "Tutor", comment: "Undoes what the buddy remembered")
        }
        .buttonStyle(.borderless)
      }
    }
    .font(.footnote)
    .foregroundStyle(.secondary)
  }

  private var statement: String {
    let first = changes.first.flatMap { $0.fact?.statement ?? $0.previous?.statement } ?? ""
    let more = changes.count - 1

    guard more > 0 else {
      return first
    }

    return first + " "
      + String(
        localized: "and \(more) more", table: "Tutor",
        comment: "More memory changes after the first one")
  }
}

struct TutorMissionMoment: View {
  let moment: Components.Schemas.StudyMissionMoment

  var body: some View {
    let done = moment.missions.filter { $0.status == .done }.count

    Label {
      VStack(alignment: .leading, spacing: 2) {
        Text(
          "Mission done", tableName: "Tutor",
          comment: "Asking the buddy completed one of the day's missions"
        )
        .font(.subheadline.weight(.semibold))
        Text(
          "Today's missions: \(done) of \(moment.missions.count)", tableName: "Tutor",
          comment: "The day's missions done, after asking the buddy"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }
    } icon: {
      Image(systemName: "checkmark.circle.fill")
        .foregroundStyle(.success)
    }
    .accessibilityElement(children: .combine)
  }
}
