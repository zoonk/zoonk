import SwiftUI

/// Main's `PlanFocusTest`: the test's place on the plan, with its state, a way in and the switch for
/// its questions inside sessions.
struct PlanFocusTestRow: View {
  let goalId: String
  let summary: FocusTestSummary

  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var plans
  @State private var isSwitching = false
  @State private var failed = false

  var body: some View {
    Button {
      router.open(.focusTest(goalId: goalId))
    } label: {
      ListRow(
        Text("Focus test", tableName: "FocusTest", comment: "Title of an exam goal's Focus test"),
        description: Text(FocusTestCopy.stateFacts(summary).joinedFacts())
      ) {
        Image(systemName: "scope")
      }
      .disclosureChevron()
    }

    if summary.sessionQuestions != .off {
      questionsSwitch(paused: summary.sessionQuestions == .paused)
    }
  }

  /// Said only while sessions ask the test's questions, or the learner paused them.
  private func questionsSwitch(paused: Bool) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Group {
        if paused {
          Text(
            "Test questions in your sessions are paused.", tableName: "FocusTest",
            comment: "Under the plan's Focus test row while its session questions are paused")
        } else {
          Text(FocusTestCopy.sessionQuestions)
        }
      }
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)

      BusyButton(isBusy: isSwitching) {
        setQuestions(paused ? .on : .paused)
      } label: {
        paused
          ? Text(
            "Ask them again", tableName: "FocusTest",
            comment: "Turns the Focus test's questions in sessions back on")
          : Text(
            "Pause test questions", tableName: "FocusTest",
            comment: "Stops sessions from asking the Focus test's questions")
      }
      .buttonStyle(.outline)
      .controlSize(.small)

      if failed {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't save. Try again.", table: "FocusTest",
            comment: "A Focus test switch couldn't be saved"))
      }
    }
    .listRowSeparator(.hidden, edges: .top)
  }

  private func setQuestions(_ sessionQuestions: FocusTestSessionQuestions) {
    guard !isSwitching else {
      return
    }

    isSwitching = true
    failed = false

    Task {
      defer { isSwitching = false }

      if case .failed = await plans.updateFocusTest(
        goalId: goalId, FocusTestControls(sessionQuestions: sessionQuestions))
      {
        failed = true
      }
    }
  }
}
