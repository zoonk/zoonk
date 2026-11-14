import SwiftUI

struct SessionScreen: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var plans
  @Environment(StudySessionStore.self) private var store
  @Environment(TodayStore.self) private var today

  /// An exam goal's session questions can skip the Focus test's for today.
  private var examGoalID: String? {
    guard case .day(let view)? = today.today.value, view.goal.kind == .exam else {
      return nil
    }

    return view.goal.id
  }

  var body: some View {
    let playback = router.playback

    ZStack {
      if let sessionID = today.sessionID, let blockID = playback.playingBlockID {
        QuestionBlockScreen(
          sessionId: sessionID, blockId: blockID,
          onFinished: { completion in
            let moment = try? StudyJSON.recode(completion, as: BlockMoment.self)
            playback.finish(moment)

            if let moment {
              store.apply(moment, sessionID: sessionID)
            }
          },
          onStop: {
            if case .failed = await store.stop(sessionID: sessionID, in: playback) {
              return false
            }

            return true
          },
          skipTestQuestions: examGoalID.map { goalID in
            SkipTestQuestionsAction(goalID: goalID) {
              let skipped = await plans.updateFocusTest(
                goalId: goalID, FocusTestControls(sessionQuestions: .skippedToday))

              if case .done = skipped { return true } else { return false }
            }
          },
          onGone: { playback.finish(nil) }
        )
        .id(blockID)
      } else {
        NavigationStack {
          Group {
            if let sessionID = today.sessionID {
              SessionContent(sessionID: sessionID)
            } else if let view = today.day, view.session.nextBlock != nil {
              // A day not opened yet shows its next step as Today read it; Start opens the day.
              NextStopView(
                day: view.session, sessionID: nil, goalID: view.session.goalId ?? view.goal.id,
                moment: nil
              )
              // Covering Today, it holds Today's read itself, so a Start the day refused reads it again.
              .loads(today.today)
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
              .lonePage()
            }
          }
          .navigationTitle(
            Text("Today", tableName: "Session", comment: "Session's title: today's study")
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
      playback.leave()
    }
  }
}

private struct SessionContent: View {
  @Environment(AppRouter.self) private var router
  @Environment(StudySessionStore.self) private var store
  @Environment(TodayStore.self) private var today

  let sessionID: String

  var body: some View {
    let session = store.session(id: sessionID)
    let playback = router.playback
    let stopped = playback.stoppedSessionID == sessionID
    let endsSession =
      playback.moment.map { $0.sessionId == sessionID && $0.sessionCompleted } ?? false

    Group {
      // One branch for Today's day and the session's own, so the read landing keeps this screen
      // and a Start already tapped on it.
      if let day = shownDay(session, moment: playback.moment) {
        if stopped || (day.nextBlock == nil && !endsSession) {
          SessionSummaryView(sessionID: sessionID, stopped: stopped)
        } else {
          NextStopView(
            day: day, sessionID: sessionID, goalID: day.goalId ?? today.day?.goal.id,
            moment: playback.moment)
        }
      } else if case .failed(let error) = session.state, error != .unauthorized {
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
          .buttonStyle(.outline)
        }
        .lonePage()
      } else if let moment = playback.moment {
        ZoonkList {
          Section {
            // Brain Power waits for the next stop, so its first-time line is drawn once, there.
            MomentSummary(moment: moment, earns: false)
          }

          // The buddy acts once, on the next stop's screen.
          Group {
            Section {
              DayProgressBlock(moment: moment)
            }

            DayMomentSections(result: moment.day)
          }
          .environment(\.celebrates, false)

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
    .loads(session)
    // A block's screen closing over this one may have moved the day: read it again.
    .onChange(of: router.tasks.count) { previous, current in
      if current < previous, router.tasks.last == .session {
        Task { await session.refresh() }
      }
    }
    .completionMoments(playback.moment?.day)
  }

  /// Until the session's first read lands, the day as Today holds it, where the tap came from. A
  /// block just finished waits for the read, since Today's day may not show it done.
  private func shownDay(_ session: Resource<StudyDay>, moment: BlockMoment?) -> StudyDay? {
    switch session.state {
    case .loaded(let day):
      return day
    case .idle, .loading:
      guard moment == nil, let held = today.day?.session, held.id == sessionID else {
        return nil
      }

      return held
    case .empty, .failed:
      return nil
    }
  }
}

private struct NextStopView: View {
  @Environment(AppRouter.self) private var router
  @Environment(StudySessionStore.self) private var store
  @Environment(TodayStore.self) private var today

  let day: StudyDay
  /// Nil while the day isn't opened.
  let sessionID: String?
  let goalID: String?
  let moment: BlockMoment?

  @State private var action: Task<Void, Never>?
  /// Taps that left a lesson waiting here, so a retry the same run answers follows it again.
  @State private var waits = 0
  @State private var isOpening = false
  @State private var isStopping = false
  @State private var failed = false
  @State private var stopFailed = false
  @State private var lessonStatus: String?
  @State private var lessonKind = GenerationWait.Kind.lesson
  /// The block whose lesson this screen showed being written.
  @State private var waitedFor: String?
  /// The goal's warm-up deck, while the lesson written is its first.
  @State private var warmUp: FirstLessonWarmUp?
  @State private var isReviewIntroOpen = false
  @AccessibilityFocusState private var isStartFocused: Bool

  init(day: StudyDay, sessionID: String?, goalID: String?, moment: BlockMoment?) {
    self.day = day
    self.sessionID = sessionID
    self.goalID = goalID
    self.moment = moment
  }

  /// The step a tap on another screen asked for, until it's done; else the day's next.
  private var next: StudyBlock? {
    day.blocks.first { $0.id != nil && $0.id == router.playback.shownBlockID && !$0.isFinished }
      ?? day.nextBlock
  }

  var body: some View {
    // The session never opens the lesson on its own: moving on only takes the card away. It says
    // the lesson is ready itself.
    WaitHold(surface: .lessonWait, isReady: !isLessonWorkRunning, announcement: nil) { stage in
      stop(stage)
    } onMoveOn: {
      if isWrittenWhileWaiting {
        isStartFocused = true
      }
    }
    .taskThroughPush(id: FollowedLesson(lessonID: next?.lessonId, writing: writing, waits: waits)) {
      await followLesson()
    }
    .onChange(of: isLessonWorkRunning, initial: true) { _, running in
      if running {
        waitedFor = next?.id
      }
    }
    .onChange(of: isWrittenWhileWaiting) { _, written in
      if written {
        offerWrittenLesson()
      }
    }
    .announcesStatus(notWrittenLine)
    .onDisappear {
      action?.cancel()
    }
  }

  private func stop(_ stage: WaitStage) -> some View {
    let held: WaitHolding? =
      switch stage {
      case .waiting(let holding?) where isWrittenWhileWaiting:
        WaitHolding {
          holding.moveOn()

          if let next {
            open(next)
          }
        }
      default: nil
      }
    let deckID: String? =
      switch stage {
      case .waiting: warmUpDeckID
      case .ready: nil
      }

    return NextStopWait(
      kind: lessonKind, deckID: deckID, goalID: day.goalId, held: held,
      isWritten: lessonStatus == "ready",
      isWaiting: isLessonWorkRunning || held != nil, note: failureNote
    ) {
      daySoFar
    } upNext: {
      upNext
    } actions: {
      actions(isHeld: held != nil)
    }
  }

  /// Only for the lesson being written, never one that failed or can't be written.
  private var warmUpDeckID: String? {
    guard let warmUp, warmUp.lessonID == next?.lessonId, !isLessonUnavailable,
      writing != .failed, lessonStatus != "failed"
    else {
      return nil
    }

    return warmUp.deckID
  }

  @ViewBuilder
  private var daySoFar: some View {
    if let moment {
      Section {
        MomentSummary(moment: moment)
      }

      Section {
        DayProgressBlock(moment: moment)
          .celebratesOnce(id: moment)
      }

      DayMomentSections(result: moment.day, chapter: moment.finishedChapter)
    } else {
      Section {
        VStack(alignment: .leading, spacing: 8) {
          DayProgressLead(bar: day.sessionBar, isOpen: false)

          DaySegments(segments: day.daySegments.map(\.mark))
        }
      }
    }
  }

  @ViewBuilder
  private var upNext: some View {
    if let next {
      Section {
        BlockRow(
          block: next, view: nil, isNext: true, countsTowardMission: false, showsDetail: true,
          lineOverride: next.kind == .review && !next.capsules.isEmpty
            && ReviewIntro.isEarly(goalID: goalID) ? ReviewIntro.earlyLine : nil)

        if let lessonLine {
          lessonLine
        }

        if next.kind == .review {
          ReviewIntro(block: next, isOpen: $isReviewIntroOpen)
        }
      } header: {
        Chip(Text("Up next", tableName: "Session", comment: "Over the session's next block"))
      }

      if case .refused(let refusal) = writing {
        Section {
          LessonUnavailableView(refusal: refusal, isNotice: true) {
            open(next)
          }
        }
      } else if writing == .setAside {
        Section {
          ContentUnavailableView {
            Label {
              Text(Self.setAsideTitle)
            } icon: {
              Image(systemName: "exclamationmark.circle")
            }
          } description: {
            Text(Self.setAsideReason)
          }
        }
      }
    }
  }

  /// The bottom bar's buttons: "Stop for today", then the main action. A held wait pins its own way
  /// to the lesson instead of the main button.
  @ViewBuilder
  private func actions(isHeld: Bool) -> some View {
    if moment?.sessionCompleted == true {
      BusyButton(isBusy: false) {
        router.playback.seeSummary()
      } label: {
        Text(
          "Continue", tableName: "Session",
          comment: "Moves on from the block that completed today's session to its summary")
      }
      .buttonStyle(.mainAction)
    } else {
      // Main's `canStop`: a day with nothing done has nothing to stop.
      if let sessionID, day.blocks.contains(where: \.isFinished) {
        BusyButton(isBusy: isStopping) {
          stop(sessionID: sessionID)
        } label: {
          Text("Stop for today", tableName: "Session", comment: "Ends the session for today")
        }
        .buttonStyle(.outline)
        .disabled(isOpening)
      }

      if let alternative, isLessonWorkRunning || isLessonUnavailable {
        mainButton(alternativeTitle(alternative), block: alternative)
      } else if let next, !isLessonUnavailable, !isHeld {
        mainButton(continueTitle, block: next)
          .disabled(isLessonWorkRunning)
          .accessibilityFocused($isStartFocused)
      }
    }
  }

  /// What a tap couldn't do, over the bar's buttons.
  private var failureNote: BarNote? {
    if stopFailed {
      return BarNote(
        LocalizedStringResource(
          "We couldn't stop for today. Try again.", table: "Session",
          comment: "Stopping for today failed"))
    }

    return failed
      ? BarNote(
        LocalizedStringResource(
          "We couldn't open the next step. Try again.", table: "Session",
          comment: "Opening the next step failed"))
      : nil
  }

  private var writing: LessonWriting? {
    next.flatMap(today.writing(for:))
  }

  /// A lesson nobody is writing keeps Continue, whose tap asks for it.
  private var isLessonWorkRunning: Bool {
    next?.kind == .learn && lessonStatus != "failed" && lessonStatus != "ready"
      && (lessonStatus == "generating" || writing?.isRunning == true)
  }

  /// Offered, never opened on its own: the learner may be reading, or doing what "While you wait"
  /// offered.
  private var isWrittenWhileWaiting: Bool {
    lessonStatus == "ready" && waitedFor != nil && waitedFor == next?.id
  }

  private var notWrittenLine: String? {
    switch writing {
    case .refused(let refusal): LessonUnavailableView(refusal: refusal) {}.said
    case .setAside: [Self.setAsideTitle, Self.setAsideReason].joinedSentences()
    default: nil
    }
  }

  private static let setAsideTitle = String(
    localized: "This lesson isn't available", table: "Session",
    comment: "A lesson its quality checks set aside")

  private static let setAsideReason = String(
    localized: "Your plan goes on without it.",
    table: "Session", comment: "A lesson its quality checks set aside")

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

  /// Named by what it starts, the same while a lesson is written and when it can't be.
  private func alternativeTitle(_ block: StudyBlock) -> Text {
    switch block.kind {
    case .review:
      Text("Review now", tableName: "Session", comment: "Starts the day's review instead")
    case .practice:
      Text("Practice now", tableName: "Session", comment: "Starts the day's practice instead")
    case .learn:
      Text("Next lesson", tableName: "Session", comment: "Starts the day's next lesson instead")
    default:
      Text(
        "Start \(block.displayTitle)", tableName: "Session",
        comment: "Starts another of the day's steps instead; the argument is its name")
    }
  }

  private var lessonLine: AnyView? {
    guard next?.kind == .learn, writing != .setAside else {
      return nil
    }

    if isWrittenWhileWaiting {
      return AnyView(
        Text(
          "Your lesson is ready.", tableName: "Session",
          comment: "A lesson written while the learner waited, offered with Start"))
    }

    if writing == .failed || lessonStatus == "failed" {
      return AnyView(
        FailureLine(
          message: LocalizedStringResource(
            "We couldn't write this lesson.", table: "Session",
            comment: "Writing a lesson failed")))
    }

    guard isLessonWorkRunning else {
      return nil
    }

    return AnyView(
      Label {
        Text(lessonKind.writingNote)
      } icon: {
        ProgressView()
      }
      .foregroundStyle(.mutedForeground))
  }

  /// Mirrors core's `findAlternativeStudyBlock`.
  private var alternative: StudyBlock? {
    day.blocks.first {
      $0.id != next?.id && $0.status == .pending && $0.kind != .learn && $0.waitReason == nil
    }
  }

  private func mainButton(_ title: Text, block: StudyBlock) -> some View {
    BusyButton(isBusy: isOpening) {
      open(block)
    } label: {
      title
    }
    .buttonStyle(.mainAction)
    .disabled(isStopping)
  }

  private func open(_ block: StudyBlock) {
    ReviewIntro.noteStart(of: block, goalID: goalID)
    isOpening = true
    failed = false
    stopFailed = false

    action = Task {
      let result = await opening(block)
      isOpening = false

      switch result {
      case .done(.lessonWait):
        waits += 1
      case .done(.session):
        // The session shows this step itself.
        break
      case .done(let destination) where !Task.isCancelled:
        router.openStudy(destination)
      case .done:
        break
      case .failed:
        failed = true
      case .obsolete:
        break
      }
    }
  }

  /// A day not opened yet opens with its next step, as Today's Start session does. A saved day opens
  /// the block shown, which may be drawn from Today's older read: a block finished elsewhere comes
  /// back to this screen instead of starting the one after it unseen.
  private func opening(_ block: StudyBlock) async -> MutationResult<StudyDestination> {
    guard let sessionID else {
      guard let view = today.day else {
        return .obsolete
      }

      return await today.open(block, as: .next, in: view)
    }

    return await today.open(block, as: .block, sessionID: sessionID)
  }

  /// VoiceOver says it however busy it is. It lands on Start once the wait moves on, so a learner
  /// still on the card can't open the lesson with a tap meant for an answer.
  private func offerWrittenLesson() {
    var announcement = AttributedString(
      String(
        localized: "Your lesson is ready.", table: "Session",
        comment: "A lesson written while the learner waited, offered with Start"))
    announcement.accessibilitySpeechAnnouncementPriority = .high
    AccessibilityNotification.Announcement(announcement).post()
  }

  private func stop(sessionID: String) {
    isStopping = true
    failed = false
    stopFailed = false

    action = Task {
      if case .failed = await store.stop(sessionID: sessionID, in: router.playback) {
        stopFailed = true
      }

      isStopping = false
    }
  }

  /// A run that ended without writing the lesson reads as failed, with Try again, unless its checks
  /// set it aside: that one is never written again, so it isn't read again. Only the plan's
  /// preparation has no run to follow yet (it picks the lesson, then starts writing it), so that
  /// wait reads again for a few minutes at most.
  private func followLesson() async {
    guard let next, next.kind == .learn, writing != .setAside else {
      lessonStatus = nil
      return
    }

    for _ in 0..<60 {
      if let lessonID = next.lessonId {
        let readiness = await store.lessonReadiness(lessonID: lessonID)
        lessonStatus = readiness?.status.rawValue

        if let readiness {
          lessonKind = GenerationWait.Kind(readiness)
        }

        // Read only while the lesson isn't written, so it's kept for a learner still guessing.
        if let deckID = readiness?.warmUpId {
          warmUp = FirstLessonWarmUp(lessonID: lessonID, deckID: deckID)
        }

        if lessonStatus == "generating" || (writing?.run != nil && lessonStatus != "ready") {
          lessonStatus = "generating"
          let followed = await store.followWriting(lessonID: lessonID, run: writing?.run)

          guard !Task.isCancelled else {
            return
          }

          lessonStatus = followed?.status.rawValue ?? "failed"
        }

        if lessonStatus == "ready" {
          return
        }
      } else {
        lessonStatus = nil

        if let sessionID {
          await store.session(id: sessionID).refresh()
        }
      }

      guard writing == .preparing, lessonStatus != "failed" else {
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

/// The next stop's lesson being written as a wait: its strip over the quiz while the goal's deck
/// deals, the lesson's writing one tap away.
private struct NextStopWait<DaySoFar: View, UpNext: View, Actions: View>: View {
  let kind: GenerationWait.Kind
  let deckID: String?
  let goalID: String?
  let held: WaitHolding?
  let isWritten: Bool
  /// The lesson is written, or written and held for a learner who played.
  let isWaiting: Bool
  let note: BarNote?
  @ViewBuilder let daySoFar: () -> DaySoFar
  @ViewBuilder let upNext: () -> UpNext
  @ViewBuilder let actions: () -> Actions

  @Environment(WaitVisit.self) private var visit
  @Environment(WarmUpStore.self) private var warmUps
  @State private var since = Date.now

  var body: some View {
    let deal = WaitDeal(deck: WaitDeck(id: deckID), visit: visit, warmUps: warmUps)
    let ready = held.map { held in
      WaitReady(label: Text(words.start), icon: .play, action: held.moveOn)
    }

    PaneSplit {
      ZoonkList {
        daySoFar()
      }
    } secondary: {
      ZoonkList {
        upNext()
        wait(deal)
      }
      .waitBar(bar(.page, deal, ready: ready))
      .bottomBar(note: note) { actions() }
    } single: {
      ZoonkList {
        daySoFar()
        upNext()
        wait(deal)
      }
      .waitBar(bar(.page, deal, ready: ready))
      .bottomBar(note: note) { actions() }
    }
    .waitProgress(deal, title: title, progress: { progress }, bar: bar(.pushed, deal, ready: ready))
    .measuresWait(surface: "nextStop", contentKind: "lesson", isActive: isWaiting, goalID: goalID)
  }

  @ViewBuilder
  private func wait(_ deal: WaitDeal) -> some View {
    if deckID != nil {
      WaitSections(deal: deal, goalID: goalID) {
        WaitStatusStrip(label: title, isDone: isWritten, share: share(at:))
      } progress: {
        EmptyView()
      }
    }
  }

  @ViewBuilder
  private var progress: some View {
    WaitHeading(
      title: title,
      description: isWritten ? nil : Text(kind.writingNote))

    upNext()
  }

  private var words: LessonWaitWords { LessonWaitWords(kind) }

  private var title: Text {
    isWritten ? Text(words.ready) : Text(kind.name)
  }

  /// The session doesn't hear the writing's steps, so the ring drifts over the run's usual time.
  private func share(at date: Date) -> Double {
    let elapsed = max(0, date.timeIntervalSince(since))
    return 0.95 * (1 - exp(-elapsed / (GenerationWait.usualSeconds(kind) / 2)))
  }

  private func bar(_ place: WaitBarPlace, _ deal: WaitDeal, ready: WaitReady?) -> WaitBar<
    EmptyView
  > {
    WaitBar(
      place: place, page: deal.page(visit), dealt: deal.dealt, ready: ready, library: nil,
      extra: { EmptyView() })
  }
}

private struct FollowedLesson: Equatable {
  let lessonID: String?
  let writing: LessonWriting?
  let waits: Int
}

private struct FirstLessonWarmUp {
  let lessonID: String
  let deckID: String
}

/// A block's end, as the lesson's: what was finished, then what it earned (B2's R1).
private struct MomentSummary: View {
  let moment: BlockMoment
  var earns = true

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      title
        .typeStyle(.heroTitle)
        .accessibilityAddTraits(.isHeader)

      if earns, moment.ownBrainPower > 0 {
        EarnedBrainPower(points: moment.ownBrainPower)
      }
    }
  }

  private var title: Text {
    switch moment.blocks.first(where: { $0.id == moment.blockId })?.kind {
    case .learn:
      Text("Lesson complete", tableName: "Player", comment: "Title at the end of a lesson")
    case .review:
      Text("Review done", tableName: "Practice", comment: "End of a review block.")
    case nil:
      Text("Done", tableName: "Session", comment: "A block just finished, before its kind loads")
    default:
      Text("Practice done", tableName: "Practice", comment: "End of a practice run.")
    }
  }
}

extension GenerationWait.Kind {
  /// The next stop's line while its lesson is written: nothing else on it names a challenge.
  fileprivate var writingNote: LocalizedStringResource {
    switch self {
    case .challenge:
      LocalizedStringResource(
        "It starts here when it's ready.", table: "Session",
        comment: "A challenge whose questions are being made")
    default:
      LocalizedStringResource(
        "It takes a few minutes.", table: "Session", comment: "A lesson being written")
    }
  }
}
