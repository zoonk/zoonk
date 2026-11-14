import SwiftUI

/// Main's `TutorPlanChange`: the question, one consequence, "See all changes" and the two answers;
/// once answered, what it did and Undo while the plan is still as the change left it.
struct TutorPlanChangeCard: View {
  let change: Components.Schemas.PlanChange
  let turnID: String
  let conversation: TutorConversation

  @State private var isSaving = false
  @State private var failed = false
  /// The learner's last answer was to apply it.
  @State private var accepted = false
  @AccessibilityFocusState private var isResultFocused: Bool

  private struct Facts: Decodable {
    struct OfficialDate: Decodable {
      let date: String
    }

    let effect: PlanEffect?
    let officialDate: OfficialDate?
    let operations: [PlanChangeOperation]
  }

  var body: some View {
    let facts = try? PracticeJSON.recode(change, as: Facts.self)
    let words = PlanChangeWords.words(
      kind: change.kind, source: change.source, status: change.status.rawValue,
      operations: facts?.operations ?? [], reason: change.reason, effect: facts?.effect,
      dateKind: .unknown)
    let today = PlanDate.today()
    // Accepted, and still proposed: its numbers moved, so it asks again with today's.
    let repriced = accepted && change.status == .proposed

    GroupBox {
      VStack(alignment: .leading, spacing: 12) {
        VStack(alignment: .leading, spacing: 4) {
          Text(words.title)
            .typeStyle(.body.weight(.semibold))

          if let why = words.why {
            Text(why)
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
        }

        if change.status == .proposed {
          PlanEffectDiff(effect: facts?.effect, today: today, repriced: repriced)

          if let date = facts?.officialDate?.date {
            Text(
              "The official exam date is \(PlanDate.longDay(date, today: today)).",
              tableName: "Tutor",
              comment:
                "Under a change that moves the exam off its official date; the argument is a day like \"May 5\""
            )
            .typeStyle(.note.weight(.medium))
          }
        }

        if let status = statusLine {
          Text(status)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
            .accessibilityFocused($isResultFocused)
        }

        actions(overridesNotice: facts?.officialDate != nil)

        if failed {
          FailureLine(
            message: LocalizedStringResource(
              "That didn't save. Try again.", table: "Tutor",
              comment: "Answering a plan change the buddy proposed failed")
          )
          .typeStyle(.note)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .accessibilityElement(children: .contain)
  }

  @ViewBuilder
  private func actions(overridesNotice: Bool) -> some View {
    switch change.status {
    case .proposed:
      // "Change my plan" takes the room "Not now" leaves.
      HStack(spacing: 8) {
        Button {
          decide(.declined)
        } label: {
          overridesNotice
            ? Text(
              "Keep official date", tableName: "Tutor",
              comment: "Declines a change and keeps the exam's official date")
            : Text(
              "Not now", tableName: "Tutor", comment: "Declines a plan change the buddy proposed")
        }
        .buttonStyle(.outline)

        if change.canApply {
          Button {
            decide(.applied)
          } label: {
            overridesNotice
              ? Text(
                "Use my date", tableName: "Tutor",
                comment: "Applies a change that moves the exam off its official date")
              : Text(
                "Change my plan", tableName: "Tutor",
                comment: "Applies a plan change the buddy proposed")
          }
          .buttonStyle(.mainAction)
          .buttonSizing(.flexible)
        }
      }
      .disabled(isSaving)
    case .applied where change.canUndo:
      BusyButton(isBusy: isSaving, icon: .undo) {
        decide(.undone)
      } label: {
        Text("Undo", tableName: "Tutor", comment: "Undoes a plan change the learner applied")
      }
      .buttonStyle(.outline)
    case .applied, .declined, .undone, .replaced:
      EmptyView()
    }
  }

  private var statusLine: String? {
    switch change.status {
    case .applied:
      PlanChangeWords.appliedLine(todaySession: change.todaySession?.rawValue)
    case .declined:
      String(
        localized: "Your plan stays as it was.", table: "Tutor",
        comment: "A plan change was declined")
    case .undone:
      String(
        localized: "Undone. Your plan is back as it was.", table: "Tutor",
        comment: "A plan change was undone")
    case .replaced:
      String(
        localized: "A newer suggestion replaced this one.", table: "Tutor",
        comment: "A newer plan change replaced this one")
    case .proposed:
      nil
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
        accepted = decision == .applied
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
        .buttonStyle(.ghost)
        .disabled(undo == .undoing)

        if undo == .failed {
          FailureLine(
            message: LocalizedStringResource(
              "Couldn't undo. Try again.", table: "Tutor",
              comment: "Undoing a memory change didn't go through, and Undo stays to try again"))
        }
      }
    }
    .typeStyle(.note)
    .foregroundStyle(.mutedForeground)
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
          .typeStyle(.body.weight(.semibold))
        Text(Self.progress(moment))
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
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
