import SwiftUI

/// The time is the screen's one big number: it's what decides whether someone starts.
private struct SittingSize: View {
  let minutes: Int
  let facts: [String]

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 6) {
        BigQuantity(FocusTestCopy.about(minutes: minutes))

        Text(facts.joinedFacts())
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
      .accessibilityElement(children: .combine)
      .listRowBackground(Color.clear)
    }
  }
}

private struct SaveFailure: View {
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

/// Main's `FocusTestInvitation`: optional, with its length up front.
struct FocusTestInvitation: View {
  let focusTest: FocusTest
  let next: FocusTest.NextSitting
  let subject: String
  let host: FocusTestHost
  let pressed: FocusTestPress?
  let failed: Bool
  let onStart: () -> Void
  let onSkip: () -> Void

  @State private var showsSubjects = false

  var body: some View {
    ZoonkList {
      StepHeader(subject: subject, title: title, description: description)

      SittingSize(
        minutes: next.minutes,
        facts: [
          String(
            localized: "Optional", table: "FocusTest",
            comment: "The Focus test can be skipped"),
          FocusTestCopy.upTo(questions: next.questions),
          FocusTestCopy.subjects(focusTest.counts.total),
        ])

      Section {
        VStack(alignment: .leading, spacing: 6) {
          Text(
            "There's no grade. “I don't know yet” is a useful answer.", tableName: "FocusTest",
            comment: "On the Focus test's invitation")
          Text(
            "Stop whenever you need to. We save each answer.", tableName: "FocusTest",
            comment: "On the Focus test's invitation")
        }
        .listRowBackground(Color.clear)
      } footer: {
        if next.pastCeiling > 0 {
          SectionFooter {
            VStack(alignment: .leading, spacing: 4) {
              Text(
                [
                  String(
                    localized: "Your plan considers all \(focusTest.counts.total) subjects.",
                    table: "FocusTest",
                    comment: "The Focus test's invitation, when its sitting can't reach every subject"),
                  String(
                    localized:
                      "This sitting has up to \(next.questions) questions, so some subjects may not be checked.",
                    table: "FocusTest",
                    comment: "The Focus test's invitation, when its sitting can't reach every subject"),
                ].joined(separator: " "))

              Button {
                showsSubjects = true
              } label: {
                Text(
                  "View subjects", tableName: "FocusTest",
                  comment: "Opens the exam's subjects from the Focus test's invitation"
                )
                .underline()
              }
              .buttonStyle(.borderless)
            }
          }
        }
      }

      SaveFailure(failed: failed)

      StepButtons(
        continueLabel: Text(
          "Start the test", tableName: "FocusTest", comment: "Starts the Focus test"),
        continueIcon: .play,
        skipLabel: host == .onboarding
          ? Text(
            "Skip for now", tableName: "FocusTest",
            comment: "Postpones the Focus test; it can be taken later from the plan")
          : Text(
            "Not now", tableName: "FocusTest",
            comment: "Leaves the Focus test without taking it, back to the plan"),
        skipIcon: nil, onContinue: onStart, onSkip: onSkip)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, pressed != nil)
    .sheet(isPresented: $showsSubjects) {
      FocusTestSubjectsSheet(subjects: focusTest.subjects, answered: false)
        .zoonkStyles()
    }
  }

  private var title: Text {
    focusTest.dated
      ? Text(
        "Let's find where your study time should go", tableName: "FocusTest",
        comment: "Title of the Focus test's invitation, for an exam with a date")
      : Text(
        "Find where to start", tableName: "FocusTest",
        comment: "Title of the Focus test's invitation, for an exam without a date")
  }

  private var description: Text {
    focusTest.dated && focusTest.counts.total > 1
      ? Text(
        "Quick questions on your subjects, the ones that count most first. Your answers help your plan skip what you already know and suggest where to focus.",
        tableName: "FocusTest", comment: "What the Focus test is, for an exam with a date")
      : Text(
        "Quick questions on your subjects, the ones that count most first. Your answers help your plan skip what you already know.",
        tableName: "FocusTest",
        comment: "What the Focus test is, for an exam without a date or with one subject")
  }
}

/// Main's `FocusTestResume`: an open sitting the learner left with answers in it.
struct FocusTestResume: View {
  let sitting: FocusTest.Sitting
  let subject: String
  let pressed: FocusTestPress?
  let failed: Bool
  let onContinue: () -> Void
  let onUseAnswers: () -> Void

  var body: some View {
    ZoonkList {
      StepHeader(
        subject: subject,
        title: Text(
          "Continue your test", tableName: "FocusTest",
          comment: "Title of an open Focus test sitting the learner came back to"),
        description: nil)

      SittingSize(
        minutes: sitting.minutes,
        facts: [
          String(
            localized: "\(sitting.answered) answers saved", table: "FocusTest",
            comment: "How many answers an open Focus test sitting has saved"),
          String(
            localized: "Up to \(sitting.left) questions left", table: "FocusTest",
            comment: "How many questions an open Focus test sitting can still ask"),
        ])

      SaveFailure(failed: failed)

      StepButtons(
        continueLabel: Text(
          "Continue", tableName: "FocusTest",
          comment: "Goes on with an open Focus test sitting"),
        continueIcon: .play,
        skipLabel: Text(
          "Use my answers", tableName: "FocusTest",
          comment: "Leaves the Focus test with the answers given so far"),
        skipIcon: nil, onContinue: onContinue, onSkip: onUseAnswers)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, pressed != nil)
  }
}

/// A sitting that's over and not closed yet: the learner came back to it, or closing it failed.
struct FocusTestEnded: View {
  let end: FocusTest.Sitting.End?
  let subject: String
  let isSaving: Bool
  let failed: Bool
  let onFinish: () -> Void

  var body: some View {
    ZoonkList {
      StepHeader(
        subject: subject,
        title: Text(
          "Your answers are saved", tableName: "FocusTest",
          comment: "Title once a Focus test sitting has nothing more to ask"),
        description: FocusTestCopy.endLine(end).map { Text($0) })

      SaveFailure(failed: failed)

      StepButtons(
        continueLabel: Text(
          "See your starting plan", tableName: "FocusTest",
          comment: "Shows what the Focus test's answers set in the plan"),
        onContinue: onFinish)
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

      SaveFailure(failed: failed)

      StepButtons(onContinue: onContinue)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, isSaving)
  }
}

/// Main's `FocusTestSubjectsSheet`: the exam's subjects in the notice's order, in plain words.
struct FocusTestSubjectsSheet: View {
  let subjects: [FocusTest.Subject]
  /// The learner has test answers, so each subject says how it went.
  let answered: Bool

  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      ZoonkList {
        Section {
          ForEach(subjects) { subject in
            LabeledContent {
              if answered || subject.state == .notChecked {
                Text(FocusTestCopy.state(of: subject))
              }
            } label: {
              Text(subject.shown)
            }
          }
        }
      }
      .navigationTitle(
        Text("Subjects", tableName: "FocusTest", comment: "Title of the Focus test's subject list")
      )
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
