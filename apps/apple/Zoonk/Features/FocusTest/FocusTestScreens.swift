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

/// Main's `FocusTestInvitation`: what the test is, why it helps and what it costs.
struct FocusTestInvitation: View {
  let focusTest: FocusTest
  let host: FocusTestHost
  let pressed: FocusTestPress?
  let failed: Bool
  let onStart: () -> Void
  let onSkip: () -> Void

  var body: some View {
    let findsFocus = focusTest.suggestsFocus

    ZoonkList {
      StepHeader(
        subject: focusTest.offer.map { FocusTestCopy.offered(minutes: $0.minutes) },
        title: Text(FocusTestCopy.title(findsFocus: findsFocus)),
        description: Text(FocusTestCopy.offerLine(findsFocus: findsFocus)))

      FocusTestSaveFailure(failed: failed)
    }
    .bottomBar {
      StepButtons(
        continueLabel: Text(FocusTestCopy.start),
        skipLabel: host == .onboarding
          ? Text(
            "Skip for now", tableName: "FocusTest",
            comment: "Postpones the Focus test; it can be taken later from the plan")
          : Text(FocusTestCopy.notNow),
        onContinue: onStart, onSkip: onSkip)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, pressed != nil)
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
    TestOutcome(
      subject: String(localized: FocusTestCopy.name),
      title: Text(
        "Your answers are saved", tableName: "FocusTest",
        comment: "Title once a Focus test sitting has nothing more to ask"),
      continueLabel: Text(FocusTestCopy.seeResult), isSaving: isSaving, failed: failed,
      onContinue: onFinish)
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
            if let state = FocusTestCopy.state(of: subject) {
              Text(state)
            }
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
