import SwiftUI

/// What main's wide layout shows beside an onboarding screen: how it works before there's a goal,
/// the plan so far once there is one.
enum OnboardingAside {
  case howItWorks
  case planSoFar([PlanFact])
}

extension EnvironmentValues {
  @Entry var onboardingAside: OnboardingAside?
}

extension View {
  /// Main's onboarding column, 40rem, with the aside beside it where two panes fit.
  func onboardingColumn() -> some View {
    modifier(OnboardingColumn { EmptyView() })
  }

  /// `lead` is the aside's first block, above the plan so far: a wait's progress.
  func onboardingColumn<Lead: View>(@ViewBuilder lead: @escaping () -> Lead) -> some View {
    modifier(OnboardingColumn(lead: lead))
  }
}

private struct OnboardingColumn<Lead: View>: ViewModifier {
  @ViewBuilder let lead: () -> Lead

  @Environment(\.onboardingAside) private var aside

  func body(content: Content) -> some View {
    OnboardingPaneColumn(isAvailable: aside != nil) {
      switch aside {
      case .howItWorks?:
        HowItWorks()
      case .planSoFar(let facts)?:
        PlanSoFar(facts: facts, lead: lead)
      case nil:
        EmptyView()
      }
    } content: { _ in
      content
    }
  }
}

/// Main's onboarding column with `pane` in the aside's place, for a step that shows its own facts
/// there. `content` learns whether the pane is beside it, to show them itself when it isn't.
struct OnboardingPaneColumn<Pane: View, Content: View>: View {
  var isAvailable = true
  @ViewBuilder let pane: () -> Pane
  @ViewBuilder let content: (_ isBeside: Bool) -> Content

  var body: some View {
    PaneBeside(isAvailable: isAvailable, paneEdge: .trailing, primaryShare: 0.55, pane: pane) {
      content($0).readableColumn(640).lonePage()
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
