import SwiftUI

/// The Focus test on a plan that's already there: from the plan's row, Today's suggestion, the
/// reveal's links and the tutor's offer. Every way in opens the same test. A goal that isn't an exam
/// has none, so it chooses its focus on the plan.
struct FocusTestScreen: View {
  let goalId: String

  @Environment(\.dismiss) private var dismiss
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var plans
  @State private var choosesFocus = false

  var body: some View {
    let goal = learner.summary.value?.goals.first { $0.id == goalId }
    let plan = plans.plan(goalId: goalId)
    let canChangeFocus = goal != nil && plan.value != nil

    NavigationStack {
      Group {
        if let goal, goal.kind != .exam {
          ProgressView()
            .task {
              router.select(.plan)
              dismiss()
            }
        } else {
          FocusTestFlow(
            goalID: goalId, subject: goal?.displayName ?? "", host: .plan,
            changeFocus: canChangeFocus ? { choosesFocus = true } : nil
          ) {
            dismiss()
          }
        }
      }
      .navigationTitle(
        Text("Focus test", tableName: "FocusTest", comment: "Title of an exam goal's Focus test")
      )
      .navigationBarTitleDisplayMode(.inline)
      .taskClose {
        Button(role: .close) { dismiss() }
      }
    }
    .loads(plan, refreshable: false)
    .sheet(isPresented: $choosesFocus) {
      if let goal, let read = plan.value {
        AdjustPlanSheet(goal: goal, plan: read.plan, section: .focus, store: plans)
          .zoonkStyles()
      }
    }
  }
}
