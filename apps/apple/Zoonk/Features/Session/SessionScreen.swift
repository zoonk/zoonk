import SwiftUI

/// Today's session as a full-screen task: a question block plays right here (S7's
/// `QuestionBlockScreen`, whose finish shows the moment and whose "Stop for today" the summary);
/// between blocks it shows what the last one earned and the next stop, with Continue and "Stop for
/// today"; a lesson still being written waits here with a ready block to do meanwhile; once the day
/// is done (or stopped) it shows the summary. Lessons, challenges and writing play on their own
/// task over this one, so closing them comes back here.
struct SessionScreen: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(StudySessionStore.self) private var store
  @Environment(TodayStore.self) private var today

  var body: some View {
    ZStack {
      if let sessionID = today.sessionID, let blockID = store.playingBlockID {
        QuestionBlockScreen(
          sessionId: sessionID, blockId: blockID,
          onFinished: { completion in
            store.finish(try? StudyJSON.recode(completion, as: BlockMoment.self))
          },
          onStop: { await store.stop(sessionID: sessionID) }
        )
        .id(blockID)
      } else {
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
          .navigationTitle(
            Text("Today's session", tableName: "Session", comment: "Session's title")
          )
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
    .onDisappear {
      store.leave()
    }
  }
}

private struct SessionContent: View {
  @Environment(AppRouter.self) private var router
  @Environment(StudySessionStore.self) private var store

  let sessionID: String

  @State private var ceremony: Milestone?

  var body: some View {
    let session = store.session(id: sessionID)
    let stopped = store.stoppedSessionID == sessionID

    Group {
      switch session.state {
      case .loaded(let day):
        if stopped || day.nextBlock == nil {
          SessionSummaryView(sessionID: sessionID, stopped: stopped)
        } else {
          NextStopView(day: day, sessionID: sessionID, moment: store.moment)
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
    // A block's screen closing over this one may have moved the day: read it again.
    .onChange(of: router.tasks.count) { previous, current in
      if current < previous, router.tasks.last == .session {
        Task { await session.refresh() }
      }
    }
    // A milestone the block earned shows once, before its moment.
    .onChange(of: store.moment?.ceremony, initial: true) { _, milestone in
      if let milestone, store.claimCeremony(milestone) {
        ceremony = milestone
      }
    }
    .fullScreenCover(item: $ceremony) { milestone in
      MilestoneCeremony(milestone: milestone) {
        ceremony = nil
      }
    }
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
  let moment: BlockMoment?

  @State private var isOpening = false
  @State private var isStopping = false
  @State private var failed = false
  @State private var lessonStatus: String?

  private var next: StudyBlock? { day.nextBlock }

  var body: some View {
    List {
      if let moment {
        Section {
          MomentSummary(moment: moment, title: title(of: moment))
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

  /// The finished block's name, as the day lists it.
  private func title(of moment: BlockMoment) -> String {
    day.blocks.first { $0.id == moment.blockId }?.displayTitle
      ?? String(localized: "Block", table: "Session", comment: "A finished block without a name")
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
        router.openStudy(destination, sessions: store)
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
      failed = await !store.stop(sessionID: sessionID)

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

/// What a block finished here earned, in a few quiet lines: its name done, its Brain Power, how
/// many it got right, when it comes back, and the missions' bonus when it paid it.
private struct MomentSummary: View {
  let moment: BlockMoment
  let title: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("\(title) done", tableName: "Session", comment: "The block the learner just finished")
        .font(.title2.bold())
        .accessibilityAddTraits(.isHeader)

      if moment.brainPower > 0 {
        Text("+\(moment.brainPower) Brain Power", tableName: "Session", comment: "Earned")
          .font(.headline.monospacedDigit())
          .foregroundStyle(.brain)
      }

      if moment.total > 0 {
        Text(
          "\(moment.correct) of \(moment.total) right", tableName: "Session",
          comment: "Questions right in the block just finished"
        )
        .monospacedDigit()
        .foregroundStyle(.secondary)
      }

      if let date = moment.comesBackOn.flatMap(studyDate) {
        Text(
          "Review on \(date.formatted(.studyDay.month(.abbreviated).day()))", tableName: "Session",
          comment: "When the block's lesson comes back"
        )
        .foregroundStyle(.secondary)
      }

      if moment.fullMeal.paid {
        Text(
          "Missions done · +\(moment.fullMeal.bonus) Brain Power", tableName: "Session",
          comment: "The block finished today's missions"
        )
        .foregroundStyle(.brain)
      }
    }
  }
}
