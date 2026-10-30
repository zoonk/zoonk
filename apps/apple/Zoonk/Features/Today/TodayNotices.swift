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

/// Main's `UploadRequestClient`: research couldn't read the official document or class material,
/// so the learner can upload it, and research reads it instead, or dismiss the ask.
struct TodayUploadRequestSection: View {
  @Environment(TodayStore.self) private var store

  let request: TodayView.UploadRequest
  /// Answered here, it thanks the learner while they stay, whatever Today reads since.
  let answered: Bool
  @Binding var draft: MaterialDraft
  let onAnswered: () -> Void

  @State private var isDismissing = false
  @State private var isDismissed = false
  @State private var failed = false

  var body: some View {
    if !isDismissed {
      Section {
        Label {
          VStack(alignment: .leading, spacing: 4) {
            Text(title)
              .font(.headline)
            Text(description)
              .foregroundStyle(.secondary)
          }
        } icon: {
          Image(systemName: "doc.text.magnifyingglass")
        }

        if answered {
          Text(
            "Thanks. We're reading it now, and your plan will update in a few minutes.",
            tableName: "Today",
            comment: "After the learner uploaded the document research asked for")
        } else {
          MaterialAttachControls(goal: (request.goalId, request.language), draft: $draft) {
            Label {
              Text(action)
            } icon: {
              Image(systemName: "arrow.up.doc")
            }
          } onAttached: { source in
            if case .failed(let error) = await store.answer(request, sourceID: source.id) {
              throw error
            }

            onAnswered()
          }

          Button(action: dismiss) {
            Text("Not now", tableName: "Today", comment: "Dismisses the ask for a document")
          }
          .disabled(isDismissing)

          if failed {
            Text(
              "That didn't save. Try again.", tableName: "Today",
              comment: "A change couldn't be saved"
            )
            .font(.footnote)
            .foregroundStyle(.destructive)
          }
        }
      }
    }
  }

  private func dismiss() {
    isDismissing = true
    failed = false

    Task {
      switch await store.dismiss(request) {
      case .done:
        isDismissed = true
      case .failed:
        failed = true
      case .obsolete:
        break
      }

      isDismissing = false
    }
  }

  private var isNotice: Bool { request.examDocument == .notice }

  private var title: String {
    switch (request.reason, request.goalKind) {
    case (.classMaterial, _):
      String(
        localized: "Add your class material", table: "Today",
        comment: "Asks for a class's material, since the teacher's test isn't published")
    case (_, let kind) where kind != .exam:
      String(
        localized: "We couldn't find the official source", table: "Today",
        comment: "Research found no official source for the goal")
    case (.unverified, _):
      String(
        localized: "We couldn't confirm the exam's details", table: "Today",
        comment: "What research found didn't match the exam")
    case (.noOfficialSource, _):
      isNotice
        ? String(
          localized: "We couldn't find the official notice", table: "Today",
          comment: "Research found no exam notice")
        : String(
          localized: "We couldn't find the official guide", table: "Today",
          comment: "Research found no official guide for a language certificate")
    }
  }

  private var description: String {
    switch (request.reason, request.goalKind) {
    case (.classMaterial, _):
      String(
        localized:
          "Your teacher's test isn't published anywhere. Upload the slides, notes or list of topics so your plan follows your class.",
        table: "Today", comment: "Why a class's material is asked for")
    case (_, let kind) where kind != .exam:
      String(
        localized: "Upload the official text or guide you study from so your lessons follow it.",
        table: "Today", comment: "Why the goal's official source is asked for")
    case (.unverified, _):
      isNotice
        ? String(
          localized:
            "What we found didn't match the exam's details. Upload the official notice so your plan follows the real exam.",
          table: "Today", comment: "Why the exam notice is asked for")
        : String(
          localized:
            "What we found didn't match the exam's details. Upload the official guide so your plan follows the real exam.",
          table: "Today", comment: "Why a language certificate's official guide is asked for")
    case (.noOfficialSource, _):
      isNotice
        ? String(
          localized: "Upload the notice so your plan follows the real exam.", table: "Today",
          comment: "Why the exam notice is asked for")
        : String(
          localized: "Upload the official guide so your plan follows the real exam.",
          table: "Today", comment: "Why a language certificate's official guide is asked for")
    }
  }

  private var action: String {
    if request.reason == .classMaterial {
      return String(
        localized: "Upload your material", table: "Today",
        comment: "Opens the ways to add a class's material")
    }

    if request.goalKind != .exam {
      return String(
        localized: "Upload a document", table: "Today",
        comment: "Opens the ways to add the goal's official source")
    }

    return isNotice
      ? String(
        localized: "Upload the notice", table: "Today",
        comment: "Opens the ways to add the exam notice")
      : String(
        localized: "Upload the official guide", table: "Today",
        comment: "Opens the ways to add a language certificate's official guide")
  }
}
