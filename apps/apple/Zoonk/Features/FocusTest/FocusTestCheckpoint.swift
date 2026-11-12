import SwiftUI

/// Main's `FocusTestCheckpoint`: where to focus, the most needed subject first. On a plan that's
/// already there it first asks before changing the plan, and then holds the learner's other
/// choices: changing the focus, every subject's answers and the test's questions in sessions.
struct FocusTestCheckpoint: View {
  let focusTest: FocusTest
  let host: FocusTestHost
  let goalID: String
  var changeFocus: (() -> Void)?
  let pressed: FocusTestPress?
  let failed: Bool
  let onDone: () -> Void
  let onContinueTest: () -> Void

  @Environment(PlanStore.self) private var plans
  /// How the learner answered the proposal on this visit.
  @State private var decision: PlanChangeDecision?
  /// The change as the answer left it, which says whether it can still be undone.
  @State private var answered: TodayView.PlanChange?
  @State private var deciding: PlanChangeDecision?
  @State private var decideFailed = false
  /// What the sessions switch last saved on this visit.
  @State private var savedQuestions: FocusTestSessionQuestions?
  @State private var isSwitching = false
  @State private var switchFailed = false
  @State private var showsSubjects = false

  var body: some View {
    Group {
      if let proposal = waitingProposal {
        proposalScreen(proposal)
      } else {
        result
      }
    }
    // The answer's buttons leave with it, so VoiceOver says what it did.
    .announcesStatus(decision.map(Self.answerLine))
  }

  private var focus: FocusTest.Focus? { focusTest.checkpoint?.focus }

  /// The focus the test proposes for a plan that's already there, until the learner answers it.
  private var waitingProposal: TodayView.PlanChange? {
    guard host == .plan, decision == nil, focus?.state == .proposed,
      let proposal = focus?.proposal, proposal.canApply
    else {
      return nil
    }

    return proposal
  }

  // MARK: - Proposal

  /// Main's `FocusProposal`: a question, so its answers are the screen's buttons.
  private func proposalScreen(_ proposal: TodayView.PlanChange) -> some View {
    ZoonkList {
      StepHeader(
        subject: String(localized: FocusTestCopy.name),
        title: Text(
          "Give these subjects more time?", tableName: "FocusTest",
          comment: "Title of the focus the Focus test proposes for a plan already there"),
        description: Text(
          "Your time can't cover everything before your exam.", tableName: "FocusTest",
          comment: "Why the Focus test proposes giving some subjects more time"))

      focusList

      Section {
        PlanEffectDiff(effect: proposal.effect, today: PlanDate.isoDate(.now))
          .listRowBackground(Color.clear)
      }

      FocusTestSaveFailure(failed: decideFailed)

      StepButtons(
        continueLabel: Text(FocusTestCopy.updatePlan),
        continueIcon: nil,
        skipLabel: Text(FocusTestCopy.notNow),
        skipIcon: nil,
        onContinue: { decide(.applied, on: proposal) },
        onSkip: { decide(.declined, on: proposal) })
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, deciding != nil)
  }

  // MARK: - Result

  private var result: some View {
    let rows = focusTest.focusRows
    let lessonsSkipped = focusTest.checkpoint?.lessonsSkipped ?? 0
    return ZoonkList {
      Section {
        PageHeader(
          rows.isEmpty
            ? Text(
              "Your starting point is set", tableName: "FocusTest",
              comment: "Title of the Focus test's result when it has no subjects to focus on")
            : Text(
              "Here's where to focus", tableName: "FocusTest",
              comment: "Title of the Focus test's result: the subjects to give more time"),
          eyebrow: host == .onboarding
            ? Text(
              "Answers saved", tableName: "FocusTest",
              comment:
                "Over the Focus test's result in onboarding: nothing the learner answered was lost")
            : Text(FocusTestCopy.name),
          supporting: Text(line(hasRows: !rows.isEmpty, lessonsSkipped: lessonsSkipped))
        )
        .eyebrowDone(host == .onboarding)
        .listRowBackground(Color.clear)

        if decision == .applied, let answered, answered.canUndo {
          BusyButton(isBusy: deciding == .undone, icon: .undo) {
            decide(.undone, on: answered)
          } label: {
            Text(
              "Undo", tableName: "FocusTest",
              comment: "Undoes the focus the learner just applied from the Focus test")
          }
          .buttonStyle(.outline)
          .controlSize(.small)
          .disabled(deciding != nil)
          .listRowBackground(Color.clear)
          .listRowSeparator(.hidden)
        }
      }

      if !rows.isEmpty {
        focusList

        if lessonsSkipped > 0 {
          Section {
            Text(
              "Your plan also skips \(lessonsSkipped) lessons you already know.",
              tableName: "FocusTest",
              comment: "Under the Focus test's suggested subjects, when its answers skip lessons"
            )
            .foregroundStyle(.mutedForeground)
            .listRowBackground(Color.clear)
          }
        }
      }

      if host == .plan {
        choices(canChangeFocus: !rows.isEmpty)
      }

      FocusTestSaveFailure(failed: failed || decideFailed)

      StepButtons(
        continueLabel: host == .onboarding
          ? Text(FocusTestCopy.continueLabel)
          : Text(
            "Done", tableName: "FocusTest",
            comment: "Leaves the Focus test's result for the plan"),
        continueIcon: host == .onboarding ? .forward : .check,
        skipLabel: Text(
          "Answer more questions", tableName: "FocusTest",
          comment: "Opens another Focus test sitting from its result on the plan"),
        skipIcon: .play, onContinue: onDone,
        onSkip: host == .plan && focusTest.offer != nil ? onContinueTest : nil)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, pressed != nil)
    .sheet(isPresented: $showsSubjects) {
      FocusTestSubjectsSheet(subjects: focusTest.subjects)
        .zoonkStyles()
    }
  }

  /// The subjects to give more time, numbered from the most needed.
  private var focusList: some View {
    Section {
      ForEach(Array(focusTest.focusRows.enumerated()), id: \.element.id) { index, row in
        ListRow(Text(row.subject.shown), number: index + 1) {
          EmptyView()
        } trailing: {
          EmptyView()
        }
      }
    }
  }

  /// What the plan does with the subjects, said once under the title.
  private func line(hasRows: Bool, lessonsSkipped: Int) -> String {
    guard hasRows else {
      return lessonsSkipped > 0
        ? String(
          localized: "Your plan skips \(lessonsSkipped) lessons you already know.",
          table: "FocusTest", comment: "Where the plan starts after the Focus test")
        : String(
          localized: "Your plan starts each subject from the basics.", table: "FocusTest",
          comment: "Where the plan starts after the Focus test, with nothing to skip yet")
    }

    if let decision {
      return Self.answerLine(decision)
    }

    switch focus?.state {
    case .current:
      return String(
        localized: "Your plan gives these subjects more time.", table: "FocusTest",
        comment: "Under the Focus test's result when the plan already follows it")
    case .handPicked:
      return String(
        localized: "Your plan keeps the focus you chose. This is what the test suggests.",
        table: "FocusTest",
        comment: "Under the Focus test's result beside a focus the learner chose")
    case .declined:
      return String(
        localized: "You kept your plan as it is. This is what the test suggests.",
        table: "FocusTest",
        comment: "Under the Focus test's result after the learner said Not now to it, or undid it")
    case .ifTimeShort, .proposed, .suggested, nil:
      return String(localized: FocusTestCopy.basedOnAnswers)
    }
  }

  private static func answerLine(_ decision: PlanChangeDecision) -> String {
    switch decision {
    case .applied:
      String(
        localized: "Your plan now gives these subjects more time.", table: "FocusTest",
        comment: "After applying the focus the Focus test proposed")
    case .declined, .seen:
      String(
        localized: "Your plan stays as it was.", table: "FocusTest",
        comment: "After declining the focus the Focus test proposed")
    case .undone:
      String(
        localized: "Undone. Your plan is back as it was.", table: "FocusTest",
        comment: "After undoing the focus the Focus test proposed")
    }
  }

  /// On a plan: what the learner can do with the result.
  private func choices(canChangeFocus: Bool) -> some View {
    let questions = savedQuestions ?? focusTest.sessionQuestions

    return Section {
      if let changeFocus, canChangeFocus, focus?.state != .ifTimeShort {
        Button(action: changeFocus) {
          ListRow(
            Text(
              "Change focus", tableName: "FocusTest",
              comment: "Opens the choice of the subjects the plan gives more time")
          )
          .disclosureChevron()
        }
      }

      Button {
        showsSubjects = true
      } label: {
        ListRow(
          Text(
            "See all subjects", tableName: "FocusTest",
            comment: "Opens every subject with how its Focus test answers went")
        )
        .disclosureChevron()
      }

      // Sessions have nothing left to ask once it's off.
      if questions != .off {
        SettingToggle(
          isOn: Binding(
            get: { questions != .paused },
            set: { setQuestions($0 ? .on : .paused, from: questions) }),
          title: Text(
            "Ask a few more in my sessions", tableName: "FocusTest",
            comment: "Switch on the Focus test's result: sessions ask a few of its questions"),
          description: Text(
            "During your first week", tableName: "FocusTest",
            comment: "Under the switch for the Focus test's questions in sessions")
        )
        .disabled(isSwitching)
      }

      if switchFailed {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't save. Try again.", table: "FocusTest",
            comment: "A Focus test switch couldn't be saved"))
      }
    }
  }

  // MARK: - Saves

  private func decide(_ status: PlanChangeDecision, on change: TodayView.PlanChange) {
    guard deciding == nil else {
      return
    }

    deciding = status
    decideFailed = false

    Task {
      defer { deciding = nil }

      switch await plans.decide(goalId: goalID, changeId: change.id, decision: status) {
      case .done(let saved?):
        answered = saved
        decision = status
      case .done(nil), .failed:
        decideFailed = true
      case .obsolete:
        break
      }
    }
  }

  private func setQuestions(
    _ next: FocusTestSessionQuestions, from shown: FocusTestSessionQuestions
  ) {
    guard !isSwitching else {
      return
    }

    isSwitching = true
    switchFailed = false
    savedQuestions = next

    Task {
      defer { isSwitching = false }

      switch await plans.updateFocusTest(
        goalId: goalID, FocusTestControls(sessionQuestions: next))
      {
      case .done(let saved):
        savedQuestions = saved.sessionQuestions
      case .failed:
        savedQuestions = shown
        switchFailed = true
      case .obsolete:
        break
      }
    }
  }
}
