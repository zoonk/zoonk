import SwiftUI

/// Today's session as a full-screen task: between the day's blocks it shows what the last one
/// earned and the next stop, with Continue and "Stop for today"; a lesson still being written waits
/// here with a ready block to do meanwhile; once the day is done (or stopped) it shows the summary.
/// Each block plays on its own screen over this one, so closing it comes back here.
struct SessionScreen: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(TodayStore.self) private var today

  var body: some View {
    NavigationStack {
      Group {
        if let sessionID = today.sessionID {
          SessionContent(sessionID: sessionID)
        } else {
          ContentUnavailableView {
            Label {
              Text(
                "No session open yet", tableName: "Session",
                comment: "The session screen with no day opened")
            } icon: {
              Image(systemName: "sun.max")
            }
          } description: {
            Text(
              "Start today's session from Today.", tableName: "Session",
              comment: "The session screen with no day opened")
          }
        }
      }
      .navigationTitle(Text("Today's session", tableName: "Session", comment: "Session's title"))
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            dismiss()
          }
        }
      }
    }
  }
}

private struct SessionContent: View {
  @Environment(AppRouter.self) private var router
  @Environment(StudySessionStore.self) private var store

  let sessionID: String

  /// Set once the learner stops for today, so the summary shows what was done so far.
  @State private var stopped = false
  /// Blocks done when the screen first read the day: a block done since has its moment.
  @State private var doneAtOpen: Int?

  var body: some View {
    let session = store.session(id: sessionID)

    Group {
      switch session.state {
      case .loaded(let day):
        if stopped || day.nextBlock == nil {
          SessionSummaryView(sessionID: sessionID, stopped: stopped)
        } else {
          NextStopView(
            day: day, sessionID: sessionID, justDone: justDone(in: day), stopped: $stopped)
        }
      case .failed(let error) where error != .unauthorized:
        ContentUnavailableView {
          Label {
            Text("The session didn't load", tableName: "Session", comment: "Load failed")
          } icon: {
            Image(systemName: "wifi.exclamationmark")
          }
        } actions: {
          Button {
            Task { await session.refresh() }
          } label: {
            Text("Try again", tableName: "Session", comment: "Retries loading the session")
          }
          .buttonStyle(.bordered)
        }
      default:
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    }
    .loads(session)
    .onChange(of: session.value?.blocks.filter(\.isFinished).count, initial: true) { _, done in
      if doneAtOpen == nil, let done {
        doneAtOpen = done
      }
    }
    // A block's screen closing over this one may have moved the day: read it again.
    .onChange(of: router.tasks.count) { previous, current in
      if current < previous, router.tasks.last == .session {
        Task { await session.refresh() }
      }
    }
    .onDisappear {
      let done = session.value?.blocks.filter(\.isFinished).count

      if stopped || (doneAtOpen != nil && done != doneAtOpen) {
        store.dayMoved()
      }
    }
  }

  /// The block finished last, once one finished while the screen was open.
  private func justDone(in day: StudyDay) -> StudyBlock? {
    let done = day.blocks.filter { $0.status == .completed }

    guard let doneAtOpen, done.count > doneAtOpen else {
      return nil
    }

    return done.last
  }
}

/// The moment between blocks and the next stop: what the last block earned, the day's progress,
/// the next block, and Continue beside "Stop for today". A lesson being written waits here.
private struct NextStopView: View {
  @Environment(AppRouter.self) private var router
  @Environment(StudySessionStore.self) private var store
  @Environment(TodayStore.self) private var today

  let day: StudyDay
  let sessionID: String
  let justDone: StudyBlock?
  @Binding var stopped: Bool

  @State private var isOpening = false
  @State private var isStopping = false
  @State private var failed = false
  @State private var lessonStatus: String?

  private var next: StudyBlock? { day.nextBlock }

  var body: some View {
    List {
      if let justDone {
        Section {
          VStack(alignment: .leading, spacing: 4) {
            Text(
              "\(justDone.displayTitle) done", tableName: "Session",
              comment: "The block the learner just finished"
            )
            .font(.title2.bold())

            if justDone.brainPower > 0 {
              Text("+\(justDone.brainPower) Brain Power", tableName: "Session", comment: "Earned")
                .font(.headline.monospacedDigit())
                .foregroundStyle(.brain)
            }
          }
        }
      }

      Section {
        VStack(alignment: .leading, spacing: 8) {
          Text(
            "\(day.blocks.filter(\.isFinished).count) of \(day.blocks.count) done",
            tableName: "Session", comment: "How far the day's session is"
          )
          .font(.subheadline.monospacedDigit())
          .foregroundStyle(.secondary)

          MeterParts(
            parts: day.blocks.map { block in
              MeterParts.Part(
                weight: Double(max(block.estimatedMinutes, 1)),
                fill: block.isFinished
                  ? .color(.success) : block.position == day.nextPosition ? .current : .track)
            })
        }
      }

      if let next {
        Section {
          BlockRow(block: next, view: nil, isNext: true, countsTowardMission: false)

          if isWaitingForLesson {
            Label {
              if lessonStatus == "generating" {
                Text("Getting it ready…", tableName: "Session", comment: "A lesson being written")
              } else {
                Text(
                  "This lesson isn't written yet.", tableName: "Session",
                  comment: "A lesson nobody started writing")
              }
            } icon: {
              ProgressView()
            }
            .foregroundStyle(.secondary)
          }
        } header: {
          Text("Up next", tableName: "Session", comment: "The session's next block")
        }
      }

      Section {
        VStack(spacing: 12) {
          if let alternative, isWaitingForLesson {
            mainButton(
              Text(
                "Do \(alternative.displayTitle) first", tableName: "Session",
                comment: "A ready block to do while a lesson is written"),
              block: alternative)
          } else if let next {
            mainButton(
              Text("Continue", tableName: "Session", comment: "Opens the session's next block"),
              block: next
            )
            .disabled(isWaitingForLesson)
          }

          Button {
            stop()
          } label: {
            HStack {
              if isStopping {
                ProgressView()
              }

              Text("Stop for today", tableName: "Session", comment: "Ends the session for today")
            }
            .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .controlSize(.large)
          .disabled(isStopping || isOpening)

          if failed {
            Text(
              "We couldn't open the next step. Try again.", tableName: "Session",
              comment: "Opening or stopping failed"
            )
            .font(.footnote)
            .foregroundStyle(.destructive)
          }
        }
      }
      .listRowBackground(Color.clear)
      .listRowInsets(EdgeInsets())
    }
    .task(id: next?.lessonId) {
      await followLesson()
    }
  }

  /// Whether the next stop is a lesson that isn't written yet.
  private var isWaitingForLesson: Bool {
    next?.kind == .learn && lessonStatus != nil && lessonStatus != "ready"
  }

  /// A ready question block to do while the lesson is written (core's `findAlternativeStudyBlock`).
  private var alternative: StudyBlock? {
    day.blocks.first {
      $0.id != next?.id && $0.status == .pending && $0.kind != .learn && $0.waitReason == nil
    }
  }

  private func mainButton(_ title: Text, block: StudyBlock) -> some View {
    Button {
      open(block)
    } label: {
      HStack {
        if isOpening {
          ProgressView()
        }

        title
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)
    .disabled(isOpening || isStopping)
  }

  private func open(_ block: StudyBlock) {
    isOpening = true
    failed = false

    Task {
      let destination = await today.open(block, sessionID: sessionID)
      isOpening = false

      if let destination, destination != .session {
        router.openStudy(destination)
      } else {
        failed = destination == nil
        await followLesson()
      }
    }
  }

  private func stop() {
    isStopping = true
    failed = false

    Task {
      if await store.stop(sessionID: sessionID) {
        stopped = true
      } else {
        failed = true
      }

      isStopping = false
    }
  }

  /// Follows the next lesson while it's written, so Continue opens it once it's ready.
  private func followLesson() async {
    guard next?.kind == .learn, let lessonID = next?.lessonId else {
      lessonStatus = nil
      return
    }

    for _ in 0..<60 {
      lessonStatus = await store.lessonStatus(lessonID: lessonID)

      guard lessonStatus == "generating" else {
        return
      }

      do {
        try await Task.sleep(for: .seconds(5))
      } catch {
        return
      }
    }
  }
}
