import SwiftUI

struct TestedOutChangeCard: View {
  let change: TodayView.PlanChange
  let today: String
  let isUndone: Bool
  let isSaving: Bool
  let failed: Bool
  let onUndo: () -> Void

  @AccessibilityFocusState private var restoredFocused: Bool

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        if isUndone || change.status == "undone" {
          Text(PlacementTestCopy.lessonsRestored(change.lessonsSkipped))
            .typeStyle(.body)
            .accessibilityFocused($restoredFocused)
        } else {
          Text(PlanChangeWords.skippedSentence(change.lessonsSkipped))
            .typeStyle(.body.weight(.semibold))

          PlanEffectDiff(effect: change.effect, today: today, summary: false)

          if change.canUndo {
            BusyButton(isBusy: isSaving, icon: .undo, action: onUndo) {
              Text("Undo", tableName: "Plan")
            }
            .buttonStyle(.outline)
            .controlSize(.small)
          }
        }

        if failed {
          FailureLine(message: SuggestionSaveError.message)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(12)
      .panel()
      .listRowSeparator(.hidden)
    }
    .onChange(of: isUndone) { restoredFocused = isUndone }
  }
}
