import SwiftUI
import XCTest

@testable import Zoonk

/// The Plan stacks its bars (Resume, then the exam-over question) and shows one at a time. What
/// the page shows reads whether the bar holds its main action, so a suggestion's Save beside it is
/// outline, never a second fill.
@MainActor
final class BarMainActionTests: XCTestCase {
  func testAHiddenBarLeavesTheShownBarHoldingTheMainAction() async throws {
    var holds: [Bool] = []
    let session = SessionStore.preview()
    let goal = LearnerGoal(
      dailyMinutes: 30, id: "goal", kind: .exam, language: "en", status: .active,
      targetDate: "2026-01-04", displayName: "ENEM", title: "ENEM")

    // As the Plan nests them: the hidden Resume bar inside the shown exam-over bar.
    try show(
      NavigationStack {
        BarMainActionProbe { holds.append($0) }
          .resumeGoalBar(isShown: false)
          .examOverBar(goal: goal, isShown: true)
      }
      .environment(AppRouter())
      .environment(PlanStore(api: PlanAPIStub(), cache: AppCache(session: session))))

    try await Task.sleep(for: .seconds(0.5))

    XCTAssertEqual(holds.last, true)
  }
}

private struct BarMainActionProbe: View {
  @Environment(\.barHoldsMainAction) private var barHoldsMainAction

  let read: (Bool) -> Void

  var body: some View {
    Color.clear
      .onChange(of: barHoldsMainAction, initial: true) { _, holds in read(holds) }
  }
}
