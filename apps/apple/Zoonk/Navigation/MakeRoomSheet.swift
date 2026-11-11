import SwiftUI

/// A waiting goal the free plan has no room for: pausing one of the learner's goals starts it in the
/// same request, so a start the server refuses pauses nothing.
struct MakeRoomSheet: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(OnboardingStore.self) private var onboarding
  @State private var pausingGoalID: String?
  @State private var failed = false
  @State private var start: Task<Void, Never>?

  let waitingGoal: LearnerWaitingGoal

  var body: some View {
    NavigationStack {
      ZoonkList {
        Section {
          Text(
            "You're following as many goals as the free plan allows. Pause one to start \(waitingGoal.displayName). You can resume it later.",
            tableName: "Navigation",
            comment:
              "In the sheet that makes room for a goal waiting to start, above the learner's goals; the argument is the waiting goal's name"
          )
          .foregroundStyle(.mutedForeground)
          .listRowSeparator(.hidden)

          ForEach(activeGoals) { goal in
            row(goal)
          }
        } footer: {
          SectionFooter {
            if failed {
              FailureLine(
                message: LocalizedStringResource(
                  "We couldn't start this goal. Try again.", table: "Navigation",
                  comment: "A goal waiting in the goal switcher didn't start"))
            }
          }
        }

        Section {
          Button {
            router.present(.subscription)
          } label: {
            Text(
              "Get Plus", tableName: "Navigation",
              comment:
                "Opens the Zoonk Plus subscription, which follows more goals at once; Plus is its name, not \"more\""
            )
            .frame(maxWidth: .infinity)
          }
          .buttonStyle(.outline)
          .controlSize(.large)
          .disabled(pausingGoalID != nil)
          .listRowInsets(.vertical, 0)
          .listRowSeparator(.hidden)
        }
      }
      .navigationTitle(
        Text(
          "Make room for \(waitingGoal.displayName)", tableName: "Navigation",
          comment:
            "Title of the sheet where a learner pauses a goal to start the waiting goal named here")
      )
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            dismiss()
          }
          .disabled(pausingGoalID != nil)
        }
      }
    }
    .presentationDetents([.medium, .large])
    .interactiveDismissDisabled(pausingGoalID != nil)
    .onDisappear {
      start?.cancel()
    }
  }

  private var activeGoals: [LearnerGoal] {
    learner.summary.value?.followedGoals.filter { $0.status == .active } ?? []
  }

  private func row(_ goal: LearnerGoal) -> some View {
    AccessibilityStack(spacing: 12, stackedSpacing: 8) {
      ListRow(Text(goal.displayName)) {
        GoalMark(title: goal.displayName, flag: goal.languageFlag.flatMap(flagEmoji))
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      BusyButton(isBusy: pausingGoalID == goal.id) {
        pause(goal)
      } label: {
        Text(
          "Pause", tableName: "Navigation",
          comment: "Pauses the goal in its row to start the waiting goal")
      }
      .buttonStyle(.outline)
      .controlSize(.small)
      .disabled(pausingGoalID != nil && pausingGoalID != goal.id)
    }
    .accessibilityElement(children: .combine)
  }

  private func pause(_ goal: LearnerGoal) {
    guard pausingGoalID == nil else {
      return
    }

    pausingGoalID = goal.id
    failed = false

    start = Task {
      defer { pausingGoalID = nil }

      do {
        let goalID = try await onboarding.startWaitingGoal(waitingGoal, pausing: goal.id)
        router.sheet = nil
        router.open(.goalSetup(goalId: goalID))
      } catch is CancellationError {
      } catch {
        failed = true
      }
    }
  }
}
