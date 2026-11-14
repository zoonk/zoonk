import SwiftUI

struct TodayDayView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.isCoveredByTask) private var isCovered
  @Environment(AppRouter.self) private var router
  @Environment(TodayStore.self) private var store
  @Environment(PlanStore.self) private var plans

  let view: TodayView

  @State private var busy: Tap?
  @State private var failed: Tap?
  @State private var tapTask: Task<Void, Never>?
  @State private var disclosures = TodayDisclosures()
  @State private var writingStalled = false
  /// The notice Today opened with stays while the learner is here, so answering it shows what the
  /// answer did; the next waits for the next visit. Today opens on its first settled read, not on
  /// the stored one shown while a newer read loads.
  @State private var shownNotice: TodayView.Notice?
  /// The learner said Not now to the Focus test on this visit.
  @State private var focusTestNoted = false
  @State private var examChecklist: Set<ExamView.ChecklistItem> = []
  @State private var examChoice: PlanEditor?
  @State private var examChoiceDraft: [String] = []
  @State private var adjusting: AdjustPlanSheet.Section?
  @State private var answeredUpload: TodayView.UploadRequest?
  /// Today stops carrying an insight once it's answered, so its card keeps it to show the answer.
  @State private var answeredInsight: MemoryInsight?
  @State private var insightAnswers: [String: Bool] = [:]
  @State private var uploadDraft = MaterialDraft()
  @State private var suggestedGoalAnswer = SuggestedGoalAnswer()

  enum Tap: Equatable {
    case archive
    case block(Int)
    case catchUp
    case keepLearning
    case keepStudying
    case main
    case mission(Int)
    case planChange
    case prepare
    case upNextLesson
  }

  var body: some View {
    ScrollViewReader { scroller in
      PaneSplit(primaryShare: 0.55) {
        ZoonkList {
          header(actionInHeader: false)
          // It asks for a decision, so it leads the day where the day has room beside it.
          notice
          day
        }
        .modifier(actionBar)
      } secondary: {
        ZoonkList {
          UnfinishedGoalSection()
          aside
          TodayPracticeSection(view: view, language: language)
        }
      } single: {
        // Main's tablet column heads the day with its action.
        let actionInHeader = horizontalSizeClass == .regular

        ZoonkList {
          header(actionInHeader: actionInHeader)
          day
          notice
          UnfinishedGoalSection()

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
        .modifier(actionBar.shown(!actionInHeader))
      }
      // A new visit folds the day's later blocks out from under a learner who'd scrolled down them,
      // which the list alone leaves scrolled past them.
      .onChange(of: disclosures.showsMore) {
        if !disclosures.showsMore {
          scroller.scrollTo(TodaySessionSection.moreFold, anchor: nil)
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
    .onChange(of: settledNotice) {
      if shownNotice == nil {
        shownNotice = settledNotice
        countNotice()
      }
    }
    .onChange(of: examChoice != nil) {
      if examChoice != nil {
        holdShownNotice()
      }
    }
    // Its open state is kept above the panes, so it outlives a proposal that's answered here, answered
    // elsewhere or replaced by a newer edit; main's sheet closes with it.
    .onChange(of: asksPlanChange) {
      if !asksPlanChange {
        disclosures.planChange = false
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
    let lead = TodayDayLead(view: view, writingStalled: writingStalled)

    return Section {
      VStack(alignment: .leading, spacing: 6) {
        PageHeader(
          Text("Today", tableName: "Today", comment: "Today tab's title"), supporting: dayLine
        ) {
          HStack(alignment: .lastTextBaseline, spacing: 16) {
            if let dayTime {
              if let mockDay = view.mockDay {
                ShorterDayTime(time: dayTime, mockDay: mockDay)
              } else {
                BigQuantity(dayTime)
              }
            }

            if actionInHeader, TodaySessionAction.offers(view) {
              sessionAction(isInHeader: true)
            }
          }
        }

        if !view.isWelcomeBack, view.lacksTime {
          Button {
            router.select(.plan)
          } label: {
            Text(
              "Adjust your plan", tableName: "Today", comment: "Opens the Plan to fit its lessons"
            )
            .disclosureChevron()
          }
          .buttonStyle(.plain)
          .typeStyle(.body.weight(.medium))
          .foregroundStyle(Color(.foreground))
        }

        if !lead.isEmpty {
          lead
        }
      }
    }
    .listSectionSpacing(.compact)
  }

  /// Once the day ends, show time actually studied rather than the plan's estimate.
  private var dayTime: String? {
    let session = view.session

    if session.state == .done {
      let studied = session.week.days.first(where: \.isToday)?.minutes ?? 0

      return studied > 0
        ? String(
          localized: "\(studyDuration(minutes: studied)) studied", table: "Today",
          comment:
            "The time studied today, once the day's session is done; the argument is a duration like '23 min'"
        )
        : nil
    }

    return session.minutes.left > 0
      ? String(
        localized: "\(studyDuration(minutes: session.minutes.left)) left", table: "Today",
        comment: "The time still to go in today's session")
      : nil
  }

  /// On a phone the day's main action sits in the bottom bar; on a wider page, beside the title.
  private var actionBar: TodayActionBar {
    TodayActionBar(
      action: sessionAction(isInHeader: false), offers: TodaySessionAction.offers(view))
  }

  @ViewBuilder
  private var day: some View {
    TodaySessionSection(
      view: view, busy: busy, failed: failed, writingStalled: writingStalled,
      disclosures: $disclosures, open: open, prepare: prepareLessons)

    if !view.upNextLessons.isEmpty {
      TodayUpNextSection(view: view, busy: busy, failed: failed) { tap in
        run(tap) { await store.addExtraTime(in: view) }
      }
    }

    TodayMoreSection(
      view: view, busy: busy, failed: failed,
      addTime: { run(.keepLearning) { await store.addExtraTime(in: view) } },
      catchUp: {
        perform(.catchUp) { await store.catchUp(in: view) }
      })
  }

  private func sessionAction(isInHeader: Bool) -> TodaySessionAction {
    TodaySessionAction(
      view: view, busy: busy, failed: failed, open: open, prepare: prepareLessons,
      keepLearning: keepLearning, keepStudying: keepStudying, archive: archive,
      isInHeader: isInHeader)
  }

  private func keepStudying() {
    let goalId = view.goal.id
    perform(.keepStudying) {
      switch await plans.change(goalId: goalId, edits: [.fullCourse(true)]) {
      case .done(.invalid): .failed(.unavailable)
      case .done: .done(())
      case .failed(let error): .failed(error)
      case .obsolete: .obsolete
      }
    }
  }

  private func archive() {
    let goalId = view.goal.id
    perform(.archive) {
      switch await plans.setStatus(.archived, goalId: goalId) {
      case .done(.saved): .done(())
      case .done: .failed(.unavailable)
      case .failed(let error): .failed(error)
      case .obsolete: .obsolete
      }
    }
  }

  private func keepLearning() {
    run(.keepLearning) { await store.addExtraTime(in: view) }
  }

  private func prepareLessons() {
    perform(.prepare) { await store.prepareLessons(in: view) }
  }

  /// A proposal still waits for an answer, in the sheet its line opens.
  private var asksPlanChange: Bool {
    store.shownPlanChange(in: view).map { $0.decision == nil } ?? false
  }

  @ViewBuilder
  private var planChange: some View {
    if let shown = store.shownPlanChange(in: view) {
      TodayPlanChangeSection(
        view: view, shown: shown, next: store.nextPlanChange(in: view),
        isOpen: $disclosures.planChange, isSaving: busy == .planChange,
        failed: failed == .planChange
      ) { decision in
        holdShownNotice()
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
      if let insight = view.insight ?? answeredInsight {
        Section {
          MemoryInsightCard(
            insight: insight,
            answer: Binding(
              get: { insightAnswers[insight.id] }, set: { insightAnswers[insight.id] = $0 })
          ) {
            holdShownNotice()
            answeredInsight = insight
          }
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
        TodayExamMomentSection(moment: exam, checked: $examChecklist)
      }
    case .examChoice:
      TodayExamChoiceSection(
        goalID: view.goal.id, choice: view.examChoice, editor: $examChoice,
        draft: $examChoiceDraft)
    case .focusTest:
      TodayFocusTestSection(
        goalID: view.goal.id, offer: view.focusTest, dismissed: $focusTestNoted,
        onAnswer: holdShownNotice)
    case .suggestedGoal:
      if let suggestion = view.suggestedGoal {
        SuggestedGoalSection(suggestion: suggestion, answer: suggestedGoalAnswer)
      }
    case .uploadRequest:
      if let request = answeredUpload ?? view.uploadRequest {
        TodayUploadRequestSection(
          request: request, answered: answeredUpload != nil, draft: $uploadDraft
        ) {
          holdShownNotice()
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

  /// One line under the title at most, and only what changes today: a normal day has none. A
  /// return after days away leads with its welcome, so the plan's state waits for the learner to
  /// start.
  private var dayLine: Text? {
    if view.isWelcomeBack {
      return Text(
        "Welcome back. Today is short, so it's easy to start again.", tableName: "Today",
        comment: "Under Today's title on a return after days away, until the learner starts")
    }

    if view.lacksTime {
      return Text(
        "Not enough time left for all your lessons.", tableName: "Today",
        comment: "Under Today's title when the plan has more lessons than its days can hold")
    }

    if let exam = view.exam, exam.stage == .finalStretch, let days = view.goal.daysLeft {
      return Text(
        "\(exam.examName) in \(days) days", tableName: "Today",
        comment:
          "Under Today's title in an exam's last weeks: the exam's name, like ENEM, and the days until it"
      )
    }

    return nil
  }

  private func open(_ block: StudyBlock, next: Bool) {
    if view.session.waitsForStart(block) {
      showIntro(of: block)
      return
    }

    let tap: Tap = next ? .main : .block(block.position)

    run(tap) {
      await store.open(block, as: next ? .next : .block, in: view)
    }
  }

  private func openMission(_ block: StudyBlock) {
    if view.session.waitsForStart(block) {
      showIntro(of: block)
      return
    }

    run(.mission(block.position)) {
      await store.open(block, as: .mission, in: view)
    }
  }

  private func showIntro(of block: StudyBlock) {
    guard busy == nil else {
      return
    }

    failed = nil
    router.showIntro(of: block)
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

  private var settledNotice: TodayView.Notice? {
    if store.today.isRefreshing {
      return nil
    }

    if case .loading = store.today.freshState {
      return nil
    }

    return view.notice
  }

  /// Answering the stored day's notice before the newer read lands holds it, so its result stays.
  private func holdShownNotice() {
    if shownNotice == nil {
      shownNotice = view.notice
      countNotice()
    }
  }

  /// Main reads Today afresh on each visit (back from a lesson or another tab): what the learner
  /// answered stays only while they're here.
  private func startVisit() {
    shownNotice = settledNotice
    disclosures.showsDone = false
    disclosures.showsMore = false
    examChoice = nil
    examChoiceDraft = []
    answeredUpload = nil
    answeredInsight = nil
    insightAnswers = [:]
    focusTestNoted = false
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

  /// Opens nothing on the server: the intro's Start does.
  func showIntro(of block: StudyBlock) {
    playback.show(blockID: block.id)
    openStudy(.session)
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
      return open(.session)
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
    case .instantLesson(let lessonID, let sessionID, let opening):
      .lesson(lessonId: lessonID, sessionId: sessionID, opening: opening, activated: true)
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

private struct TodayActionBar: ViewModifier {
  let action: TodaySessionAction
  let offers: Bool
  var isShown = true

  func shown(_ isShown: Bool) -> Self {
    var bar = self
    bar.isShown = isShown
    return bar
  }

  func body(content: Content) -> some View {
    content.bottomBar(note: isShown ? action.failure.map { BarNote($0) } : nil) {
      if isShown, offers {
        action
      }
    }
  }
}

extension TodayView {
  /// Main's `useWelcomeBack`: a return after days away, until the learner starts.
  var isWelcomeBack: Bool {
    let state = session.state

    return session.freshStart == .welcomeBack && !studiedToday && !session.isStarted
      && state != .ahead && state != .rest
  }

  /// The plan has more lessons than its days can hold.
  var lacksTime: Bool {
    progress?.status?.kind == "needsAdjusting"
  }
}

/// Main's day time on a day kept short for a mock exam: why opens from the time itself.
private struct ShorterDayTime: View {
  let time: String
  let mockDay: String

  @State private var isExplaining = false

  var body: some View {
    Button {
      isExplaining = true
    } label: {
      BigQuantity(time)
        .underline(pattern: .dot)
    }
    .buttonStyle(.plain)
    .popover(isPresented: $isExplaining) {
      VStack(alignment: .leading, spacing: 4) {
        Text(
          "A shorter day", tableName: "Today", comment: "Title of the note on why today is short"
        )
        .typeStyle(.body.weight(.semibold))

        Text(
          "Your plan keeps time for the mock exam on \(mockDay).", tableName: "Today",
          comment: "Why today is short; the argument is the mock exam's date, like 'May 5'"
        )
        .typeStyle(.body)
        .foregroundStyle(.mutedForeground)
      }
      .padding()
      .frame(idealWidth: 280)
      .presentationCompactAdaptation(.popover)
    }
  }
}
