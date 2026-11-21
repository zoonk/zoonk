import SwiftUI

/// Before the question exists: it's being written, its writing failed, the day's extra grades are
/// used, or nothing was asked yet on this visit (`start` is nil: a link or a screen opened again,
/// which shows the task and starts nothing). Asking is always the learner's tap here, or the run
/// their tap started ending; how it answered lives only as long as this visit.
struct WritingStartView: View {
  @Environment(ExamStore.self) private var store
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss

  let blockId: String
  let start: WritingStart?
  /// The task as the day lists it, for a block nothing was asked for yet on this visit.
  var task: WritingRefusedView.Task?
  var unasked: WritingPrompt.Unit?
  let onReady: (WritingStart) -> Void

  @State private var asking = VisitRequest<WritingStart>()
  @State private var viewedWait: String?
  /// What's being written, kept once a wait names it so its failure still does.
  @State private var unit: WritingPrompt.Unit?

  private var shown: WritingStart? { asking.outcome ?? start }

  private var shownUnit: WritingPrompt.Unit? {
    if case .writing(_, let unit?) = shown { return unit }
    if case .writing(_, let unit?) = start { return unit }
    return unit ?? unasked
  }

  var body: some View {
    Group {
      switch shown {
      case nil:
        unaskedPage
      case .limitReached(_, let task):
        WritingRefusedView(
          task: task.map {
            .init(
              title: WritingLabels.taskTitle(
                unit: $0.unit, task: $0.writingTask, fallback: $0.description) ?? $0.description,
              minutes: $0.minutes)
          }, isBusy: false,
          onContinue: { dismiss() })
      case .writing(let generationId, _):
        waiting(generationId)
      case .unavailable:
        unavailable
      case .signUpRequired:
        signUp
      case .failed, .ready:
        failed
      }
    }
    .navigationTitle(WritingLabels.header(shownUnit))
    .toolbar {
      ToolbarItem(placement: .cancellationAction) {
        Button(role: .close) { dismiss() }
      }
    }
    .onDisappear { asking.leave() }
  }

  /// One model call writes the question: the wait says what's coming, with no steps it doesn't
  /// have.
  private func waiting(_ generationId: String) -> some View {
    ZoonkList {
      Section {
        VStack(alignment: .leading, spacing: 20) {
          PageHeader(
            shownUnit == .drill
              ? Text("Writing your exercise…", tableName: "Essay")
              : Text("Writing your question…", tableName: "Essay"),
            supporting: shownUnit == .drill
              ? Text(
                "A short exercise on what you just learned. It opens here when it's ready.",
                tableName: "Essay")
              : Text(
                "A new question like the ones on your exam. It opens here when it's ready.",
                tableName: "Essay")
          ) {
            EmptyView()
          }
          ProgressView()
        }
      }
    }
    .lonePage()
    .onAppear {
      if case .writing(_, let shownUnit?) = shown { unit = shownUnit }

      if viewedWait != generationId {
        viewedWait = generationId
        UsageAnalytics.track(
          .writingPromptWaitViewed(generationID: generationId, surface: "practice"))
      }

      follow(generationId)
    }
  }

  /// Nothing asked yet on this visit: the task and its time, and "Write" asks for it.
  private var unaskedPage: some View {
    ZoonkList {
      Section {
        PageHeader(
          Text(task?.title ?? WritingLabels.header(unasked)),
          supporting: task?.minutes.map {
            Text("About \(studyDuration(minutes: $0))", tableName: "Essay")
          }
        ) {
          EmptyView()
        }
      }
    }
    .lonePage()
    .bottomBar {
      BusyButton(isBusy: asking.isRunning) {
        ask()
      } label: {
        Text("Write", tableName: "Essay", comment: "Starts writing the answer")
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
    }
  }

  /// A guest's question needs an account first: signing up is the way on, never a retry.
  private var signUp: some View {
    ZoonkList {
      Section {
        PageHeader(Text(HelpLimit.signUpRequired.sentence()))
      }
    }
    .lonePage()
    .bottomBar {
      LimitWayOn(limit: .signUpRequired)
        .buttonStyle(.mainAction)
        .keyboardShortcut(.defaultAction)
    }
  }

  private var unavailable: some View {
    ZoonkList {
      Section {
        PageHeader(
          Text("This question is no longer on your exam", tableName: "Essay"),
          supporting: Text(
            "Your exam notice changed, so it's out of your plan. Nothing was graded.",
            tableName: "Essay")
        ) {
          EmptyView()
        }
      }
    }
    .lonePage()
    .bottomBar {
      Button {
        router.showRoot(of: .today)
      } label: {
        Text(
          "Continue", tableName: "Essay",
          comment: "Goes on after a written task the exam notice removed")
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
    }
  }

  private var failed: some View {
    ZoonkList {
      Section {
        PageHeader(
          shownUnit == .drill
            ? Text("We couldn't write your exercise", tableName: "Essay")
            : Text("We couldn't write your question", tableName: "Essay"),
          supporting: Text("Nothing was lost. Try again in a moment.", tableName: "Essay")
        ) {
          EmptyView()
        }
      }
    }
    .lonePage()
    .bottomBar {
      BusyButton(isBusy: asking.isRunning) {
        ask()
      } label: {
        Text("Try again", tableName: "Essay", comment: "Asks for the question again")
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
    }
  }

  /// The run ending asks again: its start then admits the grading.
  private func follow(_ generationId: String) {
    guard !asking.isRunning else { return }

    asking.run {
      do {
        try await store.waitForWritingPrompt(generationId: generationId)
      } catch is CancellationError {
        return nil
      } catch {
        return .failed
      }

      return await answer()
    } then: { started in
      if case .ready = started { onReady(started ?? .failed) }
    }
  }

  private func ask() {
    asking.run {
      await answer()
    } then: { started in
      if case .ready = started { onReady(started ?? .failed) }
    }
  }

  private func answer() async -> WritingStart {
    switch await store.startWriting(blockId: blockId) {
    case .done(let started): started
    case .failed, .obsolete: .failed
    }
  }
}

/// Refused before writing: the day's extra grades are used, and the task waits for tomorrow, so
/// nothing written is ever lost to a limit.
struct WritingRefusedView: View {
  struct Task: Hashable {
    let title: String
    let minutes: Int?
  }

  let task: Task?
  let isBusy: Bool
  let onContinue: () -> Void

  var body: some View {
    ZoonkList {
      Section {
        VStack(alignment: .leading, spacing: 12) {
          Image(systemName: "clock")
            .typeStyle(.section)
            .foregroundStyle(.mutedForeground)
            .accessibilityHidden(true)
          PageHeader(
            Text("No more grading today", tableName: "Essay", comment: "Extra grades used up"),
            supporting: Text(
              "You'll have more tomorrow.", tableName: "Essay",
              comment: "When grading comes back")
          ) {
            EmptyView()
          }
        }
      }

      if let task {
        Section {
          ListRow(Text(task.title)) {
            KindMark(kind: .essay)
          } trailing: {
            if let minutes = task.minutes {
              Text(studyDuration(minutes: minutes))
                .typeStyle(.data)
            }
          }
        } header: {
          SectionTitle(
            Text("Left for tomorrow", tableName: "Essay", comment: "The task that waits"))
        }
      }
    }
    .lonePage()
    .bottomBar {
      BusyButton(isBusy: isBusy) {
        onContinue()
      } label: {
        Text("Continue", tableName: "Essay", comment: "Goes on after the refusal")
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
    }
  }
}
