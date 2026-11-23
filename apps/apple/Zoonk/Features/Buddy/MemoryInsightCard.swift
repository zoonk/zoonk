import SwiftUI

/// Answering it refreshes Today, which no longer carries it; the card keeps saying what the answer
/// did until the learner leaves.
struct MemoryInsightCard: View {
  @AccessibilityFocusState private var isResultFocused: Bool
  @Environment(BuddyStore.self) private var store

  let today: String
  let dateKind: GoalDateKind
  let opened: MemoryInsight
  /// Held by Today, so the answer outlives the card when a layout change builds it again.
  @Binding var answer: Bool?
  /// Accepted, and still waiting: its plan change's numbers moved, so it asks again with today's.
  @Binding var repriced: MemoryInsight?
  /// Today's, ended as its visit ends.
  let saving: VisitRequest<InsightAnswer>
  var onAnswering: () -> Void = {}

  init(
    insight: MemoryInsight, today: String, dateKind: GoalDateKind, answer: Binding<Bool?>,
    repriced: Binding<MemoryInsight?>,
    saving: VisitRequest<InsightAnswer>, onAnswering: @escaping () -> Void = {}
  ) {
    self.today = today
    self.dateKind = dateKind
    opened = insight
    _answer = answer
    _repriced = repriced
    self.saving = saving
    self.onAnswering = onAnswering
  }

  private var insight: MemoryInsight { repriced ?? opened }

  private var title: Text {
    Text(
      "From your recent answers", tableName: "Buddy",
      comment: "Title of an insight from recent sessions")
  }

  private var failure: LocalizedStringResource? {
    guard case .failed? = saving.outcome else { return nil }
    return LocalizedStringResource(
      "We couldn't save your answer. Try again.", table: "Buddy",
      comment: "Answering an insight failed")
  }

  var body: some View {
    TodaySuggestionCard(mark: mark) {
      if let answer {
        SuggestionResult(text: answered(answer))
          .accessibilityFocused($isResultFocused)
      } else {
        VStack(alignment: .leading, spacing: 4) {
          SuggestionHeader(title)
          SuggestionDescription(Text(insight.message))
        }

        if let change = insight.planChange, change.status == .proposed {
          SuggestionOpen(
            note: failure.map { BarNote($0) },
            label: Text("See what changes", tableName: "Today")
          ) {
            SuggestionHeader(title)
            PlanEffectDiff(
              effect: try? StudyJSON.recode(change.effect, as: PlanEffect.self),
              today: today, options: PlanChangeOptions(dateKind: dateKind),
              repriced: repriced != nil)
          } actions: {
            actions.buttonStyle(.mainAction)
          }
        } else {
          ButtonRow(wraps: true) {
            actions
          }
          .buttonStyle(.outline)
          .controlSize(.small)
        }

        if let failure {
          FailureLine(message: failure)
            .typeStyle(.note)
        }
      }
    }
    .onChange(of: answer) {
      isResultFocused = answer != nil
    }
    .announcesStatus(answer.map(answered))
  }

  private var mark: SuggestionMark.Kind {
    if insight.kind == .tip { return .symbol("lightbulb") }
    return insight.planChange?.status == .applied ? .symbol("text.badge.plus") : .sparkle
  }

  private var actions: some View {
    SuggestionActions {
      if insight.kind != .planChange || insight.planChange?.status == .applied
        || insight.planChange?.canApply == true
      {
        Button {
          save(accepted: true)
        } label: {
          acceptLabel
        }
        .disabled(saving.isRunning)
      }
    } other: {
      if let dismiss = dismissLabel {
        Button {
          save(accepted: false)
        } label: {
          dismiss
        }
        .buttonStyle(.outline)
        .disabled(saving.isRunning)
      }
    }
  }

  private var acceptLabel: Text {
    switch insight.kind {
    case .planChange:
      insight.planChange?.status == .proposed
        ? Text("Add it", tableName: "Buddy", comment: "Accepts a plan change from an insight")
        : Text("Keep it", tableName: "Buddy", comment: "Keeps a lesson an insight already added")
    case .scheduleIdea:
      Text(
        "Move it", tableName: "Buddy",
        comment:
          "Accepts a schedule idea: moves the time of day the learner studies to the time the sentence above names"
      )
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

  private func answered(_ accepted: Bool) -> String {
    switch insight.kind {
    case .planChange:
      accepted
        ? String(
          localized: "Your plan follows it from now on.", table: "Buddy",
          comment: "An insight's plan change was accepted")
        : String(
          localized: "Your plan stays as it was.", table: "Buddy",
          comment: "An insight's plan change was declined")
    case .scheduleIdea:
      accepted
        ? String(
          localized: "Study time moved.", table: "Buddy",
          comment: "A schedule idea was accepted: the time of day the learner studies moved")
        : String(
          localized: "Your study time stays the same.", table: "Buddy",
          comment:
            "A schedule idea was declined: the time of day the learner studies stays the same")
    case .tip:
      String(localized: "Noted.", table: "Buddy", comment: "A tip was acknowledged")
    }
  }

  private func save(accepted: Bool) {
    onAnswering()

    saving.run { [store, insight] in
      switch await store.answer(insight, accepted: accepted) {
      case .done(let saved?) where accepted && saved.status == .pending: .repriced(saved)
      case .done: .answered(accepted)
      case .failed: .failed
      case .obsolete: nil
      }
    } then: { ended in
      switch ended {
      case .answered(let accepted):
        answer = accepted
      case .repriced(let saved):
        repriced = saved
      case .failed, nil:
        break
      }
    }
  }
}

/// How answering an insight ended.
enum InsightAnswer {
  case answered(Bool)
  case repriced(MemoryInsight)
  case failed
}
