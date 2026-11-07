import SwiftUI

struct TodayDayView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.isCoveredByTask) private var isCovered
  @Environment(AppRouter.self) private var router
  @Environment(TodayStore.self) private var store

  let view: TodayView

  @State private var busy: Tap?
  @State private var failed: Tap?
  @State private var tapTask: Task<Void, Never>?
  @State private var disclosures = TodayDisclosures()
  @State private var writingStalled = false
  /// Main's `useShownNotice`: the notice Today opened with stays while the learner is here, so
  /// answering it shows what the answer did; the next waits for the next visit.
  @State private var shownNotice: TodayView.Notice?
  @State private var examChecklist: Set<ExamView.ChecklistItem> = []
  @State private var examChoice: PlanEditor?
  @State private var examChoiceDraft: [String] = []
  @State private var adjusting: AdjustPlanSheet.Section?
  @State private var answeredUpload: TodayView.UploadRequest?
  @State private var uploadDraft = MaterialDraft()

  enum Tap: Equatable {
    case block(Int)
    case catchUp
    case keepLearning
    case main
    case mission(Int)
    case planChange
    case prepare
  }

  var body: some View {
    PaneSplit(primaryShare: 0.55) {
      ZoonkList {
        header(actionInHeader: false)
        // It asks for a decision, so it leads the day where the day has room beside it.
        notice
        day(showsAction: true)
      }
    } secondary: {
      ZoonkList {
        aside
        TodayPracticeSection(view: view, language: language)
      }
    } single: {
      // Main's tablet column heads the day with its action.
      let actionInHeader = horizontalSizeClass == .regular

      ZoonkList {
        header(actionInHeader: actionInHeader)
        day(showsAction: !actionInHeader)
        notice

        // Main's tablet column: missions beside the week, preparation beside practice.
        if actionInHeader {
          BlockGridSection {
            aside
            TodayPracticeSection(view: view, language: language)
          }
        } else {
          aside
          TodayPracticeSection(view: view, language: language)
        }
      }
    }
    .announcesStatus(TodayDayStatus(view: view, writingStalled: writingStalled)?.announcement)
    .onAppear(perform: startVisit)
    .onChange(of: isCovered) {
      if isCovered {
        tapTask?.cancel()
      } else {
        startVisit()
      }
    }
    .onChange(of: view.notice) {
      if shownNotice == nil {
        shownNotice = view.notice
        countNotice()
      }
    }
    .modifier(LanguageTodayLoading(goal: view.goal))
    .sheet(item: $adjusting) { section in
      TodayAdjustPlanSheet(goalID: view.goal.id, section: section)
        .zoonkStyles()
    }
    .barTitleAfterHero(String(localized: "Today", table: "Today", comment: "Today tab's title"))
    .task(id: view.session.localDate) {
      await refreshAtDayEnd()
    }
    .task(id: followedLessonIDs) {
      await store.followWriting(lessonIDs: followedLessonIDs)
    }
    .task(id: view.isAwaitingOutlines && !isCovered ? view : nil) {
      await rereadWhileOutlining()
    }
    .onDisappear {
      tapTask?.cancel()
    }
  }

  private func header(actionInHeader: Bool) -> some View {
    let lead = TodayDayLead(view: view)

    return Section {
      VStack(alignment: .leading, spacing: 6) {
        PageHeader(
          Text("Today", tableName: "Today", comment: "Today tab's title"), eyebrow: dayLine
        ) {
          HStack(alignment: .lastTextBaseline, spacing: 16) {
            if let dayTime {
              BigQuantity(dayTime)
            }

            if actionInHeader, TodaySessionAction.offers(view) {
              sessionAction(isInHeader: true)
            }
          }
        }

        if view.dayLeadJoinsHeader, !lead.isEmpty {
          lead
        }
      }
    }
    .listSectionSpacing(.compact)
  }

  /// Main's `DayTime`: the time still ahead while the day goes on, and once it's done, or the daily
  /// limit ended it, the time actually studied rather than the plan's estimate for what was done.
  private var dayTime: String? {
    let session = view.session

    if session.state == .waiting {
      return nil
    }

    if session.state == .done || session.dailyLimit?.reached == true {
      let studied = session.week.days.first(where: \.isToday)?.minutes ?? 0

      return studied > 0
        ? String(
          localized: "\(studyDuration(minutes: studied)) studied", table: "Today",
          comment:
            "The time studied today, once the day's session is done; the argument is a duration like '23 min'"
        )
        : nil
    }

    return session.minutesLeft > 0
      ? String(
        localized: "\(studyDuration(minutes: session.minutesLeft)) left", table: "Today",
        comment: "The time still to go in today's session")
      : nil
  }

  @ViewBuilder
  private func day(showsAction: Bool) -> some View {
    TodaySessionSection(
      view: view, busy: busy, failed: failed, writingStalled: writingStalled,
      disclosures: $disclosures, open: open, showsAction: showsAction, prepare: prepareLessons)

    if !view.upNextLessons.isEmpty {
      TodayUpNextSection(view: view, busy: busy, failed: failed == .keepLearning) {
        run(.keepLearning) { await store.addExtraTime(in: view) }
      }
    }

    TodayMoreSection(
      view: view, busy: busy, failed: failed,
      addTime: { run(.keepLearning) { await store.addExtraTime(in: view) } },
      catchUp: {
        perform(.catchUp) { await store.catchUp(in: view) }
      })
  }

  private func sessionAction(isInHeader: Bool) -> some View {
    TodaySessionAction(
      view: view, busy: busy, failed: failed, open: open, prepare: prepareLessons,
      isInHeader: isInHeader)
  }

  private func prepareLessons() {
    perform(.prepare) { await store.prepareLessons(in: view) }
  }

  @ViewBuilder
  private var planChange: some View {
    if let shown = store.shownPlanChange(in: view) {
      TodayPlanChangeSection(
        view: view, shown: shown, next: store.nextPlanChange(in: view),
        isOpen: $disclosures.planChange, isSaving: busy == .planChange,
        failed: failed == .planChange
      ) { decision in
        perform(.planChange) { await store.answer(shown.change, with: decision, in: view) }
      } showNext: {
        disclosures.planChange = false
        store.dropAnsweredPlanChange()
      } adjust: { section in
        adjusting = section
      }
    }
  }

  private var followedLessonIDs: [String] {
    isCovered ? [] : store.writingLessonIDs(in: view)
  }

  private var language: LanguageTodayView? {
    view.goal.kind == .language ? store.languageToday(goalID: view.goal.id).value : nil
  }

  @ViewBuilder
  private var notice: some View {
    switch shownNotice ?? view.notice {
    case .planChange:
      planChange
    case .insight:
      if let insight = view.insight {
        Section {
          MemoryInsightCard(insight: insight)
        }
        .listRowBackground(Color.clear)
        .listRowInsets(.vertical, 0)
      }
    case .practice:
      TodayLanguagePracticeSection(view: view, language: language)
    case .sourceChange:
      if let message = view.sourceChange {
        TodaySourceChangeSection(message: message)
      }
    case .exam:
      if let exam = view.exam {
        ExamMomentSection(moment: exam, checked: $examChecklist) {
          Button {
            router.open(.exam)
          } label: {
            exam.stage == .afterExam
              ? Text(
                "Add your result", tableName: "Today",
                comment: "Opens the exam to add the official result")
              : Text("See your exam", tableName: "Today", comment: "Opens the exam")
          }
        }
      }
    case .examAccess:
      Section {
        FreeWeekOverNotice()
      }
    case .examChoice:
      TodayExamChoiceSection(
        goalID: view.goal.id, choice: view.examChoice, editor: $examChoice,
        draft: $examChoiceDraft)
    case .suggestedGoal:
      if let suggestion = view.suggestedGoal {
        SuggestedGoalSection(suggestion: suggestion)
      }
    case .uploadRequest:
      if let request = answeredUpload ?? view.uploadRequest {
        TodayUploadRequestSection(
          request: request, answered: answeredUpload != nil, draft: $uploadDraft
        ) {
          answeredUpload = request
        }
      }
    case nil:
      EmptyView()
    }
  }

  @ViewBuilder
  private var aside: some View {
    if !view.session.missions.isEmpty {
      TodayMissionsSection(view: view, busy: busy, failed: failed, open: openMission)
    }

    TodayWeekSection(view: view)

    // A phone leaves where the goal stands to the Plan.
    if horizontalSizeClass == .regular {
      TodayProgressSection(view: view)
    }
  }

  private var dayLine: Text {
    var parts: [String] = []

    if let date = studyDate(view.session.localDate) {
      parts.append(date.formatted(.studyDay.weekday(.abbreviated).month(.abbreviated).day()))
    }

    if let daysLeft = view.goal.daysLeft {
      parts.append(
        view.goal.dateEstimated
          ? String(localized: "~\(daysLeft) days left", table: "Today", comment: "Days left")
          : daysLeft == 0
            ? String(localized: "The day is here", table: "Today", comment: "The goal's date")
            : String(localized: "\(daysLeft) days left", table: "Today", comment: "Days left"))
    }

    if let exam = view.exam, exam.stage == .dayBefore || exam.stage == .examDay {
      parts.append(
        exam.stage == .dayBefore
          ? String(localized: "\(exam.examName) tomorrow", table: "Today", comment: "Exam soon")
          : String(localized: "\(exam.examName) today", table: "Today", comment: "Exam day"))
    }

    if let status = view.progress?.status {
      if status.kind == "behind" && view.session.freshStart == .welcomeBack {
        parts.append(String(localized: "Behind", table: "Today", comment: "Plan status"))
      } else {
        parts.append(status.text)
      }
    }

    return Text(parts.joinedFacts())
  }

  private func open(_ block: StudyBlock, next: Bool) {
    let tap: Tap = next ? .main : .block(block.position)

    run(tap) {
      await store.open(block, as: next ? .next : .block, in: view)
    }
  }

  private func openMission(_ block: StudyBlock) {
    run(.mission(block.position)) {
      await store.open(block, as: .mission, in: view)
    }
  }

  /// A tap whose screen went (another day, another tab, a task over it) or whose learner left is
  /// cancelled: it opens nothing and says nothing.
  private func run(_ tap: Tap, _ action: @escaping () async -> MutationResult<StudyDestination>) {
    guard busy == nil else {
      return
    }

    busy = tap
    failed = nil

    tapTask = Task {
      let result = await action()
      busy = nil

      switch result {
      case .done(let destination) where !Task.isCancelled:
        router.openStudy(destination)
      case .failed:
        failed = tap
      case .done, .obsolete:
        break
      }
    }
  }

  private func perform(_ tap: Tap, _ action: @escaping () async -> MutationResult<Void>) {
    guard busy == nil else {
      return
    }

    busy = tap
    failed = nil

    tapTask = Task {
      let result = await action()
      busy = nil

      if case .failed = result {
        failed = tap
      }
    }
  }

  private func refreshAtDayEnd() async {
    let end = Date(timeIntervalSince1970: Double(view.session.dayEndsAt) / 1_000)

    do {
      try await Task.sleep(for: .seconds(max(1, end.timeIntervalSinceNow)))
    } catch {
      return
    }

    await store.today.refresh()
  }

  /// The API names no run for a day's outlines (one can wait for its course before any run starts),
  /// so Today reads the day again as main's `usePoll` does: through the learner's 15-minute ask for
  /// lessons plus one read, again from each read that changes the day, then it says it's taking
  /// longer. Not while a task covers Today.
  private func rereadWhileOutlining() async {
    writingStalled = false

    guard view.isAwaitingOutlines, !isCovered else {
      return
    }

    let deadline = ContinuousClock.now + .seconds(905)

    while ContinuousClock.now < deadline {
      do {
        try await Task.sleep(for: .seconds(5))
      } catch {
        return
      }

      await store.today.refresh()
    }

    writingStalled = true
  }

  /// Main reads Today afresh on each visit (back from a lesson or another tab): what the learner
  /// answered stays only while they're here.
  private func startVisit() {
    shownNotice = view.notice
    examChoice = nil
    examChoiceDraft = []
    answeredUpload = nil
    store.dropAnsweredPlanChange()
    UsageAnalytics.track(.todayViewed)
    countNotice()
  }

  /// Once a visit, as main's notices count when they mount: folding redraws the panes, not the visit.
  private func countNotice() {
    switch shownNotice {
    case .insight:
      if let insight = view.insight {
        UsageAnalytics.track(.insightShown(.init(insight)))
      }
    case .examAccess:
      UsageAnalytics.track(.subscriptionGateShown)
    default:
      break
    }
  }
}

extension AppRouter {
  /// Nothing opens when it couldn't, or once the learner moved on, which comes back `obsolete` so
  /// nothing says it failed.
  static func openingTodayBlocks(today: TodayStore) -> BlockOpener {
    { blockID, router in
      let shown = router.shown
      let result = await today.open(blockID: blockID)

      guard shown == router.shown else {
        return .obsolete
      }

      if case .done(let destination) = result {
        router.openStudy(destination)
      }

      return result
    }
  }

  /// Anything but a question block opens its own screen over the session, so closing it goes on with
  /// the day; a question block plays in the session, which comes to the front. `changed` opens
  /// nothing: the screen the learner tapped on reads again.
  func openStudy(_ destination: StudyDestination) {
    switch destination {
    case .questionBlock(let blockID):
      playback.play(blockID: blockID)
    case .today:
      return showRoot(of: .today)
    case .changed:
      return
    default:
      break
    }

    guard let step = destination.step else {
      if let session = tasks.firstIndex(of: .session) {
        task(at: session + 1).wrappedValue = nil
      } else {
        open(.session)
      }

      return
    }

    if tasks.contains(.session) {
      open(step)
    } else {
      open(step, over: .session)
    }
  }
}

extension StudyDestination {
  /// Nil for what the session shows itself.
  fileprivate var step: AppRoute? {
    switch self {
    case .challenge(let planItemID, let sessionID):
      .challenge(planItemId: planItemID, sessionId: sessionID)
    case .checkpoint(let blockID, let sessionID):
      .checkpoint(blockId: blockID, sessionId: sessionID)
    case .essay(let blockID):
      .essay(blockId: blockID)
    case .lesson(let lessonID, let sessionID):
      .lesson(lessonId: lessonID, sessionId: sessionID)
    case .mock(let blockID, let sessionID):
      .mock(blockId: blockID, sessionId: sessionID)
    case .questionBlock, .session, .lessonWait, .today, .changed:
      nil
    }
  }
}

/// A language goal's day reads its practice beside it.
private struct LanguageTodayLoading: ViewModifier {
  @Environment(TodayStore.self) private var store

  let goal: TodayView.Goal

  func body(content: Content) -> some View {
    if goal.kind == .language {
      content.loads(store.languageToday(goalID: goal.id), refreshable: false)
    } else {
      content
    }
  }
}
