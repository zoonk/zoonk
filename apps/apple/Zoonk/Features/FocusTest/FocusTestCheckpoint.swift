import SwiftUI

/// Main's `FocusTestCheckpoint`, "Your starting plan": where the plan starts, where it would give
/// more time, and every subject's answers so far.
struct FocusTestCheckpoint: View {
  let focusTest: FocusTest
  let end: FocusTest.Sitting.End?
  let subject: String
  let host: FocusTestHost
  let goalID: String
  var changeFocus: (() -> Void)?
  let pressed: FocusTestPress?
  let failed: Bool
  let onDone: () -> Void
  let onContinueTest: () -> Void

  @State private var showsSubjects = false
  /// How the learner answered the focus the test proposes; once answered, "Done" is filled again.
  @State private var proposalAnswer: PlanChangeDecision?

  var body: some View {
    let next = focusTest.offer
    let focus = focusTest.checkpoint?.focus
    let proposalWaits =
      host == .plan && focus?.state == .proposed && focus?.proposal?.canApply == true
      && proposalAnswer == nil

    ZoonkList {
      StepHeader(
        subject: subject,
        title: Text(
          "Your starting plan", tableName: "FocusTest",
          comment: "Title of what the Focus test's answers set in the plan"),
        description: Text(
          [
            FocusTestCopy.evidence(asked: focusTest.counts.asked, total: focusTest.counts.total),
            FocusTestCopy.endLine(end),
          ].compactMap(\.self).joined(separator: "\n")))

      if let checkpoint = focusTest.checkpoint {
        startingPoints(lessonsSkipped: checkpoint.lessonsSkipped)

        if let focus = checkpoint.focus, !focus.rows.isEmpty {
          FocusTestSuggestedFocus(
            focus: focus, goalID: goalID, decides: host == .plan, changeFocus: changeFocus,
            answer: $proposalAnswer)
        }
      }

      Section {
        Button {
          showsSubjects = true
        } label: {
          Text(
            "View all subjects", tableName: "FocusTest",
            comment: "Opens every subject with how its Focus test answers went")
        }
      } footer: {
        if focusTest.sessionQuestions == .on {
          SectionFooter {
            Text(FocusTestCopy.sessionQuestions)
          }
        }
      }

      if failed {
        Section {
          FailureLine(
            message: LocalizedStringResource(
              "That didn't save. Try again.", table: "Onboarding",
              comment: "A change couldn't be saved"))
        }
      }

      StepButtons(
        continueLabel: host == .onboarding
          ? Text(
            "Continue to daily time", tableName: "FocusTest",
            comment: "Leaves the Focus test's result for onboarding's daily time question")
          : Text(
            "Done", tableName: "FocusTest",
            comment: "Leaves the Focus test's result for the plan"),
        continueIcon: host == .onboarding ? .forward : .check,
        continueIsMain: !proposalWaits,
        skipLabel: next.map {
          Text(
            "Continue the test\u{00A0}· \(FocusTestCopy.about(minutes: $0.minutes))",
            tableName: "FocusTest",
            comment: "Opens another Focus test sitting; then about how long it takes")
        },
        skipIcon: .play, onContinue: onDone, onSkip: next.map { _ in onContinueTest })
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, pressed != nil)
    .sheet(isPresented: $showsSubjects) {
      FocusTestSubjectsSheet(subjects: focusTest.subjects, answered: true)
        .zoonkStyles()
    }
  }

  private func startingPoints(lessonsSkipped: Int) -> some View {
    Section {
      Group {
        if lessonsSkipped > 0 {
          Text(
            "Your plan skips \(lessonsSkipped) lessons you already know.", tableName: "FocusTest",
            comment: "Where the plan starts after the Focus test")
        } else {
          Text(
            "Your subjects start from the basics for now.", tableName: "FocusTest",
            comment: "Where the plan starts after the Focus test, with nothing to skip yet")
        }
      }
      .listRowBackground(Color.clear)
    } header: {
      SectionTitle(
        Text(
          "Where you'll start", tableName: "FocusTest",
          comment: "Section of the Focus test's result: the plan's starting points"))
    }
  }
}

/// Main's `SuggestedFocus`: up to three subjects with each one's real reason, and on a plan the
/// learner already has, the proposal to apply it.
private struct FocusTestSuggestedFocus: View {
  let focus: FocusTest.Focus
  let goalID: String
  /// On a plan already there, the proposal is answered here.
  let decides: Bool
  var changeFocus: (() -> Void)?
  @Binding var answer: PlanChangeDecision?

  var body: some View {
    Section {
      ForEach(focus.rows) { row in
        ListRow(Text(row.subject.shown), description: Text(FocusTestCopy.reason(row.reason)))
      }

      if decides, focus.state == .proposed, let proposal = focus.proposal {
        FocusTestProposal(proposal: proposal, goalID: goalID, decision: $answer)
      }

      if let changeFocus, [.current, .handPicked, .declined].contains(focus.state) {
        Button(action: changeFocus) {
          Text(
            "Change focus", tableName: "FocusTest",
            comment: "Opens the choice of the subjects the plan gives more time")
        }
      }
    } header: {
      VStack(alignment: .leading, spacing: 4) {
        SectionTitle(
          Text(
            "Suggested focus", tableName: "FocusTest",
            comment: "Section of the Focus test's result: subjects the plan could give more time"))

        if let intro {
          Text(intro)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
            .textCase(nil)
        }
      }
    }
  }

  private var intro: String? {
    guard answer != .applied else {
      return nil
    }

    let state =
      switch focus.state {
      case .ifTimeShort:
        String(
          localized: "If your time can't cover everything, your plan gives these more time.",
          table: "FocusTest", comment: "Suggested focus before the plan is shown")
      case .proposed:
        String(
          localized: "Your time can't cover everything. Your plan can give these more time.",
          table: "FocusTest", comment: "Suggested focus the learner can apply to their plan")
      case .current:
        String(
          localized: "Your plan gives these more time.", table: "FocusTest",
          comment: "Suggested focus the plan already follows")
      case .alreadyFits:
        String(
          localized: "Your plan already has time for these, so it doesn't need a focus.",
          table: "FocusTest",
          comment: "Suggested focus the plan's time already covers without a focus")
      case .handPicked:
        String(
          localized:
            "You chose your own focus, and your plan keeps it. This is what the test suggests.",
          table: "FocusTest", comment: "Suggested focus beside a focus the learner chose")
      case .declined:
        String(
          localized: "You kept your plan as it is.", table: "FocusTest",
          comment: "Suggested focus the learner said Not now to, or undid")
      }

    guard focus.basis == .importance else {
      return state
    }

    return [
      state,
      String(
        localized: "For now, this follows mainly what counts most in your exam.",
        table: "FocusTest",
        comment: "Suggested focus with no answer behind it yet: it follows the exam's weights"),
    ].joined(separator: " ")
  }
}

/// "Update my plan" / "Not now" on the focus the test proposes, with what it changes, and Undo.
private struct FocusTestProposal: View {
  let proposal: TodayView.PlanChange
  let goalID: String
  @Binding var decision: PlanChangeDecision?

  @Environment(PlanStore.self) private var plans
  /// The change as the answer left it, which says whether it can still be undone.
  @State private var answered: TodayView.PlanChange?
  @State private var pressed: PlanChangeDecision?
  @State private var failed = false

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if decision == nil {
        let today = PlanDate.isoDate(.now)
        let effect =
          (proposal.setsFocus ? planAreaEndTexts(proposal.effect, today: today) : [])
          + [planLessonsEffectText(proposal.effect)].compactMap(\.self)

        if !effect.isEmpty {
          Text(effect.joinedSentences())
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }

        PlanEffectDiff(effect: proposal.effect, today: today)
      }

      if let decision {
        answered(decision)
      } else {
        ButtonRow {
          if proposal.canApply {
            BusyButton(isBusy: pressed == .applied) {
              decide(.applied)
            } label: {
              Text(
                "Update my plan", tableName: "FocusTest",
                comment: "Applies the focus the Focus test proposes to the plan")
            }
            .buttonStyle(.mainAction)
          }

          BusyButton(isBusy: pressed == .declined) {
            decide(.declined)
          } label: {
            Text(
              "Not now", tableName: "FocusTest",
              comment: "Declines the focus the Focus test proposes")
          }
          .buttonStyle(.outline)
        }
        .controlSize(.small)
        .disabled(pressed != nil)
      }

      if failed {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't save. Try again.", table: "Onboarding",
            comment: "A change couldn't be saved"))
      }
    }
    .announcesStatus(decision.map(Self.result))
  }

  @ViewBuilder
  private func answered(_ decision: PlanChangeDecision) -> some View {
    if decision == .applied {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        Text(Self.result(decision))
          .frame(maxWidth: .infinity, alignment: .leading)

        if answered?.canUndo == true {
          BusyButton(isBusy: pressed == .undone, icon: .undo) {
            decide(.undone)
          } label: {
            Text(
              "Undo", tableName: "FocusTest",
              comment: "Undoes the focus the learner just applied from the Focus test")
          }
          .buttonStyle(.outline)
          .controlSize(.small)
        }
      }
    } else {
      Text(Self.result(decision))
    }
  }

  private static func result(_ decision: PlanChangeDecision) -> String {
    switch decision {
    case .applied:
      String(
        localized: "Done. Your plan now gives these more time.", table: "FocusTest",
        comment: "After applying the focus the Focus test proposed")
    case .undone:
      String(
        localized: "Undone. Your plan is back as it was.", table: "FocusTest",
        comment: "After undoing the focus the Focus test proposed")
    case .declined, .seen:
      String(
        localized: "Your plan stays as it was.", table: "FocusTest",
        comment: "After declining the focus the Focus test proposed")
    }
  }

  private func decide(_ status: PlanChangeDecision) {
    guard pressed == nil else {
      return
    }

    pressed = status
    failed = false

    Task {
      defer { pressed = nil }

      switch await plans.decide(goalId: goalID, changeId: proposal.id, decision: status) {
      case .done(let change?):
        answered = change
        decision = status
      case .done(nil), .failed:
        failed = true
      case .obsolete:
        break
      }
    }
  }
}
