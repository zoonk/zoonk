import SwiftUI

private let saveFailure = LocalizedStringResource(
  "That didn't save. Try again.", table: "Onboarding", comment: "A change couldn't be saved")

/// How long the quick test takes, as the length choice says it.
private let quickTestMinutes = 4

/// What the learner can pick on the length choice: a length, or a language level's test-out.
enum PlacementTestChoice: Hashable {
  case length(PlacementLength)
  case testOut
}

/// Main's `PlacementLengthChoice`: how much the test checks, quick by default. A language course
/// also offers its next level's test-out.
struct PlacementLengthChoice: View {
  let wholeCourseMinutes: Int
  /// A language course's next level the learner can test out of.
  let testOutLevel: String?
  let languageNotes: LevelTestLanguageNotes?
  let isSaving: Bool
  let failed: Bool
  let onStart: (PlacementTestChoice) -> Void
  let onSkip: (() -> Void)?

  @State private var choice: PlacementTestChoice

  init(
    wholeCourseMinutes: Int, testOutLevel: String? = nil,
    initialChoice: PlacementTestChoice = .length(.quick),
    languageNotes: LevelTestLanguageNotes? = nil, isSaving: Bool, failed: Bool,
    onSkip: (() -> Void)? = nil, onStart: @escaping (PlacementTestChoice) -> Void
  ) {
    self.wholeCourseMinutes = wholeCourseMinutes
    self.testOutLevel = testOutLevel
    self.languageNotes = languageNotes
    self.isSaving = isSaving
    self.failed = failed
    self.onStart = onStart
    self.onSkip = onSkip
    _choice = State(initialValue: initialChoice)
  }

  var body: some View {
    let title = Text(
      "How much do you want to check?", tableName: "Onboarding",
      comment: "Title of the choice between the quick test and the whole-course test")

    ZoonkList {
      StepHeader(title: title)

      ChoiceRows(choices: choices, picked: choice) { choice = $0 }
        .locksWhileSaving()

      Section {
        Text(
          "Stop any time. What you pass stays skipped.", tableName: "Onboarding",
          comment: "Under the test's length choice: leaving keeps what the answers so far skipped"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
        .listRowBackground(Color.clear)
      }

      languageNotes
    }
    .bottomBar(note: failed && !isSaving ? BarNote(saveFailure) : nil) {
      StepButtons(
        continueLabel: Text(
          "Start", tableName: "Onboarding", comment: "Starts the test of the chosen length"),
        onContinue: { onStart(choice) }, onSkip: onSkip)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, isSaving)
  }

  private var choices: [ChoiceRows<PlacementTestChoice>.Choice] {
    var choices: [ChoiceRows<PlacementTestChoice>.Choice] = [
      .init(
        value: .length(.quick),
        label: String(
          localized: "Quick", table: "Onboarding",
          comment: "The short placement test: about four minutes of questions"),
        detail: Text(
          "About \(studyDuration(minutes: quickTestMinutes))", tableName: "Onboarding",
          comment: "How long the quick test takes, such as \"4 min\""))
    ]

    if wholeCourseMinutes > 0 {
      choices.append(
        .init(
          value: .length(.wholeCourse),
          label: String(
            localized: "Whole course", table: "Onboarding",
            comment: "The long placement test: it checks every topic still ahead in the course"),
          detail: Text(
            "About \(studyDuration(minutes: wholeCourseMinutes)), in parts",
            tableName: "Onboarding",
            comment:
              "How long the whole-course test takes, such as \"30 min\". It's split into parts the learner can take on different days."
          )))
    }

    if let testOutLevel {
      choices.append(
        .init(
          value: .testOut, label: PlacementTestCopy.testOut(testOutLevel),
          detail: Text(
            "Skip \(testOutLevel) if you already know it", tableName: "Onboarding",
            comment:
              "What a language level's test-out does, such as \"Skip B2 if you already know it\""
          )))
    }

    return choices
  }
}

/// Main's `PlacementBetweenParts`: a whole-course test between two parts, with what the last one
/// skipped and the rest to do.
struct PlacementBetweenParts: View {
  /// Nil when the learner came back to a test whose part closed earlier.
  let lessonsSkipped: Int?
  let minutesLeft: Int
  let pressed: FocusTestPress?
  let failed: Bool
  let onKeepGoing: () -> Void
  var undo: PlacementResultUndo?
  var onboarding = false
  var onFinishForToday: (() -> Void)?

  var body: some View {
    ZoonkList {
      StepHeader(
        title: lessonsSkipped.map { Text(PlacementTestCopy.lessonsSkipped($0)) }
          ?? Text(
            "Continue your test", tableName: "Onboarding",
            comment: "Title of a whole-course test the learner came back to between its parts"),
        description: Text(
          "About \(studyDuration(minutes: minutesLeft)) left. Your answers are saved.",
          tableName: "Onboarding",
          comment:
            "Between the whole-course test's parts: how long the rest takes, such as \"15 min\""
        ))

      undo?.row

      if onboarding {
        Section {
          Text("You can finish the test from Plan.", tableName: "Onboarding")
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
            .listRowBackground(Color.clear)
        }
      }
    }
    .bottomBar(note: failed && pressed == nil ? BarNote(saveFailure) : nil) {
      StepButtons(
        continueLabel: onboarding
          ? nil
          : Text(
            "Keep going", tableName: "Onboarding",
            comment: "Starts the whole-course test's next part"),
        skipLabel: Text(
          "Finish for today", tableName: "Onboarding",
          comment: "Leaves the whole-course test between its parts; the answers are saved"),
        onContinue: onKeepGoing, onSkip: onFinishForToday)
    }
    .onboardingColumn()
    .announcesStatus(undo?.announcement)
    .environment(\.isSavingAnswer, pressed != nil)
  }
}

/// Main's `PlacementResult`: what the test skipped, and where the plan goes on.
struct PlacementTestResultView: View {
  let length: PlacementLength
  let lessonsSkipped: Int
  /// The topic the plan goes on with; nil when none is left.
  let nextTopic: String?
  let isSaving: Bool
  let failed: Bool
  var undo: PlacementResultUndo?
  var onboarding = false
  let onDone: () -> Void

  var body: some View {
    TestOutcome(
      title: Text(PlacementTestCopy.lessonsSkipped(lessonsSkipped)),
      description: undo?.restored
        ?? (lessonsSkipped > 0
          ? Text(PlacementTestCopy.knownLessons(lessonsSkipped))
          : Text(
            "Your plan stays as it is.", tableName: "Onboarding",
            comment: "Under \"No lessons skipped\" after a test")),
      continueLabel: onboarding
        ? nil : Text("Done", tableName: "Onboarding", comment: "Leaves a test's result"),
      isSaving: isSaving, failed: failed, onContinue: onDone
    ) {
      if let undo, undo.restored == nil {
        undo.row
      }

      if let nextTopic, undo?.restored == nil {
        Section {
          Text(verbatim: nextTopic)
            .typeStyle(.rowTitle)
        } header: {
          SectionTitle(
            Text(
              "Up next", tableName: "Onboarding", comment: "Over the topic the plan goes on with"))
        }
      }

      if length == .quick, !onboarding {
        Section {
          Text(
            "The whole-course test can skip more.", tableName: "Onboarding",
            comment: "Under the quick test's result: the longer test checks every topic ahead"
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
          .listRowBackground(Color.clear)
        }
      }
    }
    .announcesStatus(undo?.announcement)
  }
}

@MainActor
struct PlacementResultUndo {
  let lessons: Int
  let request: VisitRequest<Bool>
  let action: @MainActor () async -> Bool?
  let disabled: Bool

  init?(
    goalId: String, changeId: String?, lessons: Int, request: VisitRequest<Bool>,
    plans: PlanStore, disabled: Bool
  ) {
    guard let changeId, lessons > 0 else { return nil }

    self.lessons = lessons
    self.request = request
    self.disabled = disabled
    action = {
      switch await plans.undo(goalId: goalId, changeId: changeId) {
      case .done(let change): change?.status == "undone"
      case .failed: false
      case .obsolete: nil
      }
    }
  }

  var announcement: String? {
    request.outcome == true ? String(localized: PlacementTestCopy.lessonsRestored(lessons)) : nil
  }

  var restored: Text? { announcement.map { Text(verbatim: $0) } }

  var row: some View {
    Section {
      if let restored {
        restored
          .typeStyle(.note)
          .listRowBackground(Color.clear)
      } else {
        BusyButton(isBusy: request.isRunning, icon: .undo) {
          request.run(action)
        } label: {
          Text("Undo", tableName: "Onboarding")
        }
        .buttonStyle(.ghost)
        .disabled(disabled)
        .listRowBackground(Color.clear)

        if request.outcome == false {
          FailureLine(message: saveFailure)
        }
      }
    }
  }
}
