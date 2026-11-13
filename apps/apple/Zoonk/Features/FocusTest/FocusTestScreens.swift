import SwiftUI

/// A save on a Focus test screen failed; the button that started it tries again.
struct FocusTestSaveFailure: View {
  let failed: Bool

  var body: some View {
    if failed {
      Section {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't save. Try again.", table: "Onboarding",
            comment: "A change couldn't be saved"))
      }
    }
  }
}

/// Main's `FocusTestInvitation`: what the test does for the learner and what it costs, with the
/// rest one tap away in How it works.
struct FocusTestInvitation: View {
  let focusTest: FocusTest
  let host: FocusTestHost
  let pressed: FocusTestPress?
  let failed: Bool
  let onStart: () -> Void
  let onSkip: () -> Void

  @State private var showsHowItWorks = false

  var body: some View {
    let findsFocus = focusTest.suggestsFocus

    ZoonkList {
      StepHeader(
        subject: focusTest.offer.map { FocusTestCopy.offered(minutes: $0.minutes) },
        title: Text(FocusTestCopy.title(findsFocus: findsFocus)),
        description: findsFocus
          ? Text(
            "Quick questions on your exam's subjects. Your plan skips what you already know, so your time goes where you need it most.",
            tableName: "FocusTest",
            comment: "What the Focus test is and why it helps, for an exam with a date")
          : Text(
            "Quick questions on your exam's subjects. Your plan skips what you already know.",
            tableName: "FocusTest",
            comment: "What the Focus test is, for an exam without a date or with one subject"))

      Section {
        Button {
          showsHowItWorks = true
        } label: {
          Text(
            "How it works", tableName: "FocusTest",
            comment: "Opens what to expect from the Focus test, from its offer"
          )
          .underline()
        }
        .listRowBackground(Color.clear)
      }

      FocusTestSaveFailure(failed: failed)
    }
    .bottomBar {
      StepButtons(
        continueLabel: Text(
          "Start the test", tableName: "FocusTest", comment: "Starts the Focus test"),
        skipLabel: host == .onboarding
          ? Text(
            "Skip for now", tableName: "FocusTest",
            comment: "Postpones the Focus test; it can be taken later from the plan")
          : Text(FocusTestCopy.notNow),
        onContinue: onStart, onSkip: onSkip)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, pressed != nil)
    .sheet(isPresented: $showsHowItWorks) {
      FocusTestHowItWorks(suggestsFocus: focusTest.suggestsFocus)
        .zoonkStyles()
    }
  }
}

/// Main's `FocusTestHowItWorks`: the test's rules, for whoever wants them before starting.
private struct FocusTestHowItWorks: View {
  let suggestsFocus: Bool

  var body: some View {
    FocusTestSheet(
      title: Text(
        "How it works", tableName: "FocusTest",
        comment: "Title of the sheet that says what to expect from the Focus test")
    ) {
      Section {
        ListRow(
          Text(
            "What counts most comes first", tableName: "FocusTest",
            comment: "A row of the Focus test's How it works sheet"),
          description: Text(
            "The test starts with the subjects that weigh most in your exam.",
            tableName: "FocusTest", comment: "How it works: under \"What counts most comes first\"")
        )
        ListRow(
          Text(
            "There's no grade", tableName: "FocusTest",
            comment: "A row of the Focus test's How it works sheet"),
          description: Text(
            "“I don't know yet” is a fine answer.", tableName: "FocusTest",
            comment: "How it works: under \"There's no grade\""))
        ListRow(
          Text(
            "Stop anytime", tableName: "FocusTest",
            comment: "A row of the Focus test's How it works sheet"),
          description: Text(
            "Each answer is saved.", tableName: "FocusTest",
            comment: "How it works: under \"Stop anytime\""))
        if suggestsFocus {
          ListRow(
            Text(
              "Focusing never removes a subject", tableName: "FocusTest",
              comment: "A row of the Focus test's How it works sheet"),
            description: Text(
              "The ones you need most get more time when your time can't cover everything.",
              tableName: "FocusTest",
              comment: "How it works: under \"Focusing never removes a subject\""))
        }
        ListRow(
          Text(
            "A few more in your first week", tableName: "FocusTest",
            comment: "A row of the Focus test's How it works sheet"),
          description: Text(
            "Your study sessions ask a few more of these questions. You can pause that.",
            tableName: "FocusTest", comment: "How it works: under \"A few more in your first week\""
          ))
      }
    }
  }
}

/// Main's `FocusTestResume`: an open sitting the learner left with answers in it.
struct FocusTestResume: View {
  let sitting: FocusTest.Sitting
  let answered: Int
  let pressed: FocusTestPress?
  let failed: Bool
  let onContinue: () -> Void
  let onSeeResult: () -> Void

  var body: some View {
    ZoonkList {
      StepHeader(
        subject: FocusTestCopy.left(minutes: sitting.minutes),
        title: Text(
          "Continue your test", tableName: "FocusTest",
          comment: "Title of an open Focus test sitting the learner came back to"),
        description: Text(
          "Your \(answered) answers are saved.", tableName: "FocusTest",
          comment: "Under \"Continue your test\": how many answers the open sitting saved"))

      FocusTestSaveFailure(failed: failed)
    }
    .bottomBar {
      StepButtons(
        continueLabel: Text(FocusTestCopy.continueLabel),
        skipLabel: Text(FocusTestCopy.seeResult),
        onContinue: onContinue, onSkip: onSeeResult)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, pressed != nil)
  }
}

/// A sitting that's over and not closed yet: the learner came back to it, or closing it failed.
struct FocusTestEnded: View {
  let isSaving: Bool
  let failed: Bool
  let onFinish: () -> Void

  var body: some View {
    ZoonkList {
      StepHeader(
        subject: String(localized: FocusTestCopy.name),
        title: Text(
          "Your answers are saved", tableName: "FocusTest",
          comment: "Title once a Focus test sitting has nothing more to ask"),
        description: nil)

      FocusTestSaveFailure(failed: failed)
    }
    .bottomBar {
      StepButtons(continueLabel: Text(FocusTestCopy.seeResult), onContinue: onFinish)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, isSaving)
  }
}

/// No question could be written: the step passes, and sessions find the starting points instead.
struct FocusTestUnavailable: View {
  let isSaving: Bool
  let failed: Bool
  let onContinue: () -> Void

  var body: some View {
    ZoonkList {
      StepHeader(
        title: Text(
          "Let's skip the questions", tableName: "Onboarding",
          comment: "No placement question could be written"),
        description: Text(
          "We couldn't prepare questions for this goal. Your first sessions will find your starting point instead.",
          tableName: "Onboarding", comment: "Why placement is skipped"))

      FocusTestSaveFailure(failed: failed)
    }
    .bottomBar {
      StepButtons(continueLabel: Text(FocusTestCopy.continueLabel), onContinue: onContinue)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, isSaving)
  }
}

/// Main's `FocusTestSubjectsSheet`: the exam's subjects in the notice's order, with how each one's
/// answers went.
struct FocusTestSubjectsSheet: View {
  let subjects: [FocusTest.Subject]

  var body: some View {
    FocusTestSheet(
      title: Text(
        "Subjects", tableName: "FocusTest", comment: "Title of the Focus test's subject list")
    ) {
      Section {
        ForEach(subjects) { subject in
          LabeledContent {
            Text(FocusTestCopy.state(of: subject))
          } label: {
            Text(subject.shown)
          }
        }
      }
    }
  }
}

/// A Focus test sheet: a titled list the learner closes.
private struct FocusTestSheet<Content: View>: View {
  let title: Text
  @ViewBuilder let content: Content

  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      ZoonkList {
        content
      }
      .navigationTitle(title)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button(role: .close) { dismiss() }
        }
      }
    }
    .presentationDetents([.medium, .large])
  }
}
