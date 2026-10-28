import SwiftUI

/// The end of a goal's onboarding: "Building your plan" while the goal's run writes it, then the plan created, with Start opening the first day on Today.
struct PlanStep: View {
  let view: GoalOnboarding

  @State private var isBuilt = false

  var body: some View {
    if isBuilt || view.generationId == nil {
      PlanCreated(view: view)
    } else if let generationID = view.generationId {
      GenerationWaitView(
        title: LocalizedStringResource(
          "Building your plan", table: "Onboarding", comment: "Title while a goal's plan is built"),
        description: LocalizedStringResource(
          "We're choosing what to learn first and fitting it into your days. A new subject can take a minute or two.",
          table: "Onboarding", comment: "Shown while a goal's plan is built"),
        generationID: generationID,
        kind: .curriculum
      ) {
        isBuilt = true
      }
    }
  }
}

/// "Plan created": the goal, what the plan asks of a day, and Start.
private struct PlanCreated: View {
  let view: GoalOnboarding

  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner

  var body: some View {
    Form {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          Label {
            Text(
              "Plan created", tableName: "Onboarding",
              comment: "Eyebrow over a goal whose plan was just built")
          } icon: {
            Image(systemName: "checkmark.circle.fill")
          }
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(.success)

          Text(view.goal.title)
            .font(.title2.bold())
            .accessibilityAddTraits(.isHeader)

          Text(facts)
            .foregroundStyle(.secondary)
        }
        .listRowBackground(Color.clear)
      }

      Section {
        Button {
          router.showRoot(of: .today)
        } label: {
          Text("Start", tableName: "Onboarding", comment: "Opens Today with the plan's first day")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .keyboardShortcut(.defaultAction)
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
      } footer: {
        if learner.summary.value?.identity.isAnonymous == true {
          VStack(alignment: .leading, spacing: 8) {
            Text(
              "Save your plan so it's here next time.", tableName: "Onboarding",
              comment: "A guest's plan isn't saved to an account yet")
            Button {
              router.present(.signIn)
            } label: {
              Text(
                "Create an account", tableName: "Onboarding", comment: "Opens sign-up from the plan"
              )
            }
          }
        }
      }
    }
  }

  /// The plan's day and date: "15 minutes a day · until November 8, 2027".
  private var facts: String {
    let daily = String(
      localized: LocalizedStringResource(
        "\(Duration.seconds(view.goal.dailyMinutes * 60), format: .units(allowed: [.hours, .minutes], width: .wide)) a day",
        table: "Onboarding", comment: "How long the learner studies each day"))

    guard let date = view.goal.targetDate.flatMap(UnderstoodRows.day) else {
      return daily
    }

    return [daily, date.formatted(.dateTime.day().month(.wide).year())].joined(separator: " · ")
  }
}
