import SwiftUI

/// Main's `TodayChangeNotice`: a correction to the source material the goal follows.
struct TodaySourceChangeSection: View {
  let message: String
  @Environment(\.isPaneSplit) private var isBeside

  var body: some View {
    Section {
      if isBeside {
        TodaySuggestionCard {
          SuggestionHeader(
            Text("What changed", tableName: "Today", comment: "A change to the goal's sources"))
          SuggestionDescription(Text(message), color: Color(.foreground))
        }
      } else {
        SuggestionLine {
          SuggestionMark(kind: .symbol("doc.badge.clock"))
        } summary: {
          Text(message)
            .typeWeight(.medium)
            .lineLimit(nil)
        } action: {
          EmptyView()
        }
        .listRowSeparator(.hidden)
      }
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
      TodaySuggestionCard {
        VStack(alignment: .leading, spacing: 4) {
          SuggestionHeader(
            Text(
              "Continue \(suggestion.title)?", tableName: "Today",
              comment: "Offers a goal from the learner's last course"))

          SuggestionDescription(
            Text(
              "Build a plan in 1 minute.", tableName: "Today", comment: "Suggested goal's promise"))
        }

        if !buttonsInBar {
          // A card's answers under its words, small, as main's suggestion panel draws them.
          ButtonRow {
            SuggestedGoalButtons(suggestion: suggestion, answer: answer)
          }
          .controlSize(.small)
        }
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
    answer.respond(to: suggestion, accepted: accepted, store: store, router: router)
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
  @ObservationIgnored private var sent: Task<Void, Never>?

  /// The answer is the visit's, not the buttons': they're drawn again when Today splits into panes
  /// or joins them, and setup still opens. The screen that owns it calls `leave()` as it closes.
  func respond(
    to suggestion: SuggestedGoal, accepted: Bool, store: TodayStore, router: AppRouter
  ) {
    sent = Task {
      await send(suggestion, accepted: accepted, store: store, router: router)
    }
  }

  /// Leaving keeps the answer, which the store still saves, and shows nothing of it, whether it
  /// worked or failed: the next visit starts clean, and its own answer is the only one it shows.
  func leave() {
    sent?.cancel()
    answering = nil
    failed = false
  }

  private func send(
    _ suggestion: SuggestedGoal, accepted: Bool, store: TodayStore, router: AppRouter
  ) async {
    answering = accepted
    failed = false

    let result = await store.answer(suggestion, accepted: accepted)

    guard !Task.isCancelled else {
      return
    }

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
        SuggestionResult(text: sentence)

        if change.canUndo {
          BusyButton(isBusy: editor.isSaving, icon: .undo) {
            editor.run { await editor.undo() }
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
            SuggestionHeader(Text.examChoiceQuestion(group: choice.group, take: choice.take))

            SuggestionDescription(Text.examChoiceDescription(take: choice.take))
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

    editor.run {
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

/// What the learner answered the upload request with, kept by Today while they stay, with what
/// reading it found.
struct AnsweredUpload: Equatable {
  let request: TodayView.UploadRequest
  var source: AttachedSource

  /// Reading it found nothing, so the request asks again.
  var isUnreadable: Bool { source.readStatus == .unreadable }
}

/// Main's `UploadRequestClient`: research couldn't read the official document or class material,
/// so the learner can upload it, and research reads it instead, or dismiss the ask.
struct TodayUploadRequestSection: View {
  @Environment(TodayStore.self) private var store
  @Environment(OnboardingStore.self) private var onboarding
  @Environment(\.scenePhase) private var scenePhase

  let request: TodayView.UploadRequest
  /// Answered here, it thanks the learner while they stay and it's being read, whatever Today
  /// reads since.
  let answer: AnsweredUpload?
  @Binding var draft: MaterialDraft
  /// Today's, ended as its visit ends; true once Not now saved.
  let dismissal: VisitRequest<Bool>
  let onAnswered: (AttachedSource) -> Void
  /// Once reading the answer ends: readable, or with nothing to read on it.
  let onRead: (SourceReadStatus) -> Void

  private var answered: Bool {
    answer.map { !$0.isUnreadable } ?? false
  }

  /// The upload that last answered it with nothing to read on it, by name.
  private var unreadableTitle: String? {
    if let answer, answer.isUnreadable {
      answer.source.title ?? ""
    } else {
      request.unreadableUpload?.title
    }
  }

  var body: some View {
    if dismissal.outcome != true {
      Section {
        // Main's suggestion panel: its words, what went wrong with the last upload, then the ways
        // to answer it, all on one edge.
        TodaySuggestionCard {
          VStack(alignment: .leading, spacing: 4) {
            SuggestionHeader(Text(title))
            SuggestionDescription(Text(description))

            // A newer upload's failure takes its place.
            if !answered, draft.error == nil, let unreadableTitle {
              let line = LocalizedStringResource.unreadableMaterial(title: unreadableTitle)

              SuggestionDescription(Text(line), color: .destructiveText)
                .announcesAlert(String(localized: line))
            }
          }
          .announcesStatus(answered ? thanks : nil)

          if answered {
            SuggestionResult(text: thanks)
          } else {
            actions
          }
        }
      }
      // Read only: an answered upload is followed while it's read, to ask again if it can't be,
      // and checked again as soon as the learner comes back to it.
      .task(id: scenePhase == .active ? answer : nil) {
        if scenePhase == .active {
          await followAnswer()
        }
      }
    }
  }

  /// The ways to add the document and Not now, then what adding it said, under them as main's.
  @ViewBuilder private var actions: some View {
    ButtonRow(wraps: true) {
      MaterialAttachMenu(goal: (request.goalId, request.language), draft: $draft) {
        Label {
          Text(action)
        } icon: {
          Image(systemName: "arrow.up.doc")
        }
      } save: { source in
        try await answer(with: source)
      } onAttached: { source in
        onAnswered(source)
      }
      .menuStyle(.button)
      .buttonStyle(.outline)

      BusyButton(isBusy: dismissal.isRunning, action: dismiss) {
        Text("Not now", tableName: "Today", comment: "Dismisses the ask for a document")
      }
      .buttonStyle(.outline)
    }
    .controlSize(.small)

    MaterialAttachProgress(goal: (request.goalId, request.language), draft: $draft) { source in
      try await answer(with: source)
    } onAttached: { source in
      onAnswered(source)
    }

    if dismissal.outcome == false {
      FailureLine(
        message: LocalizedStringResource(
          "That didn't save. Try again.", table: "Today",
          comment: "A change couldn't be saved")
      )
      .typeStyle(.note)
    }
  }

  /// Answers the ask with the added source; a throw shows as a failure to add it.
  private func answer(with source: AttachedSource) async throws {
    // Nothing to read on it: answering would only bring the ask back, so it's kept as this
    // answer, which asks again and names it above the buttons.
    guard source.readStatus != .unreadable else {
      return
    }

    switch await store.answer(request, sourceID: source.id) {
    case .done(.alreadyRead):
      throw OnboardingError.alreadyRead
    case .done(.unreadable):
      throw OnboardingError.unreadable(title: source.title ?? "")
    case .failed(let error):
      throw error
    case .done(.answered), .obsolete:
      break
    }
  }

  /// While the answered upload is read; once reading it ends, Today keeps what it found, so a
  /// readable one isn't checked again and one with nothing to read on it brings the ask back.
  private func followAnswer() async {
    guard let answer, answer.source.readStatus == .reading else {
      return
    }

    while true {
      do {
        let status = try await onboarding.readStatus(sourceID: answer.source.id)

        if status != .reading {
          onRead(status)
          return
        }
      } catch {
        // Asked again on the next beat.
      }

      do {
        try await Task.sleep(for: .seconds(3))
      } catch {
        return
      }
    }
  }

  private func dismiss() {
    dismissal.run { [store, request] in
      switch await store.dismiss(request) {
      case .done: true
      case .failed: false
      case .obsolete: nil
      }
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
  /// Kept by Today for the visit, since Today stops holding the suggestion once it's dismissed;
  /// true once Not now saved.
  let dismissal: VisitRequest<Bool>
  let onAnswer: () -> Void

  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var plans
  @State private var kept: FocusTestSummary.Size?
  @State private var isOpen = false

  private var dismissed: Bool { dismissal.outcome == true }

  var body: some View {
    let shown = offer ?? (dismissal.isRunning ? kept : nil)

    if dismissed || shown != nil {
      Section {
        if dismissed {
          SuggestionLine {
            StatusMark(status: .done)
          } summary: {
            SuggestionResult(text: String(localized: Self.noted))
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
            SuggestionOpen(
              isOpen: $isOpen,
              note: dismissal.outcome == false ? BarNote(SuggestionSaveError.message) : nil
            ) {
              details(shown)
            } actions: {
              BusyButton(isBusy: dismissal.isRunning) {
                dismiss()
              } label: {
                Text(FocusTestCopy.notNow)
              }
              .buttonStyle(.outline)
              .disabled(dismissal.isRunning)

              Button {
                isOpen = false
                router.open(.focusTest(goalId: goalID, startsTest: true))
              } label: {
                Text(FocusTestCopy.start)
              }
              .buttonStyle(.mainAction)
              .disabled(dismissal.isRunning)
            }
          }
          .listRowSeparator(.hidden)
        }
      }
      .announcesStatus(dismissed ? String(localized: Self.noted) : nil)
      .onAppear { kept = offer ?? kept }
      .onChange(of: offer) { kept = offer ?? kept }
      .onChange(of: isOpen) {
        if !isOpen && dismissal.outcome == false {
          dismissal.outcome = nil
        }
      }
    }
  }

  private static let noted = LocalizedStringResource(
    "You can take the test from your plan.", table: "Today",
    comment: "After the learner dismissed Today's suggestion of the Focus test")

  @ViewBuilder
  private func details(_ shown: FocusTestSummary.Size) -> some View {
    SuggestionHeader(Text(FocusTestCopy.title(findsFocus: true)))

    SuggestionDescription(
      Text(
        "A \(studyDuration(minutes: shown.minutes)) test shows what you already know, so more of your time goes to what you need most. It never removes a subject.",
        tableName: "Today",
        comment:
          "What the Focus test is and why, on Today; the argument is how long it takes, such as \"15 min\""
      ))
  }

  private func dismiss() {
    guard !dismissal.isRunning else {
      return
    }

    onAnswer()

    dismissal.run { [plans, goalID] in
      switch await plans.updateFocusTest(
        goalId: goalID, FocusTestControls(suggestion: .dismissed))
      {
      case .done: true
      case .failed: false
      case .obsolete: nil
      }
    } then: { dismissed in
      if dismissed == true {
        isOpen = false
      } else if !isOpen {
        dismissal.outcome = nil
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
          // Its opener says what the card leads to, the words of the sheet's main action.
          SuggestionOpen(isOpen: $isOpen, label: openLabel) {
            details(words)
          } actions: {
            Button {
              isOpen = false
              router.open(.exam)
            } label: {
              openLabel
            }
            .buttonStyle(.mainAction)
          }
        }
        .listRowSeparator(.hidden)
      }
    }
  }

  private var openLabel: Text {
    moment.stage == .afterExam
      ? Text(
        "Add your result", tableName: "Today",
        comment: "Opens the exam to add the official result")
      : Text("See your exam", tableName: "Today", comment: "Opens the exam")
  }

  @ViewBuilder
  private func details(_ words: ExamMoment.Words) -> some View {
    SuggestionHeader(Text(words.title))

    if let day = moment.dayFacts {
      FactSegments(facts: day)
        .typeStyle(.data)
    }

    SuggestionDescription {
      ExamMomentBody(words: words)
    }

    ExamChecklistRows(moment: moment, checked: $checked)

    if let tools = moment.toolsLine {
      Text(tools)
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    }
  }
}
