import SwiftUI

/// The Focus test on a plan that's already there: from the plan's row, Today's suggestion, the
/// reveal's links and the tutor's offer. Every way in opens the same test. A goal that isn't an exam
/// has none, so it chooses its focus on the plan.
struct FocusTestScreen: View {
  let goalId: String
  /// The learner chose to start where the test was suggested, so it opens on its first question.
  var startsTest = false

  @Environment(\.dismiss) private var dismiss
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var plans
  @Environment(SessionStore.self) private var session
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
            changeFocus: canChangeFocus ? { choosesFocus = true } : nil,
            isChoosingFocus: choosesFocus, startsTest: startsTest
          ) {
            dismiss()
          }
          // A new session opens the test again from its own read, so another session's question,
          // wait and saves never stay on screen.
          .id(session.authenticatedSession)
        }
      }
      .navigationTitle(Text(FocusTestCopy.name))
      .navigationBarTitleDisplayMode(.inline)
      // Each screen's eyebrow names the test; the title stays for VoiceOver and window names.
      .toolbar(removing: .title)
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
