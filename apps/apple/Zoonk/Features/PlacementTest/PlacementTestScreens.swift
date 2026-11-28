import SwiftUI

/// Main's `PlacementResult`: where the learner starts, drawn before it's said. A small "You start
/// here" over the chapter's name; the course as one line of chapters, each as wide as its lessons,
/// the lessons started past filled and a ring on the chapter that starts; how many lessons that
/// skips; and the next lesson as the highlighted "Up next" row. With no course to draw (the result
/// came before the plan), the title and the way on alone.
struct PlacementTestResultView: View {
  let end: PlacementTestEnd
  let onboarding: Bool
  let pressed: FocusTestPress?
  let failed: Bool
  var undo: PlacementResultUndo?
  /// The plan's last result, when a new test can start: its offer, in place.
  var onRetake: (() -> Void)?
  let onDone: () -> Void

  var body: some View {
    let restored = undo?.restored != nil
    let isSaving = pressed != nil || undo?.request.isRunning == true
    // Undone, the start is back at the course's first lesson, which the result doesn't name.
    let place = restored ? nil : end.startName

    TestOutcome(
      subject: place == nil ? nil : String(localized: PlacementTestCopy.youStartHere),
      title: place.map { Text(verbatim: $0) }
        ?? Text(PlacementTestCopy.lessonsSkipped(restored ? 0 : end.lessonsSkipped)),
      description: undo?.restored
        ?? (end.heldUntilTomorrow && end.lessonsSkipped == 0
          ? Text(PlacementTestCopy.retakeTomorrow) : nil),
      continueLabel: onboarding
        ? nil
        : end.nextLesson == nil || end.revisited || restored
          ? Text(TestCopy.done) : Text(TestCopy.startLesson),
      undo: undo,
      underTitle: restored
        ? nil
        : end.course.map { course in
          // A title that already is the count, with no start to name, isn't repeated under it.
          AnyView(
            PlacementCourseLine(
              course: course, lessonsSkipped: place == nil ? 0 : end.lessonsSkipped))
        },
      isSaving: isSaving, failed: failed, onContinue: onDone
    ) {
      if let nextLesson = end.nextLesson, end.course != nil, !restored {
        UpNextLessonRow(lesson: nextLesson)
      }

      if let onRetake {
        Button(action: onRetake) {
          Text(PlacementTestCopy.takeTestAgain)
            .underline()
        }
        .resultLinkRow()
        .disabled(isSaving)
      }
    }
    .announcesStatus(undo?.announcement)
  }
}

/// The course on a test's result: one line of chapters in plan order, each as wide as its
/// lessons and filled as far as its lessons are behind the learner, and how many lessons the test
/// skipped; none draws no count.
struct PlacementCourseLine: View {
  /// The lessons behind the learner, studied or started past, in progress blue as the language
  /// result's level meters draw a level reached.
  static let behindTone = Color.success

  let course: PlacementCourse
  let lessonsSkipped: Int

  var body: some View {
    SkippedCaption(lessons: lessonsSkipped) {
      MeterParts(
        parts: course.chapters.map { chapter in
          MeterParts.Part(
            weight: Double(max(chapter.lessons, 1)),
            fill: .share(
              chapter.lessons > 0
                ? Double(chapter.done + chapter.skipped) / Double(chapter.lessons) : 0,
              color: Self.behindTone),
            ringed: chapter.start)
        },
        height: 6, gap: 3)
    }
    // Main's line sits closer to the title than to what follows: with the heading's own room
    // under it, a section's step.
    .padding(.top, 8)
    .padding(.bottom, 12)
    .accessibilityElement(children: .combine)
  }
}

/// What a result drew (the course's line, a language's level rows) with how many lessons the test
/// skipped under it, which the picture can't say; nothing under it when none were.
struct SkippedCaption<Picture: View>: View {
  let lessons: Int
  @ViewBuilder let picture: Picture

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      picture

      if lessons > 0 {
        Text(verbatim: PlacementTestCopy.lessonsSkipped(lessons))
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
      }
    }
  }
}

/// The lesson the plan goes on with, as the highlighted "Up next" row, with its minutes where the
/// result has them (a course's; a language's has none). Both tests' results draw it.
struct UpNextLessonRow: View {
  let lesson: PlacementTestResult.NextLesson

  var body: some View {
    // A group of its own, as Main's `UpNextLesson` is, never sharing one with what's around it.
    Section {
      ListRow(Text(verbatim: lesson.title), description: Text(TestCopy.upNext)) {
        StatusMark(status: .next)
      } trailing: {
        if let minutes = lesson.estimatedMinutes {
          Text(verbatim: studyDuration(minutes: minutes))
            .typeStyle(.data)
            .foregroundStyle(.mutedForeground)
        }
      }
      .currentRow()
      .listRowBackground(Color.clear)
    }
  }
}

extension View {
  /// A quiet link under a test's result, such as "Take the test again": a section's step from what's
  /// above it, as main's column puts it.
  func resultLinkRow() -> some View {
    buttonStyle(.borderless)
      .listRowSeparator(.hidden)
      .listRowInsets(.top, 0)
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
