import SwiftUI

/// What main's wide layout shows beside an onboarding screen: how it works before there's a goal,
/// the plan so far once there is one.
enum OnboardingAside {
  case howItWorks
  case planSoFar(Components.Schemas.Goal)
}

extension EnvironmentValues {
  @Entry var onboardingAside: OnboardingAside?
}

extension View {
  /// Main's onboarding column, 40rem, with the aside beside it where two panes fit.
  func onboardingColumn() -> some View {
    modifier(OnboardingColumn())
  }
}

private struct OnboardingColumn: ViewModifier {
  @Environment(\.onboardingAside) private var aside

  func body(content: Content) -> some View {
    PaneBeside(isAvailable: aside != nil, paneEdge: .trailing, primaryShare: 0.55) {
      switch aside {
      case .howItWorks?:
        HowItWorks()
      case .planSoFar(let goal)?:
        PlanSoFar(goal: goal)
      case nil:
        EmptyView()
      }
    } content: { isBeside in
      content.modifier(LoneColumn(isBeside: isBeside))
    }
  }
}

/// Alone, the column keeps to the page before iPhone Duo's hinge, so nothing sits on the fold.
private struct LoneColumn: ViewModifier {
  let isBeside: Bool

  @State private var space = PaneSpace(width: 0)

  func body(content: Content) -> some View {
    let hinge = isBeside ? nil : space.hinge

    content
      .readableColumn(hinge == nil ? 640 : .infinity)
      .safeAreaPadding(.trailing, hinge.map { space.width - $0.lowerBound } ?? 0)
      .onGeometryChange(for: PaneSpace.self, of: PaneSpace.init) { space = $0 }
  }
}

/// Main's `OnboardingHowItWorks`, at its first step.
private struct HowItWorks: View {
  @Environment(LearnerSummaryStore.self) private var learner

  var body: some View {
    List {
      Section {
        step(
          1,
          Text(
            "Say what you want to achieve", tableName: "Onboarding",
            comment: "How it works, first step: typing a goal"),
          isCurrent: true)
        step(
          2,
          Text(
            "Answer a few questions", tableName: "Onboarding",
            comment: "How it works, second step: onboarding's questions"))
        step(
          3,
          Text(
            "Get a plan with dates, and your first lesson", tableName: "Onboarding",
            comment: "How it works, last step: the plan"))
      } header: {
        Text(
          "How it works", tableName: "Onboarding",
          comment: "Heading over the steps from a goal to its plan")
      } footer: {
        if learner.summary.value?.identity.isAnonymous ?? true {
          Text(
            "Start free, no account needed.", tableName: "Onboarding",
            comment: "Under onboarding's steps for a visitor or a guest")
        }
      }
    }
  }

  private func step(_ number: Int, _ title: Text, isCurrent: Bool = false) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      Text(number, format: .number)
        .font(.caption.monospaced())
        .foregroundStyle(.secondary)
        .accessibilityHidden(true)

      title
    }
    .listRowBackground(isCurrent ? Color(.tertiarySystemFill) : nil)
    .accessibilityAddTraits(isCurrent ? .isSelected : [])
  }
}
