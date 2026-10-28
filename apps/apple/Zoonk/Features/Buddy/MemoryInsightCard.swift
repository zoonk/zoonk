import SwiftUI

/// Answering it refreshes Today, which no longer carries it; the card keeps saying what the answer
/// did until the learner leaves.
struct MemoryInsightCard: View {
  @Environment(BuddyStore.self) private var store

  let insight: MemoryInsight

  @State private var answer: Bool?
  @State private var failed = false
  @State private var isSaving = false

  var body: some View {
    GroupBox {
      VStack(alignment: .leading, spacing: 12) {
        if let answer {
          answered(answer)
            .foregroundStyle(.secondary)
        } else {
          Text(insight.message)
          actions
        }

        if failed {
          Text(
            "We couldn't save your answer. Try again.", tableName: "Buddy",
            comment: "Answering an insight failed"
          )
          .font(.footnote)
          .foregroundStyle(.destructive)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } label: {
      Label {
        Text(
          "From your recent answers", tableName: "Buddy",
          comment: "Title of an insight from recent sessions")
      } icon: {
        Image(systemName: mark)
      }
    }
  }

  private var mark: String {
    if insight.kind == .tip {
      return "lightbulb"
    }

    return insight.planChange?.status == .applied ? "text.badge.plus" : "sparkles"
  }

  @ViewBuilder
  private var actions: some View {
    let showsAccept =
      insight.kind != .planChange || insight.planChange?.status == .applied
      || insight.planChange?.canApply == true

    HStack {
      if showsAccept {
        if let dismiss = dismissLabel {
          Button {
            save(accepted: true)
          } label: {
            acceptLabel.frame(maxWidth: .infinity)
          }
          .buttonStyle(.mainAction)

          Button {
            save(accepted: false)
          } label: {
            dismiss.frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
        } else {
          // A tip's only answer acknowledges it: bordered, so Today's own action stays the
          // screen's one main button.
          Button {
            save(accepted: true)
          } label: {
            acceptLabel
          }
          .buttonStyle(.bordered)
        }
      } else if let dismiss = dismissLabel {
        Button {
          save(accepted: false)
        } label: {
          dismiss
        }
        .buttonStyle(.bordered)
      }
    }
    .disabled(isSaving)
  }

  private var acceptLabel: Text {
    switch insight.kind {
    case .planChange:
      insight.planChange?.status == .proposed
        ? Text("Add it", tableName: "Buddy", comment: "Accepts a plan change from an insight")
        : Text("Keep it", tableName: "Buddy", comment: "Keeps a lesson an insight already added")
    case .scheduleIdea:
      Text(
        "Move my study time to \(insight.studyTime ?? "")", tableName: "Buddy",
        comment: "Accepts a schedule idea; the argument is a time")
    case .tip:
      Text("Got it", tableName: "Buddy", comment: "Acknowledges a tip")
    }
  }

  private var dismissLabel: Text? {
    switch insight.kind {
    case .planChange:
      insight.planChange?.status == .proposed
        ? Text("No thanks", tableName: "Buddy", comment: "Declines a plan change from an insight")
        : Text("Undo", tableName: "Buddy", comment: "Undoes a lesson an insight added")
    case .scheduleIdea:
      Text("Not now", tableName: "Buddy", comment: "Declines a schedule idea")
    case .tip:
      nil
    }
  }

  private func answered(_ accepted: Bool) -> Text {
    switch insight.kind {
    case .planChange:
      accepted
        ? Text(
          "Your plan follows it from now on.", tableName: "Buddy",
          comment: "An insight's plan change was accepted")
        : Text(
          "Your plan stays as it was.", tableName: "Buddy",
          comment: "An insight's plan change was declined")
    case .scheduleIdea:
      accepted
        ? Text("Study time moved.", tableName: "Buddy", comment: "A schedule idea was accepted")
        : Text(
          "Your study time stays the same.", tableName: "Buddy",
          comment: "A schedule idea was declined")
    case .tip:
      Text("Noted.", tableName: "Buddy", comment: "A tip was acknowledged")
    }
  }

  private func save(accepted: Bool) {
    isSaving = true
    failed = false

    Task {
      let result = await store.answer(insight, accepted: accepted)
      isSaving = false

      switch result {
      case .done:
        answer = accepted
      case .failed:
        failed = true
      case .obsolete:
        break
      }
    }
  }
}
