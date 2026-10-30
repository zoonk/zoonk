import SwiftUI

/// Main's `TodayChangeNotice`: a correction to the source material the goal follows.
struct TodaySourceChangeSection: View {
  let message: String

  var body: some View {
    Section {
      Text(message)
    } header: {
      Label {
        Text("What changed", tableName: "Today", comment: "A change to the goal's sources")
      } icon: {
        Image(systemName: "doc.badge.clock")
      }
    }
  }
}

/// A course the learner took before goals existed, offered as a goal to plan.
struct SuggestedGoalSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(TodayStore.self) private var store

  let suggestion: SuggestedGoal

  @State private var answering: Bool?
  @State private var failed = false

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 4) {
        Text(
          "Continue \(suggestion.title)?", tableName: "Today",
          comment: "Offers a goal from the learner's last course"
        )
        .font(.headline)

        Text("Build a plan in 1 minute.", tableName: "Today", comment: "Suggested goal's promise")
          .foregroundStyle(.secondary)
      }

      Button {
        answer(accepted: true)
      } label: {
        Text("Build my plan", tableName: "Today", comment: "Accepts the suggested goal")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)

      Button {
        answer(accepted: false)
      } label: {
        Text("Not now", tableName: "Today", comment: "Dismisses the suggested goal")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.bordered)
      .controlSize(.large)
    } header: {
      Label {
        Text(
          "Suggested goal", tableName: "Today", comment: "A goal from the learner's last course")
      } icon: {
        Image(systemName: "safari")
      }
    } footer: {
      if failed {
        Text(
          "We couldn't save your answer. Try again.", tableName: "Today",
          comment: "Answering the suggested goal failed"
        )
        .foregroundStyle(.destructive)
      }
    }
    .disabled(answering != nil)
  }

  private func answer(accepted: Bool) {
    answering = accepted
    failed = false

    Task {
      let result = await store.answer(suggestion, accepted: accepted)
      answering = nil

      switch result {
      case .done where accepted:
        if let courseID = suggestion.courseId {
          router.open(.courseStart(courseId: courseID))
        } else {
          router.open(.startGoal(goal: suggestion.title))
        }
      case .failed:
        failed = true
      case .done, .obsolete:
        break
      }
    }
  }
}

/// Main's `TodayExamChoice`: equal options, one under the other in their order. Once picked, it
/// says what the plan studies, with Undo.
struct TodayExamChoiceSection: View {
  @Environment(PlanStore.self) private var plans

  let goalID: String
  let choice: TodayView.ExamChoice?
  /// Kept above the panes, so folding keeps the answer.
  @Binding var editor: PlanEditor?

  var body: some View {
    if let editor, case .applied(let change, let sentence) = editor.latest {
      Section {
        Text(sentence)

        if change.canUndo {
          Button {
            Task { await editor.undo() }
          } label: {
            Text("Undo", tableName: "Today", comment: "Undoes a plan change the learner applied")
          }
          .disabled(editor.isSaving)
        }

        failure
      }
    } else if let choice {
      Section {
        Label {
          VStack(alignment: .leading, spacing: 4) {
            Text(
              "\(choice.group): which one will you take?", tableName: "Plan",
              comment: "Asks which option of an exam's choice the learner takes"
            )
            .font(.headline)

            Text(
              "Pick the one you'll take. Until you do, your plan leaves \(choice.group) out.",
              tableName: "Plan", comment: "Explains an exam choice still to make"
            )
            .foregroundStyle(.secondary)
          }
        } icon: {
          Image(systemName: "signpost.right")
        }

        ForEach(choice.options, id: \.name) { option in
          Button(option.shortName ?? option.name) {
            pick(option.name, in: choice.group)
          }
        }
        .disabled(editor?.isSaving == true)

        failure
      }
    }
  }

  @ViewBuilder
  private var failure: some View {
    if editor?.failed == true {
      Text(
        "That didn't save. Try again.", tableName: "Today", comment: "A change couldn't be saved"
      )
      .font(.footnote)
      .foregroundStyle(.destructive)
    }
  }

  private func pick(_ subject: String, in group: String) {
    let editor = editor ?? PlanEditor(goalId: goalID, store: plans)
    self.editor = editor
    let goalID = goalID

    Task {
      await editor.apply(
        sentence: String(
          localized: "Your plan studies \(subject) for \(group).", table: "Plan",
          comment: "Says which option the plan studies for an exam's choice")
      ) { api, token in
        try await api.chooseExamOption(token: token, goalId: goalID, group: group, subject: subject)
      }
    }
  }
}

/// Main sends a learner who fell behind to the Plan with its editor open; here it opens over Today.
struct TodayAdjustPlanSheet: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var plans

  let goalID: String
  let section: AdjustPlanSheet.Section

  var body: some View {
    let plan = plans.plan(goalId: goalID)

    Group {
      if let goal = learner.summary.value?.followedGoals.first(where: { $0.id == goalID }),
        let read = plan.value, read.plan.ready
      {
        AdjustPlanSheet(goal: goal, plan: read.plan, section: section, store: plans)
      } else {
        ProgressView()
      }
    }
    .loads(plan, refreshable: false)
  }
}
