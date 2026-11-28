import SwiftUI

struct SessionScreen: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var plans
  @Environment(StudySessionStore.self) private var store
  @Environment(TodayStore.self) private var today

  var summarySessionID: String?

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
      if summarySessionID == nil, let sessionID = today.sessionID,
        let blockID = playback.playingBlockID
      {
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
            if let summarySessionID {
              SessionSummaryView(sessionID: summarySessionID, stopped: false, isExplicit: true)
                .loads(store.session(id: summarySessionID), refreshable: false)
            } else if let sessionID = today.sessionID {
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
              StateMessage {
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
      if summarySessionID == nil {
        playback.leave()
      }
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
            .id(sessionID)
        } else {
          NextStopView(
            day: day, sessionID: sessionID, goalID: day.goalId ?? today.day?.goal.id,
            moment: playback.moment)
        }
      } else if case .failed(let error) = session.state, error != .unauthorized {
        PageLoadFailure {
          Label {
            Text("The session didn't load", tableName: "Session", comment: "Load failed")
          } icon: {
            Image(systemName: "wifi.exclamationmark")
          }
        } retry: {
          await session.refresh()
        }
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

  @State private var action = VisitRequest<(failed: Bool, stopFailed: Bool)>()
  /// Taps that left a lesson waiting here, so a retry the same run answers follows it again.
  @State private var waits = 0
  @State private var isOpening = false
  @State private var isStopping = false
  private var failed: Bool { action.outcome?.failed ?? false }
  private var stopFailed: Bool { action.outcome?.stopFailed ?? false }
  @State private var read: LessonRead?
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
    .taskThroughPush(
      id: FollowedLesson(
        lessonID: next?.lessonId, snapshot: next?.lesson, writing: writing, waits: waits)
    ) {
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
      action.leave()
      isOpening = false
      isStopping = false
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
      isWritten: lessonStatus == .ready,
      isWaiting: isLessonWorkRunning || held != nil, note: failureNote
    ) { isPane in
      daySoFar(isPane: isPane)
    } upNext: {
      upNext
    } actions: {
      actions(isHeld: held != nil)
    }
  }

  /// Only for the lesson being written, never one that failed or can't be written.
  private var warmUpDeckID: String? {
    guard let warmUp, warmUp.lessonID == next?.lessonId, !isLessonUnavailable, !isLessonFailed
    else {
      return nil
    }

    return warmUp.deckID
  }

  /// On a pane of its own the bar says its count; over the next step it's the header's bar, which
  /// only VoiceOver reads as a count, as main's session header does.
  @ViewBuilder
  private func daySoFar(isPane: Bool) -> some View {
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
          if isPane {
            DayProgressLead(bar: day.sessionBar, isOpen: false)
          }

          DaySegments(segments: day.daySegments.map(\.mark))
            .accessibilityElement()
            .accessibilityLabel(
              Text(
                "\(day.sessionBar.completed) of \(day.sessionBar.total) done",
                tableName: "Today", comment: "How far the day's session is")
            )
            .accessibilityHidden(isPane)
        }
      }
    }
  }

  @ViewBuilder
  private var upNext: some View {
    if let next {
      Section {
        UpNextTitle(
          block: next,
          line: next.kind == .review && !next.capsules.isEmpty
            && ReviewIntro.isEarly(goalID: goalID)
            ? ReviewIntro.earlyLine : next.detail)

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
      } else if isSetAside {
        Section {
          StateMessage {
            Label {
              Text(Self.setAsideTitle)
            } icon: {
              Image(systemName: "exclamationmark.circle")
            }
          } description: {
            Text(Self.setAsideReason)
          }
        }
      } else if isLessonFailed {
        Section {
          GenerationFailureNotice(failure: .generation, isActing: isOpening) {
            open(next)
          }
          .environment(\.barHoldsMainAction, alternative != nil)
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
        BusyButton(isBusy: isStopping, icon: .stop) {
          stop(sessionID: sessionID)
        } label: {
          Text("Stop for today", tableName: "Session", comment: "Ends the session for today")
        }
        .buttonStyle(.outline)
        .disabled(isOpening)
      }

      if let alternative, isLessonWorkRunning || isLessonUnavailable || isLessonFailed {
        mainButton(alternativeTitle(alternative), block: alternative)
      } else if let next, lesson.canStart, !isHeld {
        mainButton(continueTitle, block: next)
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

  private var lesson: NextStopLesson {
    NextStopLesson(block: next, read: read, writing: writing)
  }

  private var lessonStatus: LessonStatus? { lesson.status }
  private var isSetAside: Bool { lesson.isSetAside }
  private var isLessonWorkRunning: Bool { lesson.isWriting }
  private var isLessonUnavailable: Bool { lesson.isUnavailable }
  private var isLessonFailed: Bool { lesson.isFailed }

  /// Offered, never opened on its own: the learner may be reading, or doing what "While you wait"
  /// offered.
  private var isWrittenWhileWaiting: Bool {
    lessonStatus == .ready && waitedFor != nil && waitedFor == next?.id
  }

  private var notWrittenLine: String? {
    if case .refused(let refusal) = writing {
      return LessonUnavailableView(refusal: refusal) {}.said
    }

    return isSetAside ? [Self.setAsideTitle, Self.setAsideReason].joinedSentences() : nil
  }

  private static let setAsideTitle = String(
    localized: "This lesson isn't available", table: "Session",
    comment: "A lesson its quality checks set aside")

  private static let setAsideReason = String(
    localized: "Your plan goes on without it.",
    table: "Session", comment: "A lesson its quality checks set aside")

  private var continueTitle: Text {
    next?.status == .active
      ? Text("Continue", tableName: "Session", comment: "Opens the session's next block")
      : Text(
        "Start", tableName: "Session", comment: "Opens the session's next block, not begun yet")
  }

  /// A verb for what the learner can do meanwhile; only a challenge needs its name.
  private func alternativeTitle(_ block: StudyBlock) -> Text {
    if block.checkpoint != nil {
      return Text(
        "Start \(block.displayTitle)", tableName: "Session",
        comment: "Starts another of the day's steps instead; the argument is its name")
    }

    return block.kind == .review
      ? Text("Review now", tableName: "Session", comment: "Starts the day's review instead")
      : Text("Practice now", tableName: "Session", comment: "Starts the day's practice instead")
  }

  private var lessonLine: AnyView? {
    guard next?.kind == .learn, !isSetAside else {
      return nil
    }

    if isWrittenWhileWaiting {
      return AnyView(
        Text(
          "Your lesson is ready.", tableName: "Session",
          comment: "A lesson written while the learner waited, offered with Start"))
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

  private var alternative: StudyBlock? {
    day.alternative.flatMap { $0.position == next?.position ? nil : $0 }
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
    action.run {
      var outcome: (failed: Bool, stopFailed: Bool) = (failed: false, stopFailed: false)

      let result = await opening(block)
      guard !Task.isCancelled else { return nil }
      isOpening = false

      switch result {
      case .done(.lessonWait):
        // What the tap was told is newer than any earlier read.
        read = nil
        waits += 1
      case .done(.session):
        // The session shows this step itself.
        break
      case .done(let destination) where !Task.isCancelled:
        router.openStudy(destination)
      case .done:
        break
      case .failed:
        outcome.failed = true
      case .obsolete:
        break
      }

      return outcome
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
    action.run {
      var outcome: (failed: Bool, stopFailed: Bool) = (failed: false, stopFailed: false)

      let result = await store.stop(sessionID: sessionID, in: router.playback)
      guard !Task.isCancelled else { return nil }
      if case .failed = result {
        outcome.stopFailed = true
      }

      isStopping = false

      return outcome
    }
  }

  /// A lesson its checks set aside is never written, so it isn't read again.
  private func followLesson() async {
    guard let next, next.kind == .learn, let lessonID = next.lessonId else {
      return
    }

    while lessonStatus != .ready, !isSetAside {
      if let readiness = await store.lessonReadiness(lessonID: lessonID), !Task.isCancelled {
        show(readiness, of: lessonID)

        if readiness.status == .generating,
          let followed = await store.followWriting(
            lessonID: lessonID, run: readiness.generationId),
          !Task.isCancelled
        {
          show(followed, of: lessonID)
        }
      }

      guard lessonStatus != .ready, !isSetAside else {
        return
      }

      do {
        try await Task.sleep(for: .seconds(5))
      } catch {
        return
      }
    }
  }

  private func show(_ readiness: Components.Schemas.LessonReadiness, of lessonID: String) {
    lessonKind = GenerationWait.Kind(readiness)

    // Read only while the lesson isn't written, so it's kept for a learner still guessing.
    if let deckID = readiness.warmUpId {
      warmUp = FirstLessonWarmUp(lessonID: lessonID, deckID: deckID)
    }

    guard let status = LessonStatus(rawValue: readiness.status.rawValue) else {
      return
    }

    let shown = (lessonStatus, isSetAside)
    read = LessonRead(lessonID: lessonID, status: status, setAside: readiness.setAside)

    if shown != (lessonStatus, isSetAside) {
      store.lessonChanged()
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
  /// Says whether the day so far stands on a pane of its own.
  @ViewBuilder let daySoFar: (_ isPane: Bool) -> DaySoFar
  @ViewBuilder let upNext: () -> UpNext
  @ViewBuilder let actions: () -> Actions

  @Environment(WaitVisit.self) private var visit
  @Environment(WarmUpStore.self) private var warmUps
  @State private var since = Date.now

  var body: some View {
    let deal = WaitDeal(deck: WaitDeck(id: deckID), visit: visit, warmUps: warmUps)
    let ready = held.map { held in
      WaitReady(label: Text(words.start), action: held.moveOn)
    }

    PaneSplit {
      ZoonkList {
        daySoFar(true)
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
        daySoFar(false)
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

/// A day read again can say the lesson moved on, so the follow starts over from it.
private struct FollowedLesson: Equatable {
  let lessonID: String?
  let snapshot: StudyBlock.Lesson?
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
        "Your lesson is usually ready in a few minutes.", table: "Session",
        comment: "A lesson being written")
    }
  }
}

/// Main's next stop heading: the step's name as the screen's title, its one line and its facts.
private struct UpNextTitle: View {
  let block: StudyBlock
  let line: String?

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(block.displayTitle)
        .typeStyle(.pageTitle)
        .accessibilityAddTraits(.isHeader)

      if let line {
        Text(line)
          .typeStyle(.body)
          .foregroundStyle(.mutedForeground)
      }

      FactSegments(facts)
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
    }
  }

  private var facts: [String] {
    [
      studyDuration(minutes: block.estimatedMinutes),
      block.oftenTested
        ? String(localized: "Often tested", table: "Session", locale: .appLanguage) : nil,
    ].compactMap(\.self)
  }
}
