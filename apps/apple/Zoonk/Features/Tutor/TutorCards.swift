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
          FailureLine(
            message: LocalizedStringResource(
              "We couldn't save your answer. Try again.", table: "Tutor",
              comment: "Answering a plan change the buddy proposed failed")
          )
          .font(.footnote)
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
      ButtonRow {
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
      BusyButton(isBusy: isSaving) {
        decide(.undone)
      } label: {
        Label {
          Text("Undo", tableName: "Tutor", comment: "Undoes a plan change the learner applied")
        } icon: {
          Image(systemName: "arrow.uturn.backward")
        }
      }
      .buttonStyle(.bordered)
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

  private func decide(_ decision: PlanChangeDecision) {
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

  var body: some View {
    let undo = conversation.memoryUndos[turnID]

    VStack(alignment: .leading, spacing: 6) {
      switch undo {
      case .undone:
        Text(undone)
      case .changedSince:
        FailureLine(
          message: LocalizedStringResource(
            "Couldn't undo. It changed since.", table: "Tutor",
            comment: "Undoing a memory change failed"))
      case .failed, .undoing, nil:
        Label {
          Text(Self.line(changes))
        } icon: {
          Image(systemName: "brain")
        }

        Button {
          Task { await conversation.undoMemory(of: turnID) }
        } label: {
          Text("Undo", tableName: "Tutor", comment: "Undoes what the buddy remembered")
        }
        .buttonStyle(.borderless)
        .disabled(undo == .undoing)

        if undo == .failed {
          FailureLine(
            message: LocalizedStringResource(
              "Couldn't undo. Try again.", table: "Tutor",
              comment: "Undoing a memory change didn't go through, and Undo stays to try again"))
        }
      }
    }
    .font(.footnote)
    .foregroundStyle(.secondary)
    .announcesStatus(undo == .undone ? undone : nil)
  }

  private var undone: String {
    String(localized: "Change undone", table: "Tutor", comment: "A memory change was undone")
  }

  static func line(_ changes: [TutorMemoryChange]) -> String {
    String(
      localized: "Memory updated: \(statement(changes))", table: "Tutor",
      comment: "What the buddy now remembers; the argument is the fact")
  }

  private static func statement(_ changes: [TutorMemoryChange]) -> String {
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
    Label {
      VStack(alignment: .leading, spacing: 2) {
        Text(Self.title)
          .font(.subheadline.weight(.semibold))
        Text(Self.progress(moment))
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
    } icon: {
      Image(systemName: "checkmark.circle.fill")
        .foregroundStyle(.success)
    }
    .accessibilityElement(children: .combine)
  }

  static func said(_ moment: Components.Schemas.StudyMissionMoment) -> String {
    [title, progress(moment)].joinedSentences()
  }

  private static var title: String {
    String(
      localized: "Mission done", table: "Tutor",
      comment: "Asking the buddy completed one of the day's missions")
  }

  private static func progress(_ moment: Components.Schemas.StudyMissionMoment) -> String {
    let done = moment.missions.filter { $0.status == .done }.count

    return String(
      localized: "Today's missions: \(done) of \(moment.missions.count)", table: "Tutor",
      comment: "The day's missions done, after asking the buddy")
  }
}
