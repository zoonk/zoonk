import SwiftUI

/// Main's `PlanFocusTest` and `PlanPlacementTest`: the plan's way into the test of what the learner
/// already knows (an exam's Focus test, a course's test or a language's level test), with one line
/// on what tapping it gives or what the last one found.
struct PlanTestRow: View {
  enum Test: Equatable {
    case focus(FocusTestSummary)
    case placement(PlanPlacementTest)
  }

  let goalId: String
  let test: Test

  @Environment(AppRouter.self) private var router

  /// The plan's test row, when it has one to show.
  init?(goalId: String, plan: GoalPlan) {
    if let focusTest = plan.focusTest {
      test = .focus(focusTest)
    } else if let placementTest = plan.placementTest, placementTest.isShown {
      test = .placement(placementTest)
    } else {
      return nil
    }

    self.goalId = goalId
  }

  var body: some View {
    Button {
      switch test {
      case .focus: router.open(.focusTest(goalId: goalId))
      // A language course's test starts with its level; only its whole-course walk through the
      // course's topics is the course test.
      case .placement(let test):
        router.open(
          test.kind == .language && test.attempt == nil
            ? .levelTest(goalId: goalId) : .placementTest(goalId: goalId))
      }
    } label: {
      ListRow(Text(name), descriptionFacts: facts) {
        Image(systemName: "scope")
      }
      .disclosureChevron()
    }
  }

  private var name: LocalizedStringResource {
    switch test {
    case .focus: FocusTestCopy.name
    case .placement(let test): PlacementTestCopy.name(test.kind)
    }
  }

  private var facts: [String] {
    switch test {
    case .focus(let summary): FocusTestCopy.planLine(summary)
    case .placement(let test): PlacementTestCopy.planLine(test)
    }
  }
}
