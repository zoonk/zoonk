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
      .sectionTitleStyle()
    }
  }
}

/// A course the learner took before goals existed, offered as a goal to plan. On a Today with a goal
/// it's a card with its buttons; for a learner with no goal its buttons are the page's bottom bar.
struct SuggestedGoalSection: View {
  let suggestion: SuggestedGoal
  @Bindable var answer: SuggestedGoalAnswer
  var buttonsInBar = false

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 4) {
        Text(
          "Continue \(suggestion.title)?", tableName: "Today",
          comment: "Offers a goal from the learner's last course"
        )
        .typeStyle(.body.weight(.semibold))

        Text("Build a plan in 1 minute.", tableName: "Today", comment: "Suggested goal's promise")
          .foregroundStyle(.mutedForeground)
      }

      if !buttonsInBar {
        SuggestedGoalButtons(suggestion: suggestion, answer: answer)
          .controlSize(.large)
          .buttonSizing(.flexible)
      }
    } header: {
      Label {
        Text(
          "Suggested goal", tableName: "Today", comment: "A goal from the learner's last course")
      } icon: {
        Image(systemName: "safari")
      }
      .sectionTitleStyle()
    } footer: {
      SectionFooter {
        if answer.failed, !buttonsInBar {
          FailureLine(message: SuggestedGoalAnswer.failure)
        }
      }
    }
  }
}

/// Not now, then Start: the order the bottom bar puts them in, main action last.
struct SuggestedGoalButtons: View {
  @Environment(AppRouter.self) private var router
  @Environment(TodayStore.self) private var store

  let suggestion: SuggestedGoal
  let answer: SuggestedGoalAnswer

  var body: some View {
    BusyButton(isBusy: answer.answering == false) {
      respond(accepted: false)
    } label: {
      Text("Not now", tableName: "Today", comment: "Dismisses the suggested goal")
    }
    .buttonStyle(.outline)
    .disabled(answer.answering == true)

    BusyButton(isBusy: answer.answering == true) {
      respond(accepted: true)
    } label: {
      Text("Start", tableName: "Today", comment: "Accepts the suggested goal")
    }
    .buttonStyle(.mainAction)
    .keyboardShortcut(.defaultAction)
    .disabled(answer.answering == false)
  }

  private func respond(accepted: Bool) {
    Task { await answer.respond(to: suggestion, accepted: accepted, store: store, router: router) }
  }
}

@MainActor
@Observable
final class SuggestedGoalAnswer {
  static let failure = LocalizedStringResource(
    "We couldn't save your answer. Try again.", table: "Today",
    comment: "Answering the suggested goal failed")

  private(set) var answering: Bool?
  private(set) var failed = false

  func respond(
    to suggestion: SuggestedGoal, accepted: Bool, store: TodayStore, router: AppRouter
  ) async {
    answering = accepted
    failed = false

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

/// Main's `TodayExamChoice`: equal options, one under the other in their order. Once picked, it
/// says what the plan studies, with Undo.
struct TodayExamChoiceSection: View {
  @Environment(PlanStore.self) private var plans

  let goalID: String
  let choice: TodayView.ExamChoice?
  /// Kept above the panes, so folding keeps the answer and the options ticked.
  @Binding var editor: PlanEditor?
  @Binding var draft: [String]

  var body: some View {
    if let editor, case .applied(let change, let sentence) = editor.latest {
      Section {
        Text(sentence)

        if change.canUndo {
          BusyButton(isBusy: editor.isSaving, icon: .undo) {
            Task { await editor.undo() }
          } label: {
            Text("Undo", tableName: "Today", comment: "Undoes a plan change the learner applied")
          }
        }

        failure
      }
    } else if let choice {
      Section {
        Label {
          VStack(alignment: .leading, spacing: 4) {
            Group {
              if choice.take > 1 {
                Text(
                  "\(choice.group): which ones will you take?", tableName: "Plan",
                  comment:
                    "Asks which options of an exam's choice, like the modules a course takes, the learner takes; they take several"
                )
              } else {
                Text(
                  "\(choice.group): which one will you take?", tableName: "Plan",
                  comment: "Asks which option of an exam's choice the learner takes")
              }
            }
            .typeStyle(.body.weight(.semibold))

            Text(choice.leftOut.line)
              .foregroundStyle(.mutedForeground)

            if choice.take > 1 {
              Text.examPickLimit(choice.take)
                .foregroundStyle(.mutedForeground)
            }
          }
        } icon: {
          Image(systemName: "signpost.right")
        }

        Group {
          if choice.take > 1 {
            ExamOptionToggles(options: choice.options, take: choice.take, picked: $draft)

            Button {
              pick(draft, in: choice.group)
            } label: {
              Text(
                "Save", tableName: "Plan", comment: "Saves the options picked for an exam's choice")
            }
            .disabled(draft.isEmpty)
          } else {
            ForEach(choice.options, id: \.name) { option in
              Button(option.shortName ?? option.name) {
                pick([option.name], in: choice.group)
              }
            }
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
      FailureLine(
        message: LocalizedStringResource(
          "That didn't save. Try again.", table: "Today",
          comment: "A change couldn't be saved")
      )
      .typeStyle(.note)
    }
  }

  private func pick(_ subjects: [String], in group: String) {
    let editor = editor ?? PlanEditor(goalId: goalID, store: plans)
    self.editor = editor

    Task {
      if await editor.chooseExamOptions(subjects, in: group),
        case .applied(_, let sentence) = editor.latest
      {
        announcePolitely(sentence)
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
              .typeStyle(.body.weight(.semibold))
            Text(description)
              .foregroundStyle(.mutedForeground)
          }
        } icon: {
          Image(systemName: "doc.text.magnifyingglass")
        }
        .announcesStatus(answered ? thanks : nil)

        if answered {
          Text(thanks)
        } else {
          MaterialAttachControls(goal: (request.goalId, request.language), draft: $draft) {
            Label {
              Text(action)
            } icon: {
              Image(systemName: "arrow.up.doc")
            }
          } onAttached: { source in
            switch await store.answer(request, sourceID: source.id) {
            case .done(.alreadyRead):
              throw OnboardingError.alreadyRead
            case .failed(let error):
              throw error
            case .done(.answered), .obsolete:
              onAnswered()
            }
          }

          Button(action: dismiss) {
            Text("Not now", tableName: "Today", comment: "Dismisses the ask for a document")
          }
          .disabled(isDismissing)

          if failed {
            FailureLine(
              message: LocalizedStringResource(
                "That didn't save. Try again.", table: "Today",
                comment: "A change couldn't be saved")
            )
            .typeStyle(.note)
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

  private var thanks: String {
    String(
      localized: "Thanks. We're reading it now, and your plan will update in a few minutes.",
      table: "Today", comment: "After the learner uploaded the document research asked for")
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

/// Main's `TodayFocusTest`: in a short exam plan's first week, the Focus test for a learner who
/// hasn't started it. Answered with "Not now", it stays while the learner is here to say what the
/// answer did; gone for any other reason, such as a test taken since, it's gone here too.
struct TodayFocusTestSection: View {
  let goalID: String
  let offer: FocusTestSummary.Size?
  /// Kept by Today for the visit, since Today stops holding the suggestion once it's dismissed.
  @Binding var dismissed: Bool
  let onAnswer: () -> Void

  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var plans
  @State private var kept: FocusTestSummary.Size?
  @State private var isOpen = false
  @State private var isDismissing = false
  @State private var failed = false

  var body: some View {
    let shown = offer ?? (isDismissing ? kept : nil)

    if dismissed || shown != nil {
      Section {
        if dismissed {
          SuggestionLine {
            StatusMark(status: .done)
          } summary: {
            Text(Self.noted)
              .typeWeight(.medium)
              .foregroundStyle(Color(.foreground))
          } action: {
            EmptyView()
          }
          .listRowSeparator(.hidden)
        } else if let shown {
          SuggestionLine {
            SuggestionMark(kind: .symbol("scope"))
          } summary: {
            Text(
              "The Focus test shows what to study most.", tableName: "Today",
              comment: "Today's suggestion of the Focus test, in one line")
          } action: {
            SuggestionOpen(isOpen: $isOpen) {
              details(shown)
            }
          }
          .listRowSeparator(.hidden)
        }
      }
      .announcesStatus(dismissed ? String(localized: Self.noted) : nil)
      .onAppear { kept = offer ?? kept }
      .onChange(of: offer) { kept = offer ?? kept }
    }
  }

  private static let noted = LocalizedStringResource(
    "You can take the test from your plan.", table: "Today",
    comment: "After the learner dismissed Today's suggestion of the Focus test")

  @ViewBuilder
  private func details(_ shown: FocusTestSummary.Size) -> some View {
    Text(FocusTestCopy.title(findsFocus: true))
      .typeStyle(.body.weight(.semibold))
      .foregroundStyle(Color(.foreground))

    Text(
      "A \(studyDuration(minutes: shown.minutes)) test shows what you already know, so more of your time goes to what you need most. It never removes a subject.",
      tableName: "Today",
      comment:
        "What the Focus test is and why, on Today; the argument is how long it takes, such as \"15 min\""
    )
    .foregroundStyle(.mutedForeground)

    ButtonRow {
      Button {
        isOpen = false
        router.open(.focusTest(goalId: goalID, startsTest: true))
      } label: {
        Text("Start", tableName: "Today", comment: "Starts the Focus test")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.mainAction)

      BusyButton(isBusy: isDismissing) {
        dismiss()
      } label: {
        Text(FocusTestCopy.notNow)
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.outline)
    }
    .disabled(isDismissing)

    if failed {
      SuggestionSaveError()
    }
  }

  private func dismiss() {
    guard !isDismissing else {
      return
    }

    onAnswer()
    isDismissing = true
    failed = false

    Task {
      defer { isDismissing = false }

      switch await plans.updateFocusTest(goalId: goalID, FocusTestControls(suggestion: .dismissed))
      {
      case .done:
        dismissed = true
        isOpen = false
      case .failed:
        failed = true
      case .obsolete:
        break
      }
    }
  }
}

/// The exam's last days and "How did it go?", a suggestion like the others: its line, then a sheet
/// with the day's checklist and the way to the exam.
struct TodayExamMomentSection: View {
  @Environment(AppRouter.self) private var router
  @State private var isOpen = false

  let moment: ExamMoment
  /// Kept above the panes while the learner stays, as the Exam screen keeps its own.
  @Binding var checked: Set<ExamView.ChecklistItem>

  var body: some View {
    if let words = moment.words {
      Section {
        SuggestionLine {
          SuggestionMark(kind: .symbol(moment.icon))
        } summary: {
          Text(words.title)
        } action: {
          SuggestionOpen(isOpen: $isOpen) {
            details(words)
          }
        }
        .listRowSeparator(.hidden)
      }
    }
  }

  @ViewBuilder
  private func details(_ words: (title: String, body: String)) -> some View {
    Text(words.title)
      .typeStyle(.body.weight(.semibold))
      .foregroundStyle(Color(.foreground))
      .accessibilityAddTraits(.isHeader)

    if let day = moment.dayLine {
      Text(verbatim: day)
        .typeStyle(.data)
    }

    Text(words.body)
      .foregroundStyle(.mutedForeground)

    ExamChecklistRows(moment: moment, checked: $checked)

    if let tools = moment.toolsLine {
      Text(tools)
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    }

    Button {
      isOpen = false
      router.open(.exam)
    } label: {
      Group {
        if moment.stage == .afterExam {
          Text(
            "Add your result", tableName: "Today",
            comment: "Opens the exam to add the official result")
        } else {
          Text("See your exam", tableName: "Today", comment: "Opens the exam")
        }
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.mainAction)
  }
}
