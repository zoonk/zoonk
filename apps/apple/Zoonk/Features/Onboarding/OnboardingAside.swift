import SwiftUI

/// What main's wide layout shows beside an onboarding screen: how it works before there's a goal,
/// the plan so far once there is one.
enum OnboardingAside {
  case howItWorks
  case planSoFar([PlanFact])

  var planFacts: [PlanFact]? {
    if case .planSoFar(let facts) = self { facts } else { nil }
  }
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
      case .planSoFar(let facts)?:
        PlanSoFar(facts: facts)
      case nil:
        EmptyView()
      }
    } content: { _ in
      content.lonePage(readableWidth: 640)
    }
  }
}

/// Main's `OnboardingHowItWorks`, at its first step.
private struct HowItWorks: View {
  @Environment(LearnerSummaryStore.self) private var learner

  var body: some View {
    ZoonkList {
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
        SectionTitle(
          Text(
            "How it works", tableName: "Onboarding",
            comment: "Heading over the steps from a goal to its plan"))
      } footer: {
        SectionFooter {
          if learner.summary.value?.identity.isAnonymous ?? true {
            Text(
              "Start free, no account needed.", tableName: "Onboarding",
              comment: "Under onboarding's steps for a visitor or a guest")
          }
        }
      }
    }
  }

  private func step(_ number: Int, _ title: Text, isCurrent: Bool = false) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      Text(number, format: .number)
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
        .accessibilityHidden(true)

      title
    }
    .currentRow(isCurrent)
    .accessibilityAddTraits(isCurrent ? .isSelected : [])
  }
}
