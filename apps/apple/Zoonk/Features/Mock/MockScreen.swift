import SwiftUI

/// A started mock exam in real conditions, full screen like the exam room, to its result: its
/// sections, clock, breaks and hand-in, then how it went. Its challenge introduces and starts the
/// plan's weekly mock; one taken any time starts from the chooser. Swiping it away is off while
/// it runs: ✕ leaves (the clock keeps running, as in the exam) once the answers are saved.
struct MockScreen: View {
  @Environment(ExamStore.self) private var exam
  @State private var run: MockRun?

  let blockId: String
  var sessionId: String? = nil

  var body: some View {
    NavigationStack {
      if let run {
        MockStage(run: run, sessionId: sessionId)
          .loads(run.mock, refreshable: false)
      }
    }
    .interactiveDismissDisabled()
    .onAppear {
      run = run ?? MockRun(store: exam, blockId: blockId)
    }
  }
}

/// The mock's step, as it stands on the server.
private struct MockStage: View {
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss
  @Bindable var run: MockRun
  let sessionId: String?

  var body: some View {
    content
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            Task {
              await run.prepareToLeave()
              dismiss()
            }
          }
          .disabled(run.pending)
        }.keepsVisibleInBar()
      }
      .onChange(of: run.view, initial: true) {
        if let view = run.view {
          run.adopt(view)
        }
      }
      .onDisappear { run.queue.stop() }
  }

  @ViewBuilder
  private var content: some View {
    switch run.mock.state {
    case .idle, .loading:
      ProgressView()
    case .empty, .failed(.notFound):
      ContentUnavailableView {
        Label {
          Text("This mock exam isn't here", tableName: "Mock", comment: "A mock that doesn't exist")
        } icon: {
          Image(systemName: "timer")
        }
      }
    case .failed:
      ContentUnavailableView {
        Label {
          Text("The mock exam didn't load", tableName: "Mock", comment: "Loading a mock failed")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } actions: {
        Button {
          Task { await run.mock.refresh() }
        } label: {
          Text("Try again", tableName: "Mock", comment: "Button to retry loading")
        }
        .buttonStyle(.bordered)
      }
    case .loaded(let view):
      stage(view)
    }
  }

  @ViewBuilder
  private func stage(_ view: MockView) -> some View {
    if view.status == .ready {
      // Before it starts, its challenge introduces it and starts it.
      ProgressView()
        .task {
          guard let planItemId = view.planItemId else { return }
          router.dismissTask()
          router.open(.challenge(planItemId: planItemId, sessionId: sessionId ?? view.sessionId))
        }
    } else if view.status == .expired {
      MockExpiredView(view: view)
    } else if view.status == .finished {
      MockResultView(run: run, view: view)
    } else if let until = view.breakUntil, view.current == nil {
      MockBreakView(run: run, view: view, until: until)
    } else if let current = view.current, run.timeUp {
      MockTimeUpView(run: run, view: view, current: current)
    } else if let current = view.current, current.kind == .speaking {
      MockSpeakingView(run: run, view: view, current: current)
    } else if let current = view.current {
      MockRunnerView(run: run, view: view, current: current)
    } else {
      MockGradingView(run: run)
    }
  }
}

/// The section's time left, like the exam room's clock: in the toolbar while a section runs.
struct MockClock: View {
  let deadline: Date

  var body: some View {
    VStack(spacing: 0) {
      Text(timerInterval: Date.now...max(deadline, .now), countsDown: true)
        .font(.headline.monospacedDigit())
      Text("time left", tableName: "Mock", comment: "Under the mock's clock")
        .font(.caption2)
        .foregroundStyle(.secondary)
        .accessibilityHidden(true)
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel(Text("Time left", tableName: "Mock", comment: "The mock's clock"))
  }
}

/// Over the mock's actions: an answer that isn't stored, a step that didn't go through (saying
/// the answers are saved only when they are), or a step taking longer than usual.
struct MockStepStatus: View {
  let run: MockRun

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      switch run.queue.status {
      case .retrying:
        HStack {
          Text("Not saved yet · retrying", tableName: "Mock", comment: "An answer waits to save")
            .frame(maxWidth: .infinity, alignment: .leading)
          Button {
            run.queue.retryNow()
          } label: {
            Text("Retry", tableName: "Mock", comment: "Sends the waiting answers now")
          }
          .buttonStyle(.bordered)
          .controlSize(.small)
        }
        .foregroundStyle(.secondary)
      case .refused:
        Text("Your last answer wasn't saved.", tableName: "Mock", comment: "A refused save")
          .foregroundStyle(.destructive)
      case .saved, .saving:
        EmptyView()
      }

      if run.failed {
        Group {
          if run.queue.status == .saved {
            Text(
              "That didn't go through. Your answers are saved. Try again in a moment.",
              tableName: "Mock", comment: "A mock step failed; the answers are saved")
          } else {
            Text(
              "That didn't go through. Try again in a moment.", tableName: "Mock",
              comment: "A mock step failed")
          }
        }
        .foregroundStyle(.destructive)
      } else if run.slow {
        Text(
          "Still handing it in. This is taking longer than usual.", tableName: "Mock",
          comment: "A mock step is slow"
        )
        .foregroundStyle(.secondary)
      }
    }
    .font(.subheadline)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// The bar under a mock's step: what isn't saved, then its one action.
struct MockActionBar<Actions: View>: View {
  let run: MockRun
  @ViewBuilder let actions: Actions

  var body: some View {
    VStack(spacing: 10) {
      MockStepStatus(run: run)
      HStack(spacing: 12) { actions }
    }
    .scenePadding(.horizontal)
    .padding(.vertical, 10)
  }
}

/// A step the mock's time sets: its mark, its title and a line, in the middle of the page.
private struct MockStepCard: View {
  let systemImage: String
  let title: Text
  var detail: Text?

  var body: some View {
    ContentUnavailableView {
      Label {
        title
      } icon: {
        Image(systemName: systemImage)
      }
    } description: {
      if let detail { detail }
    }
  }
}

/// A clock never hands a section in: time closes the answers, and the learner hands them in.
private struct MockTimeUpView: View {
  let run: MockRun
  let view: MockView
  let current: MockCurrent

  var body: some View {
    MockStepCard(
      systemImage: "timer",
      title: Text("Time's up", tableName: "Mock", comment: "A mock section's time ran out"),
      detail: run.queue.status == .saved
        ? Text(
          "Your answers so far are saved.", tableName: "Mock",
          comment: "Under time's up, once every answer is stored") : nil
    )
    .navigationTitle(MockLabels.title(number: view.number))
    .safeAreaBar(edge: .bottom) {
      MockActionBar(run: run) {
        Button {
          Task { await run.submitSection() }
        } label: {
          if run.busy == .submit {
            Text("Handing in…", tableName: "Mock", comment: "A section is being handed in")
          } else if view.isLastSectionCurrent {
            Text("See how it went", tableName: "Mock", comment: "Hands in the mock's last section")
          } else {
            Text("Continue", tableName: "Mock", comment: "Hands in a section after its time")
          }
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .disabled(run.pending)
        .keyboardShortcut(.defaultAction)
      }
      .keepsOffFold()
    }
  }
}

/// Every section was handed in but grading didn't finish: one tap grades it now.
private struct MockGradingView: View {
  let run: MockRun

  var body: some View {
    MockStepCard(
      systemImage: "tray.and.arrow.down",
      title: Text("Mock exam handed in", tableName: "Mock", comment: "A mock waiting to be graded")
    )
    .safeAreaBar(edge: .bottom) {
      MockActionBar(run: run) {
        Button {
          Task { await run.finish() }
        } label: {
          if run.busy == .finish {
            Text("Grading…", tableName: "Mock", comment: "A mock is being graded")
          } else {
            Text("See how it went", tableName: "Mock", comment: "Grades a handed-in mock")
          }
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .disabled(run.pending)
        .keyboardShortcut(.defaultAction)
      }
      .keepsOffFold()
    }
  }
}

/// A mock taken any time whose time ran out while the learner was away isn't scored: a new one
/// starts from the chooser (the plan's starts again from its challenge).
private struct MockExpiredView: View {
  @Environment(AppRouter.self) private var router
  let view: MockView

  var body: some View {
    MockStepCard(
      systemImage: "timer",
      title: Text(
        "Time ran out while you were away", tableName: "Mock", comment: "An abandoned mock"),
      detail: Text(
        "With most of it unanswered, it isn't scored and doesn't change your preparation.",
        tableName: "Mock", comment: "Why an abandoned mock has no result")
    )
    .safeAreaBar(edge: .bottom) {
      Button {
        if let planItemId = view.planItemId {
          router.dismissTask()
          router.open(.challenge(planItemId: planItemId, sessionId: view.sessionId))
        } else {
          router.open(.mockChooser)
        }
      } label: {
        Text("Take a new mock exam", tableName: "Mock", comment: "Starts over after expiring")
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
      .scenePadding(.horizontal)
      .padding(.vertical, 10)
      .keepsOffFold()
    }
  }
}

/// The break the notice gives between two sections: its time left big, the section that comes
/// next, and starting it early. When the break ends the next section starts on its own.
private struct MockBreakView: View {
  let run: MockRun
  let view: MockView
  let until: Date

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 8) {
          Text(timerInterval: Date.now...max(until, .now), countsDown: true)
            .font(.largeTitle.weight(.semibold).monospacedDigit())
            .accessibilityLabel(
              Text("Break time left", tableName: "Mock", comment: "The break's clock"))
          Text(
            "The next section starts on its own when the break ends.", tableName: "Mock",
            comment: "Under a mock's break clock"
          )
          .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
      }

      if let next = view.currentSection {
        Section {
          LabeledContent {
            Text(MockLabels.duration(minutes: next.minutes)).monospacedDigit()
          } label: {
            if let name = next.name {
              Text("Next: \(name)", tableName: "Mock", comment: "The section after the break")
            } else {
              Text("Next section", tableName: "Mock", comment: "The section after the break")
            }
            if let tools = next.tools {
              Text(tools)
            }
          }
        }
      }
    }
    .navigationTitle(Text("Break", tableName: "Mock", comment: "A break between mock sections"))
    .task(id: until) {
      // When the break ends, the server already started the next section: this shows it.
      let wait = until.timeIntervalSinceNow
      if wait > 0 {
        try? await Task.sleep(for: .seconds(wait))
      }
      guard !Task.isCancelled else { return }
      await run.endBreak()
    }
    .safeAreaBar(edge: .bottom) {
      MockActionBar(run: run) {
        Button {
          Task { await run.endBreak() }
        } label: {
          Text("Start the next section", tableName: "Mock", comment: "Ends a mock's break early")
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .disabled(run.pending)
      }
      .keepsOffFold()
    }
  }
}

/// The speaking section: its paper's task cards are written once the learner starts it, then each
/// task is a call with the examiner, back here after it, and the section is handed in.
private struct MockSpeakingView: View {
  @State private var openTask: MockSpeaking.Task?
  @State private var confirmsHandIn = false
  let run: MockRun
  let view: MockView
  let current: MockCurrent

  private var left: Int {
    view.speaking?.tasks.filter { $0.status != .completed }.count ?? 0
  }

  var body: some View {
    List {
      Section {
        if let speaking = view.speaking {
          ForEach(Array(speaking.tasks.enumerated()), id: \.element.id) { index, task in
            taskRow(task, number: index + 1)
          }
        } else {
          Text(
            "The examiner gives you each task in turn, like on exam day.", tableName: "Mock",
            comment: "Before a mock's speaking part starts")
        }
      } header: {
        Text(view.currentSection?.name ?? view.speaking?.title ?? "")
      } footer: {
        if view.speaking != nil {
          if left > 0 {
            Text(
              "Do the tasks in order. Each one is a call, and you come back here after it. \(left) tasks left.",
              tableName: "Mock", comment: "Mock speaking tasks still to do")
          } else {
            Text(
              "Every task is done. Hand in this section to go on.", tableName: "Mock",
              comment: "Every mock speaking task is done")
          }
        }
      }
    }
    .navigationTitle(MockLabels.title(number: view.number))
    .toolbar {
      ToolbarItem(placement: .principal) { MockClock(deadline: current.deadline) }
    }
    .deadline(current.deadline, run: run)
    .fullScreenCover(item: $openTask) { task in
      ConversationScreen(conversationId: task.conversationId) {
        openTask = nil
      }
      .onDisappear { Task { await run.reload() } }
    }
    .safeAreaBar(edge: .bottom) {
      MockActionBar(run: run) {
        if view.speaking == nil {
          Button {
            Task { await run.startSpeaking() }
          } label: {
            if run.busy == .startSpeaking {
              Text("Writing your task cards…", tableName: "Mock", comment: "Speaking cards")
            } else {
              Text("Start the speaking part", tableName: "Mock", comment: "Starts mock speaking")
            }
          }
          .buttonStyle(.mainAction)
          .controlSize(.large)
          .disabled(run.pending)
        } else {
          Button {
            confirmsHandIn = true
          } label: {
            handInLabel
          }
          .buttonStyle(.mainAction)
          .controlSize(.large)
          .disabled(run.pending)
        }
      }
      .keepsOffFold()
    }
    .alert(handInTitle, isPresented: $confirmsHandIn) {
      Button(role: .cancel) {
      } label: {
        Text("Keep going", tableName: "Mock", comment: "Cancels handing in speaking")
      }
      Button {
        Task { await run.submitSection() }
      } label: {
        Text("Hand in", tableName: "Mock", comment: "Confirms handing in")
      }
    } message: {
      if left > 0 {
        Text(
          "\(left) tasks aren't done, so this paper gets no estimate. After this, you can't do them in this mock.",
          tableName: "Mock", comment: "Handing in speaking with tasks left")
      } else {
        Text(
          "Every task is done. After this, you can't do them again in this mock.",
          tableName: "Mock", comment: "Handing in speaking with every task done")
      }
    }
  }

  private func taskRow(_ task: MockSpeaking.Task, number: Int) -> some View {
    HStack {
      VStack(alignment: .leading, spacing: 2) {
        Text("Task \(number)", tableName: "Mock", comment: "A speaking task's number")
          .font(.caption.monospaced())
          .foregroundStyle(.secondary)
        Text(task.name)
      }
      Spacer()
      if task.status == .completed {
        Label {
          Text("Done", tableName: "Mock", comment: "A speaking task that's done")
        } icon: {
          StatusMark(status: .done)
        }
        .foregroundStyle(.secondary)
      } else {
        Button {
          openTask = task
        } label: {
          Text("Start", tableName: "Mock", comment: "Starts a speaking task's call")
        }
        .buttonStyle(.bordered)
      }
    }
  }

  private var handInLabel: Text {
    view.isLastSectionCurrent
      ? Text("Hand in the mock exam", tableName: "Mock", comment: "Hands in the last section")
      : Text("Hand in this section", tableName: "Mock", comment: "Hands in a section")
  }

  private var handInTitle: Text {
    view.isLastSectionCurrent
      ? Text("Hand in the mock exam?", tableName: "Mock", comment: "Confirms handing in a mock")
      : Text("Hand in this section?", tableName: "Mock", comment: "Confirms handing in a section")
  }
}

extension View {
  /// Closes the answers when the section's clock runs out.
  func deadline(_ deadline: Date, run: MockRun) -> some View {
    task(id: deadline) {
      let wait = deadline.timeIntervalSinceNow

      if wait > 0 {
        try? await Task.sleep(for: .seconds(wait))
      }

      guard !Task.isCancelled else { return }
      run.sectionTimeUp = true
    }
  }
}
