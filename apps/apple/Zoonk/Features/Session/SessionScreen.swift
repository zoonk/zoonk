import SwiftUI

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
          onStop: {
            if case .failed = await store.stop(sessionID: sessionID) {
              return false
            }

            return true
          }
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
        if let moment = store.moment {
          List {
            Section {
              MomentSummary(moment: moment, title: nil)
            }

            // The buddy acts once, on the next stop's screen.
            DayMomentSections(result: moment.day, celebrates: false)

            Section {
              ProgressView()
                .frame(maxWidth: .infinity)
            }
            .listRowBackground(Color.clear)
          }
        } else {
          ProgressView()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
      }
    }
    .loads(session)
    // A block's screen closing over this one may have moved the day: read it again.
    .onChange(of: router.tasks.count) { previous, current in
      if current < previous, router.tasks.last == .session {
        Task { await session.refresh() }
      }
    }
    .milestoneCeremony(store.moment?.ceremony)
  }
}

private struct NextStopView: View {
  @Environment(AppRouter.self) private var router
  @Environment(StudySessionStore.self) private var store
  @Environment(TodayStore.self) private var today

  let day: StudyDay
  let sessionID: String
  let moment: BlockMoment?

  @State private var action: Task<Void, Never>?
  @State private var isOpening = false
  @State private var isStopping = false
  @State private var failed = false
  @State private var lessonStatus: String?

  private var next: StudyBlock? { day.nextBlock }

  var body: some View {
    PaneSplit {
      List {
        daySoFar
      }
    } secondary: {
      List {
        upNext
        actions
      }
    } single: {
      List {
        daySoFar
        upNext
        actions
      }
    }
    .task(id: FollowedLesson(lessonID: next?.lessonId, writing: writing)) {
      await followLesson()
    }
    .onDisappear {
      action?.cancel()
    }
  }

  @ViewBuilder
  private var daySoFar: some View {
    if let moment {
      Section {
        MomentSummary(moment: moment, title: title(of: moment))
      }

      DayMomentSections(result: moment.day)
    }

    Section {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "\(day.blocks.filter(\.isFinished).count) of \(day.blocks.count) done",
          tableName: "Session", comment: "How far the day's session is"
        )
        .font(.subheadline.monospacedDigit())
        .foregroundStyle(.secondary)

        MeterParts(parts: day.meterParts)
      }
    }
  }

  @ViewBuilder
  private var upNext: some View {
    if let next {
      Section {
        BlockRow(
          block: next, view: nil, isNext: true, countsTowardMission: false, showsDetail: true)

        if let lessonLine {
          lessonLine
        }
      } header: {
        Text("Up next", tableName: "Session", comment: "The session's next block")
      }

      if case .refused(let refusal) = writing {
        Section {
          LessonUnavailableView(refusal: refusal) {
            open(next)
          }
        }
      }
    }
  }

  private var actions: some View {
    Section {
      VStack(spacing: 12) {
        if let alternative, isLessonWorkRunning || isLessonUnavailable {
          mainButton(alternativeTitle(alternative), block: alternative)
        } else if let next, !isLessonUnavailable {
          mainButton(continueTitle, block: next)
            .disabled(isLessonWorkRunning)
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

  private func title(of moment: BlockMoment) -> String {
    day.blocks.first { $0.id == moment.blockId }?.displayTitle
      ?? String(localized: "Block", table: "Session", comment: "A finished block without a name")
  }

  private var writing: LessonWriting? {
    next.flatMap(today.writing(for:))
  }

  /// A lesson nobody is writing keeps Continue, whose tap asks for it.
  private var isLessonWorkRunning: Bool {
    next?.kind == .learn && (lessonStatus == "generating" || writing?.isRunning == true)
  }

  private var isLessonUnavailable: Bool {
    switch writing {
    case .refused, .setAside: true
    default: false
    }
  }

  private var continueTitle: Text {
    if writing == .failed || lessonStatus == "failed" {
      return Text(
        "Try again", tableName: "Session", comment: "Asks again for a lesson that failed")
    }

    return next?.status == .active
      ? Text("Continue", tableName: "Session", comment: "Opens the session's next block")
      : Text(
        "Start", tableName: "Session", comment: "Opens the session's next block, not begun yet")
  }

  private func alternativeTitle(_ block: StudyBlock) -> Text {
    isLessonUnavailable
      ? Text(
        "Instead: \(block.displayTitle)", tableName: "Session",
        comment: "A ready block to do when the lesson can't be written now")
      : Text(
        "While you wait: \(block.displayTitle)", tableName: "Session",
        comment: "A ready block to do while the lesson is written")
  }

  private var lessonLine: AnyView? {
    guard next?.kind == .learn else {
      return nil
    }

    if writing == .setAside {
      return AnyView(
        Text(
          "This lesson can't be written now, so your plan goes on without it.",
          tableName: "Session", comment: "A lesson set aside by its checks"
        )
        .foregroundStyle(.secondary))
    }

    if writing == .failed || lessonStatus == "failed" {
      return AnyView(
        Text(
          "We couldn't write this lesson.", tableName: "Session",
          comment: "Writing a lesson failed"
        )
        .foregroundStyle(.destructive))
    }

    guard isLessonWorkRunning else {
      return nil
    }

    return AnyView(
      Label {
        Text(
          "This lesson is being written for you. It's usually ready in about two minutes.",
          tableName: "Session", comment: "A lesson being written")
      } icon: {
        ProgressView()
      }
      .foregroundStyle(.secondary))
  }

  /// Mirrors core's `findAlternativeStudyBlock`.
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

    action = Task {
      let result = await today.open(block, sessionID: sessionID)
      isOpening = false

      switch result {
      case .done(.session), .done(.lessonWait):
        // The step waits here; its writing is followed from what the tap asked.
        break
      case .done(let destination) where !Task.isCancelled:
        router.openStudy(destination, sessions: store)
      case .done:
        break
      case .failed:
        failed = true
      case .obsolete:
        break
      }
    }
  }

  private func stop() {
    isStopping = true
    failed = false

    action = Task {
      if case .failed = await store.stop(sessionID: sessionID) {
        failed = true
      }

      isStopping = false
    }
  }

  /// Opens the lesson on its own once it's written only when the learner asked for it.
  private func followLesson() async {
    guard let next, next.kind == .learn else {
      lessonStatus = nil
      return
    }

    for _ in 0..<60 {
      if let lessonID = next.lessonId {
        lessonStatus = await store.lessonStatus(lessonID: lessonID)

        if lessonStatus == "ready" {
          if writing?.isRunning == true {
            open(next)
          }

          return
        }

        guard lessonStatus == "generating" || writing?.isRunning == true else {
          return
        }
      } else {
        guard writing == .preparing else {
          return
        }

        await store.session(id: sessionID).refresh()
      }

      do {
        try await Task.sleep(for: .seconds(5))
      } catch {
        return
      }
    }
  }
}

private struct FollowedLesson: Equatable {
  let lessonID: String?
  let writing: LessonWriting?
}

private struct MomentSummary: View {
  let moment: BlockMoment
  let title: String?

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Group {
        if let title {
          Text(
            "\(title) done", tableName: "Session", comment: "The block the learner just finished")
        } else {
          Text(
            "Done", tableName: "Session", comment: "A block just finished, before its name loads")
        }
      }
      .font(.title2.bold())
      .accessibilityAddTraits(.isHeader)

      if moment.ownBrainPower > 0 {
        Text("+\(moment.ownBrainPower) Brain Power", tableName: "Session", comment: "Earned")
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
    }
  }
}
