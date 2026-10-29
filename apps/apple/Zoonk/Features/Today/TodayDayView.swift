import SwiftUI

struct TodayDayView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.isCoveredByTask) private var isCovered
  @Environment(AppRouter.self) private var router
  @Environment(StudySessionStore.self) private var sessions
  @Environment(TodayStore.self) private var store

  let view: TodayView

  @State private var busy: Tap?
  @State private var failed: Tap?
  @State private var tapTask: Task<Void, Never>?
  @State private var disclosures = TodayDisclosures()

  enum Tap: Equatable {
    case block(Int)
    case catchUp
    case keepLearning
    case main
    case planChange
  }

  var body: some View {
    PaneSplit(primaryShare: 0.55) {
      List {
        // It asks for a decision, so it leads the day where the day has room beside it.
        planChange
        day
      }
    } secondary: {
      List {
        aside
        notices
        TodayPracticeSection(view: view, language: language)
      }
    } single: {
      List {
        day
        planChange
        notices
        aside
        TodayPracticeSection(view: view, language: language)
      }
    }
    .listStyle(.insetGrouped)
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
      view: view, busy: busy, failed: failed, disclosures: $disclosures, open: open)

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
  private var notices: some View {
    TodayLanguagePracticeSection(view: view, language: language)

    if let insight = view.insight {
      Section {
        MemoryInsightCard(insight: insight)
      }
      .listRowBackground(Color.clear)
      .listRowInsets(EdgeInsets())
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

    if let exam = view.exam, exam.stage == "dayBefore" || exam.stage == "examDay" {
      parts.append(
        exam.stage == "dayBefore"
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
        router.openStudy(destination, sessions: sessions)
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

  /// For a few minutes at most, and not while a task covers Today.
  private func pollWhileWriting() async {
    guard view.isWaitingForLessons, !isCovered else {
      return
    }

    for _ in 0..<36 {
      do {
        try await Task.sleep(for: .seconds(5))
      } catch {
        return
      }

      await store.today.refresh()
    }
  }
}

extension AppRouter {
  /// A block Today doesn't list as one to do now shows Today as it stands; one that couldn't open
  /// leaves the learner where they tapped.
  static func openingTodayBlocks(today: TodayStore, sessions: StudySessionStore) -> BlockOpener {
    { blockID, router in
      Task {
        switch await today.open(blockID: blockID) {
        case .done(let destination)?:
          router.openStudy(destination, sessions: sessions)
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
  func openStudy(_ destination: StudyDestination, sessions: StudySessionStore) {
    if case .questionBlock(_, let blockID) = destination {
      sessions.play(blockID: blockID)
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
