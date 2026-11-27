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
      .sheetClose { dismiss() }
    }
    .presentationDetents([.medium, .large])
  }
}
