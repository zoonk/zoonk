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

  /// Whether Today has room for main's aside (72rem on the web): the missions, the week, the
  /// notices and practice in a column beside the day. Measured on Today's own width, so a sidebar,
  /// split view, a compact window or the iPhone Duo keeps one column.
  @State private var isWide = false

  /// The width from which the day and the aside both keep a comfortable column.
  private static let wideWidth = 900.0

  var body: some View {
    Group {
      if isWide {
        HStack(alignment: .top, spacing: 0) {
          List {
            day
          }

          List {
            aside
            notices
            TodayPracticeSection(view: view)
          }
          .containerRelativeFrame(.horizontal) { width, _ in width * 0.4 }
        }
      } else {
        List {
          day
          notices
          aside
          TodayPracticeSection(view: view)
        }
      }
    }
    .listStyle(.insetGrouped)
    .onGeometryChange(for: Bool.self) {
      $0.size.width >= Self.wideWidth
    } action: {
      isWide = $0
    }
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
      // Beside the day, each mission keeps its row; under it, the queue marks the blocks.
      TodayMissionsSection(view: view, rowsInQueue: !isWide, open: open)
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
  /// Shows a step the learner's tap opened on the session screen: a question block plays there,
  /// and anything else opens its own screen over it, so closing that screen goes on with the day.
  func openStudy(_ destination: StudyDestination, sessions: StudySessionStore) {
    if case .questionBlock(_, let blockID) = destination {
      sessions.play(blockID: blockID)
    }

    if !tasks.contains(.session) {
      open(.session)
    }

    switch destination {
    case .challenge(let planItemID, let sessionID):
      open(.challenge(planItemId: planItemID, sessionId: sessionID))
    case .checkpoint(let blockID, let sessionID):
      open(.checkpoint(blockId: blockID, sessionId: sessionID))
    case .essay(let blockID):
      open(.essay(blockId: blockID))
    case .lesson(let lessonID, let sessionID):
      open(.lesson(lessonId: lessonID, sessionId: sessionID))
    case .mock(let blockID, let sessionID):
      open(.mock(blockId: blockID, sessionId: sessionID))
    case .questionBlock, .session, .lessonWait:
      break
    }
  }
}
