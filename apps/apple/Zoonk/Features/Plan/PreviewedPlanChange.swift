import SwiftUI

/// Says what the change does before the learner chooses it.
struct PreviewedPlanChange<Control: View>: View {
  @Environment(PlanStore.self) private var store
  @State private var isPreviewing = false
  @State private var preview: Preview?

  let editor: PlanEditor
  let plan: GoalPlan
  let edits: [PlanEdit]
  /// The alert's title, and its button that makes the change.
  let title: Text
  /// What the change does, said before what it changes in the plan.
  let what: String
  /// What the Plan says once the change is saved.
  let sentence: String
  @ViewBuilder let control: (_ isPreviewing: Bool, _ ask: @escaping () -> Void) -> Control

  private struct Preview: Identifiable {
    let effect: PlanEffect?

    var id: Int { 0 }
  }

  var body: some View {
    control(isPreviewing) {
      Task { await ask() }
    }
    .disabled(isPreviewing)
    .alert(
      title,
      isPresented: Binding(get: { preview != nil }, set: { if !$0 { preview = nil } }),
      presenting: preview
    ) { _ in
      Button {
        Task { await editor.change(edits, sentence: sentence) }
      } label: {
        title
      }

      Button(role: .cancel) {
      } label: {
        Text("Cancel", tableName: "Plan", comment: "Cancels a change")
      }
    } message: { preview in
      Text(
        verbatim: [what, planEffectText(preview.effect, plan: plan)].compactMap(\.self).joined(
          separator: " "))
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
    case .done(let effect): preview = Preview(effect: effect)
    case .failed: preview = Preview(effect: nil)
    case .obsolete: break
    }
  }
}
