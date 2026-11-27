import SwiftUI

/// Main's part checkpoint: a part of the full test is done, what it skipped and what's left.
/// "Keep going" opens the next part; "Finish later" leaves the rest for the plan.
struct PlacementCheckpoint: View {
  let stop: PlacementPartStop
  let pressed: FocusTestPress?
  let failed: Bool
  var undo: PlacementResultUndo?
  let onKeepGoing: () -> Void
  let onFinishLater: () -> Void

  var body: some View {
    let attempt = stop.attempt

    TestOutcome(
      title: Text(verbatim: TestCopy.partDone(attempt.part, of: attempt.parts)),
      description: undo?.restored ?? Text(verbatim: PlacementTestCopy.partLine(stop)),
      facts: PlacementTestCopy.partsLeftFacts(attempt),
      continueLabel: Text(TestCopy.keepGoing),
      secondary: .init(label: Text(TestCopy.finishLater), action: onFinishLater),
      undo: undo, isSaving: pressed != nil || undo?.request.isRunning == true, failed: failed,
      onContinue: onKeepGoing
    )
    .announcesStatus(undo?.announcement)
  }
}

/// Main's stopped part: the learner stopped the full test midway. Their answers count, and the
/// test goes on later where they stopped.
struct PlacementStopped: View {
  let stop: PlacementPartStop
  let onboarding: Bool
  let pressed: FocusTestPress?
  let failed: Bool
  var undo: PlacementResultUndo?
  let onDone: () -> Void

  var body: some View {
    TestOutcome(
      title: Text(TestCopy.answersSaved),
      description: undo?.restored ?? Text(verbatim: PlacementTestCopy.partLine(stop)),
      facts: stop.attempt.resume.map { resume in
        [TestCopy.nextTime(part: resume.part, of: stop.attempt.parts, question: resume.question)]
      } ?? [],
      continueLabel: onboarding ? nil : Text(TestCopy.done),
      undo: undo, isSaving: pressed != nil || undo?.request.isRunning == true, failed: failed,
      onContinue: onDone
    )
    .announcesStatus(undo?.announcement)
  }
}

/// Main's `PlacementResult`: what the test skipped and the lesson the plan goes on with. A quick
/// test with more of the course ahead says how much is left, and "Test the rest" goes on with it.
/// The quick test never mentioned parts, so what's left is named as the test the offer showed.
struct PlacementTestResultView: View {
  let end: PlacementTestEnd
  let onboarding: Bool
  let pressed: FocusTestPress?
  let failed: Bool
  var undo: PlacementResultUndo?
  let onTestTheRest: () -> Void
  let onDone: () -> Void

  var body: some View {
    let restored = undo?.restored != nil

    TestOutcome(
      title: Text(PlacementTestCopy.lessonsSkipped(restored ? 0 : end.lessonsSkipped)),
      description: undo?.restored ?? description,
      facts: end.rest.map {
        [String(localized: TestCopy.fullTest)] + PlacementTestCopy.partsLeftFacts($0)
      }
        ?? [],
      continueLabel: onboarding
        ? nil
        : end.nextLesson == nil || restored ? Text(TestCopy.done) : Text(TestCopy.startLesson),
      secondary: end.rest == nil
        ? nil : .init(label: Text(TestCopy.testTheRest), action: onTestTheRest),
      undo: undo, isSaving: pressed != nil || undo?.request.isRunning == true, failed: failed,
      onContinue: onDone
    ) {
      if let nextLesson = end.nextLesson, !restored {
        UpNextPanel(title: nextLesson.title)
      }
    }
    .announcesStatus(undo?.announcement)
  }

  private var description: Text {
    if end.lessonsSkipped > 0 {
      return Text(PlacementTestCopy.knownLessons(end.lessonsSkipped))
    }

    if end.heldUntilTomorrow {
      return Text(PlacementTestCopy.retakeTomorrow)
    }

    return Text(
      "Your plan stays as it is.", tableName: "Onboarding",
      comment: "Under \"No lessons skipped\" after a test")
  }
}

/// The lesson the plan goes on with, under a test's result.
struct UpNextPanel: View {
  let title: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Chip(Text(TestCopy.upNext))

      Text(verbatim: title)
        .typeStyle(.rowTitle)
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .panel()
    .listRowBackground(Color.clear)
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

  var failure: BarNote? {
    request.outcome == false && !request.isRunning ? BarNote(TestCopy.saveFailure) : nil
  }

  @ViewBuilder var button: some View {
    if restored == nil {
      BusyButton(isBusy: request.isRunning, icon: .undo) {
        request.run(action)
      } label: {
        Text("Undo", tableName: "Onboarding")
      }
      .buttonStyle(.outline)
      .disabled(disabled && !request.isRunning)
    }
  }
}
