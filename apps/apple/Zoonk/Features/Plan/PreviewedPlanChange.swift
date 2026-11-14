import SwiftUI

/// Says what the change does before the learner chooses it.
struct PreviewedPlanChange<Control: View>: View {
  @Environment(PlanStore.self) private var store
  @State private var isPreviewing = false
  @State private var preview: Preview?
  @State private var hasAsked = false

  let editor: PlanEditor
  let plan: GoalPlan
  let edits: [PlanEdit]
  let title: Text
  /// The alert's button that makes the change.
  let button: Text
  /// What the change does, said before its consequence.
  let what: String
  /// Asks as soon as it shows, for a learner who came to make this change.
  var asksOnAppear = false
  @ViewBuilder let control: (_ isPreviewing: Bool, _ ask: @escaping () -> Void) -> Control

  private struct Preview: Identifiable {
    let effect: PlanEffect?

    var id: Int { 0 }
  }

  var body: some View {
    control(isPreviewing) {
      Task { await ask() }
    }
    .task {
      if asksOnAppear && !hasAsked {
        hasAsked = true
        await ask()
      }
    }
    .alert(
      title,
      isPresented: Binding(get: { preview != nil }, set: { if !$0 { preview = nil } }),
      presenting: preview
    ) { _ in
      Button {
        Task { await editor.change(edits) }
      } label: {
        button
      }

      Button(role: .cancel) {
      } label: {
        Text("Cancel", tableName: "Plan", comment: "Cancels a change")
      }
    } message: { preview in
      // An alert holds text alone, so the change's consequence follows what it does, without its
      // rows.
      Text(
        verbatim: [
          what,
          PlanChangeEffect.consequence(
            preview.effect,
            PlanChangeOptions(
              byDate: plan.schedule.targetDate != nil,
              dateKind: editor.dateKind),
            today: plan.today)?.text,
        ].compactMap(\.self).joinedSentences())
    }
  }

  /// A preview that didn't load still asks, without what it changes.
  private func ask() async {
    guard !isPreviewing else {
      return
    }

    isPreviewing = true
    defer { isPreviewing = false }

    let goalId = plan.goalId
    let edits = edits
    let result = await store.write { api, token in
      try await api.preview(token: token, goalId: goalId, edits: edits)
    } changed: { _ in
      false
    }

    switch result {
    case .done(let previewed): preview = Preview(effect: previewed?.effect)
    case .failed: preview = Preview(effect: nil)
    case .obsolete: break
    }
  }
}
