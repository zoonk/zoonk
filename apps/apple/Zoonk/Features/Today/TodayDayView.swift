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

  enum Tap: Equatable {
    case block(Int)
    case catchUp
    case keepLearning
    case main
    case planChange
    case prepare
  }

  var body: some View {
    PaneSplit(primaryShare: 0.55) {
      List {
        // It asks for a decision, so it leads the day where the day has room beside it.
        notice
        day
      }
    } secondary: {
      List {
        aside
        TodayPracticeSection(view: view, language: language)
      }
    } single: {
      List {
        day
        notice
        aside
        TodayPracticeSection(view: view, language: language)
      }
    }
    .listStyle(.insetGrouped)
    .onAppear(perform: startVisit)
    .onChange(of: isCovered) {
      if !isCovered {
        startVisit()
      }
    }
    .onChange(of: view.notice) {
      if shownNotice == nil {
        shownNotice = view.notice
      }
    }
    .modifier(LanguageTodayLoading(goal: view.goal))
    .navigationSubtitle(dayLine)
    .task(id: view.session.localDate) {
      await refreshAtDayEnd()
    }
    .task(id: [view.isWaitingForLessons, isCovered]) {
      await pollWhileWriting()
    }
    .onDisappear {
      tapTask?.cancel()
    }
  }

  @ViewBuilder
  private var day: some View {
    TodaySessionSection(
      view: view, busy: busy, failed: failed, writingStalled: writingStalled,
      disclosures: $disclosures, open: open
    ) {
      perform(.prepare) { await store.prepareLessons(in: view) }
    }

    if !view.upNextLessons.isEmpty {
      TodayUpNextSection(view: view, isBusy: busy == .keepLearning) {
        run(.keepLearning) { await store.addExtraTime(in: view) }
      }
    }

    TodayMoreSection(
      view: view, busy: busy,
      addTime: { run(.keepLearning) { await store.addExtraTime(in: view) } },
      catchUp: {
        perform(.catchUp) { await store.catchUp(in: view) }
      })
  }

  @ViewBuilder
  private var planChange: some View {
    if let shown = store.shownPlanChange(in: view) {
      TodayPlanChangeSection(
        view: view, shown: shown, isOpen: $disclosures.planChange, isSaving: busy == .planChange,
        failed: failed == .planChange
      ) { decision in
        perform(.planChange) { await store.answer(shown.change, with: decision, in: view) }
      }
    }
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
        .listRowInsets(EdgeInsets())
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
      TodayExamChoiceSection(goalID: view.goal.id, choice: view.examChoice, editor: $examChoice)
    case .suggestedGoal:
      if let suggestion = view.suggestedGoal {
        SuggestedGoalSection(suggestion: suggestion)
      }
    case .uploadRequest, nil:
      EmptyView()
    }
  }

  @ViewBuilder
  private var aside: some View {
    if !view.session.missions.isEmpty {
      TodayMissionsSection(view: view, open: open)
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

    return Text(parts.joined(separator: " · "))
  }

  private func open(_ block: StudyBlock, next: Bool) {
    let tap: Tap = next ? .main : .block(block.position)

    run(tap) {
      await store.open(block, next: next, in: view)
    }
  }

  /// A tap whose screen went (another day, another tab) or whose learner left is cancelled and opens
  /// nothing.
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

  /// As main's `usePoll`: ten minutes at most, then Today says it's taking longer. Not while a task
  /// covers Today.
  private func pollWhileWriting() async {
    writingStalled = false

    guard view.isWaitingForLessons, !isCovered else {
      return
    }

    let deadline = ContinuousClock.now + .seconds(600)

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
  }
}

extension AppRouter {
  /// A block Today doesn't list as one to do now shows Today as it stands; one that couldn't open
  /// leaves the learner where they tapped.
  static func openingTodayBlocks(today: TodayStore) -> BlockOpener {
    { blockID, router in
      Task {
        switch await today.open(blockID: blockID) {
        case .done(let destination)?:
          router.openStudy(destination)
        case nil:
          router.showRoot(of: .today)
        case .failed?, .obsolete?:
          break
        }
      }
    }
  }

  /// Anything but a question block opens its own screen over the session, so closing it goes on with
  /// the day.
  func openStudy(_ destination: StudyDestination) {
    if case .questionBlock(_, let blockID) = destination {
      playback.play(blockID: blockID)
    }

    guard let step = destination.step else {
      if !tasks.contains(.session) {
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
    case .questionBlock, .session, .lessonWait:
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
