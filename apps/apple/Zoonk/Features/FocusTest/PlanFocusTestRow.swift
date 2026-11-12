import SwiftUI

/// Main's `PlanFocusTest`: the test's place on the plan, with one line on what tapping it gives.
struct PlanFocusTestRow: View {
  let goalId: String
  let summary: FocusTestSummary
  /// The goal has a date, so the test can also suggest where to focus.
  let dated: Bool

  @Environment(AppRouter.self) private var router

  var body: some View {
    Button {
      router.open(.focusTest(goalId: goalId))
    } label: {
      ListRow(
        Text(FocusTestCopy.name),
        description: Text(FocusTestCopy.planLine(summary, dated: dated))
      ) {
        Image(systemName: "scope")
      }
      .disclosureChevron()
    }
  }
}
