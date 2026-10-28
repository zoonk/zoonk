import SwiftUI

/// The learner's day on Today: under the title, the day's line (the date, the days left, where the
/// plan stands); the session as a queue with the next block highlighted and one main action; what
/// else the day offers; then the missions, the week and practice to do any time.
struct TodayDayView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.isCoveredByTask) private var isCovered
  @Environment(AppRouter.self) private var router
  @Environment(StudySessionStore.self) private var sessions
  @Environment(TodayStore.self) private var store

  let view: TodayView

  /// The tap in flight, so its control shows it's working and no second tap starts another.
  @State private var busy: Tap?
  @State private var failed: Tap?
  @State private var tapTask: Task<Void, Never>?

  enum Tap: Equatable {
    case block(Int)
    case catchUp
    case keepLearning
    case main
  }

  var body: some View {
    // Where there's room, main's aside (72rem on the web) sits beside the day: the missions, the
    // week, the notices and practice. On the open iPhone Duo the two meet at the fold.
    PaneSplit(primaryShare: 0.55) {
      List {
        day
      }
    } secondary: {
      List {
        aside
        notices
        TodayPracticeSection(view: view)
      }
    } single: {
      List {
        day
        notices
        aside
        TodayPracticeSection(view: view)
      }
    }
    .listStyle(.insetGrouped)
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

  /// The day itself: its session and action, the plan's next lessons, and what else it offers.
  @ViewBuilder
  private var day: some View {
    TodaySessionSection(view: view, busy: busy, failed: failed, open: open)

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

  /// The one insight and a plan change waiting for the learner's say.
  @ViewBuilder
  private var notices: some View {
    if let insight = view.insight {
      Section {
        MemoryInsightCard(insight: insight)
      }
      .listRowBackground(Color.clear)
      .listRowInsets(EdgeInsets())
    }

    if view.planChange?.status == "proposed" {
      TodayPlanChangeSection(change: view.planChange)
    }
  }

  /// The day's missions and the week.
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

  /// The quiet line under Today's title: the date, the days left, the exam's own day and where the
  /// plan stands.
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

  /// Opens a step of the day where it plays; a step that couldn't open reads the day again.
  private func open(_ block: StudyBlock, next: Bool) {
    let tap: Tap = next ? .main : .block(block.position)

    run(tap) {
      await store.open(block, next: next, in: view)
    }
  }

  /// Runs a tap's write for the learner who made it; a tap whose screen went (another day, another
  /// tab) or whose learner left is cancelled and opens nothing.
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

  /// Reads Today again when the learner's day ends, so midnight draws the new day.
  private func refreshAtDayEnd() async {
    let end = Date(timeIntervalSince1970: Double(view.session.dayEndsAt) / 1_000)

    do {
      try await Task.sleep(for: .seconds(max(1, end.timeIntervalSinceNow)))
    } catch {
      return
    }

    await store.today.refresh()
  }

  /// Reads Today again while a lesson of the day is written, for a few minutes at most, and not
  /// while a task covers Today.
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
  /// Opens one of today's blocks by its id, from a mission or a link to it, as its row on Today
  /// does. A block Today doesn't list as one to do now shows Today as it stands; one that couldn't
  /// open leaves the learner where they tapped, as main's `openBlock`.
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

  /// Shows a step the learner's tap opened on the session screen: a question block plays there,
  /// and anything else opens its own screen over it, so closing that screen goes on with the day.
  /// A step opened from Today comes in as one transition, with the session under it out of sight
  /// until the step closes.
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
  /// The screen of its own a step opens over the session; nil for what the session shows itself.
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
