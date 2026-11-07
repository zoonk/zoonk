import SwiftUI

/// What the learner opened or closed in the day's session. Kept by the screen above its panes, so
/// folding or unfolding keeps it.
struct TodayDisclosures {
  var earlierWork: Bool?
  var planChange = false
  var showsDone = false
  var showsMore = false
}

struct TodaySessionSection: View {
  @Environment(AppRouter.self) private var router

  let view: TodayView
  let busy: TodayDayView.Tap?
  let failed: TodayDayView.Tap?
  let writingStalled: Bool
  @Binding var disclosures: TodayDisclosures
  let open: (StudyBlock, Bool) -> Void
  /// Main's tablet column heads the day with its action instead (`TodaySessionAction`).
  var showsAction = true
  let prepare: () -> Void

  /// Done blocks shown before folding them into one row, and upcoming ones before "+N more".
  private let doneRows = 2
  private let upcomingRows = 6

  private var session: StudyDay { view.session }

  var body: some View {
    if !view.earlierWork.isEmpty {
      TodayEarlierWorkSection(
        items: view.earlierWork,
        isExpanded: Binding {
          disclosures.earlierWork ?? (view.earlierWork.count <= 5)
        } set: {
          disclosures.earlierWork = $0
        })
    }

    Section {
      let lead = TodayDayLead(view: view)

      if !view.dayLeadJoinsHeader, !lead.isEmpty {
        lead
          .listRowSeparator(.hidden)
      }

      queue

      ForEach(Array(session.plusLessons.enumerated()), id: \.offset) { _, lesson in
        PlusLessonRow(title: lesson.title)
      }

      if let status = TodayDayStatus(view: view, writingStalled: writingStalled) {
        status
      }
    }

    if showsAction, TodaySessionAction.offers(view) {
      Section {
        TodaySessionAction(
          view: view, busy: busy, failed: failed, open: open, prepare: prepare)
      }
      .listRowBackground(Color.clear)
      .listRowInsets(.vertical, 0)
      .listSectionSpacing(.compact)
    }
  }

  @ViewBuilder
  private var queue: some View {
    let next = session.dailyLimit?.reached == true ? nil : session.nextBlock
    let done = session.blocks.filter(\.isFinished)
    let (before, upcoming) = session.queue(next: next)
    let foldsDone = next != nil && done.count > doneRows
    let markedUpTo = upcoming.lastIndex { countsTowardMission($0) }.map { $0 + 1 } ?? 0
    let coming = next == nil ? nil : session.comingLessons
    let upcomingCount = upcoming.count + (coming == nil ? 0 : 1)
    let foldedFrom = max(upcomingRows, markedUpTo)
    let shownUpcoming = disclosures.showsMore ? upcomingCount : foldedFrom

    if foldsDone {
      FoldRow(isOpen: $disclosures.showsDone, isDone: true, count: done.count, minutes: nil)
    }

    if !foldsDone || disclosures.showsDone {
      ForEach(done, id: \.position) { block in
        doneRow(block)
      }
    }

    ForEach(before, id: \.position) { block in
      blockButton(block, isNext: false)
    }

    if let next {
      if next.canTestOut, let chapterID = next.chapterId {
        VStack(alignment: .blockTitle, spacing: 0) {
          blockButton(next, isNext: true)

          Button {
            router.open(.testOut(chapterId: chapterID))
          } label: {
            Text(testOutLine)
              .typeStyle(.meta)
              .foregroundStyle(.mutedForeground)
              .padding(.top, 6)
          }
          // A list row fires every default-style button in it; this one opens only the test.
          .buttonStyle(.borderless)
        }
        .currentRow()
      } else {
        blockButton(next, isNext: true)
          .currentRow()
      }
    }

    ForEach(Array(upcoming.prefix(shownUpcoming)), id: \.position) { block in
      if next == nil {
        BlockRow(block: block, view: view, isNext: false, countsTowardMission: false)
      } else {
        blockButton(block, isNext: false)
      }
    }

    if let coming, upcoming.count < shownUpcoming {
      ComingLessonsRow(
        coming: coming, writingStalled: writingStalled, isBusy: busy == .prepare,
        failed: failed == .prepare, prepare: prepare
      )
      .disabled(busy != nil)
    }

    if upcomingCount > shownUpcoming || (disclosures.showsMore && upcomingCount > upcomingRows) {
      FoldRow(
        isOpen: $disclosures.showsMore, isDone: false, count: upcomingCount - foldedFrom,
        minutes: upcoming.dropFirst(foldedFrom).reduce(0) { $0 + $1.estimatedMinutes })
    }
  }

  /// A block still to do opens from its row, in whatever order the learner likes; one waiting for
  /// earlier work doesn't.
  @ViewBuilder
  private func blockButton(_ block: StudyBlock, isNext: Bool) -> some View {
    let row = BlockRow(
      block: block, view: view, isNext: isNext, countsTowardMission: countsTowardMission(block),
      isBusy: busy == .block(block.position), failed: failed == .block(block.position))

    if block.waitReason == nil {
      Button {
        open(block, false)
      } label: {
        row
      }
      .tint(.primary)
      .disabled(busy != nil)
    } else {
      row
    }
  }

  /// Main's link in the sentence: ink and underlined in its muted words.
  private var testOutLine: AttributedString {
    let line = AttributedString(
      localized: "Already know this? **Take the test**", table: "Today",
      comment: "Skips the next lesson's chapter with its test")

    return line.runs[\.inlinePresentationIntent].reduce(into: AttributedString()) {
      result, run in
      var piece = AttributedString(line[run.1])

      if run.0?.contains(.stronglyEmphasized) == true {
        piece.inlinePresentationIntent = nil
        piece.foregroundColor = Color(.foreground)
        piece.underlineStyle = .single
      }

      result += piece
    }
  }

  @ViewBuilder
  private func doneRow(_ block: StudyBlock) -> some View {
    let row = BlockRow(block: block, view: view, isNext: false, countsTowardMission: false)

    if let lessonId = block.lessonToReopen {
      Button {
        router.open(.lesson(lessonId: lessonId))
      } label: {
        row
      }
      .tint(.primary)
      .disabled(busy != nil)
    } else {
      row
    }
  }

  private func countsTowardMission(_ block: StudyBlock) -> Bool {
    !session.fullMeal.earned
      && session.missions.contains { !$0.isDone && $0.waitReason == nil && $0.opens(block) }
  }

}

/// The day's one main action: start or continue the session, get its lessons, its summary, or the
/// Plan once the goal's date passed.
struct TodaySessionAction: View {
  @Environment(AppRouter.self) private var router

  let view: TodayView
  let busy: TodayDayView.Tap?
  let failed: TodayDayView.Tap?
  let open: (StudyBlock, Bool) -> Void
  let prepare: () -> Void
  /// Beside the page's title rather than across the column.
  var isInHeader = false

  private var session: StudyDay { view.session }

  /// Whether the day has one, so a place that holds it can leave itself out.
  static func offers(_ view: TodayView) -> Bool {
    if view.isPastDate {
      return true
    }

    if !view.upNextLessons.isEmpty {
      return false
    }

    switch view.session.state {
    case .underway: return view.session.nextBlock != nil
    case .done, .prepare: return true
    case .ahead, .limit, .rest, .waiting: return false
    }
  }

  var body: some View {
    action?.inHeader(isInHeader)
  }

  private var action: TodayMainAction? {
    let state = session.state

    if view.isPastDate {
      return TodayMainAction(kind: .seePlan, isBusy: false, failed: false) {
        router.select(.plan)
      }
    }

    if !view.upNextLessons.isEmpty {
      return nil
    }

    switch state {
    case .underway:
      guard let next = session.nextBlock else {
        return nil
      }

      return TodayMainAction(
        kind: session.isStarted ? .continueSession : .startSession, isBusy: busy == .main,
        failed: failed == .main
      ) {
        open(next, true)
      }
    case .done:
      return TodayMainAction(kind: .summary, isBusy: false, failed: false) {
        router.open(.session)
      }
    case .prepare:
      return TodayMainAction(
        kind: .prepareLessons, isBusy: busy == .prepare, failed: failed == .prepare,
        action: prepare)
    case .ahead, .limit, .rest, .waiting:
      return nil
    }
  }
}

struct TodayMainAction: View {
  enum Kind {
    case continueSession
    case keepLearning
    case practice(minutes: Int)
    case prepareLessons
    case seePlan
    case startSession
    case summary
  }

  let kind: Kind
  let isBusy: Bool
  let failed: Bool
  /// Beside the page's title, its own width, rather than across the column.
  private var isInHeader = false
  let action: () -> Void

  init(kind: Kind, isBusy: Bool, failed: Bool, action: @escaping () -> Void) {
    self.kind = kind
    self.isBusy = isBusy
    self.failed = failed
    self.action = action
  }

  func inHeader(_ isInHeader: Bool) -> Self {
    var shown = self
    shown.isInHeader = isInHeader
    return shown
  }

  var body: some View {
    VStack(alignment: isInHeader ? .trailing : .center, spacing: 8) {
      BusyButton(isBusy: isBusy, action: action) {
        title
          .frame(maxWidth: isInHeader ? nil : .infinity)
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)

      if failed {
        FailureLine(message: failure)
          .typeStyle(.note)
      }
    }
  }

  private var failure: LocalizedStringResource {
    switch kind {
    case .prepareLessons, .practice:
      LocalizedStringResource(
        "That didn't save. Try again.", table: "Today", comment: "A change couldn't be saved")
    case .keepLearning:
      LocalizedStringResource(
        "We couldn't open your next lessons. Try again.", table: "Today",
        comment: "Adding the plan's next lessons to the day failed")
    case .continueSession, .seePlan, .startSession, .summary:
      LocalizedStringResource(
        "We couldn't open the next step. Try again.", table: "Today",
        comment: "Opening the day's next step failed")
    }
  }

  private var title: Text {
    switch kind {
    case .continueSession:
      Text("Continue session", tableName: "Today", comment: "Continues today's session")
    case .keepLearning:
      Text("Keep learning", tableName: "Today", comment: "Adds the plan's next lessons")
    case .practice(let minutes):
      Text(
        "Practice for \(minutes) minutes", tableName: "Today",
        comment: "Adds practice on a day with nothing new")
    case .prepareLessons:
      Text(
        "Get today's lessons", tableName: "Today",
        comment: "Asks for the day's lessons, which aren't written yet")
    case .seePlan:
      Text("See your plan", tableName: "Today", comment: "Opens the Plan")
    case .startSession:
      Text("Start session", tableName: "Today", comment: "Starts today's session")
    case .summary:
      Text("See today's summary", tableName: "Today", comment: "Opens today's summary")
    }
  }
}

extension TodayView {
  /// Main's order puts earlier unfinished work between the heading and the session's meter. Without
  /// it, the day's lead sits in the heading's row: in a row of its own, the list's 44pt minimum row
  /// height would hold the 6pt meter far from the title.
  var dayLeadJoinsHeader: Bool { earlierWork.isEmpty }
}

/// What opens main's `TodaySession` before its queue: why the day is as it is, then its meter.
struct TodayDayLead: View {
  let view: TodayView

  private var session: StudyDay { view.session }

  var isEmpty: Bool { freshStart == nil && mockDay == nil && session.blocks.isEmpty }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if let freshStart {
        Text(freshStart)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      }

      mockFunding

      if !session.blocks.isEmpty {
        DayProgressRow(session: session)
      }
    }
  }

  /// It belongs to the session it explains, so it goes once the learner starts, and a day with
  /// nothing to start says its own words instead.
  private var freshStart: String? {
    let state = session.state
    guard !view.studiedToday, !session.isStarted, session.dailyLimit?.reached != true,
      state != .ahead, state != .rest
    else {
      return nil
    }

    let time = studyDuration(minutes: session.blocks.reduce(0) { $0 + $1.estimatedMinutes })

    switch session.freshStart {
    case .welcomeBack:
      return session.examAccess.trialEnded
        ? String(
          localized: "Welcome back! Today takes about \(time), so it's easy to pick up again.",
          table: "Today", comment: "A return after a break")
        : String(
          localized:
            "Welcome back! Today is lighter, about \(time), so it's easy to pick up again.",
          table: "Today", comment: "A return after a break")
    case .newPhase:
      return String(
        localized: "A new phase starts today, with an easy warm-up first.", table: "Today",
        comment: "A day starting a new phase")
    case .newWeek:
      return String(
        localized: "A fresh week. Today starts with an easy warm-up.", table: "Today",
        comment: "A day starting a new week")
    case nil:
      return nil
    }
  }

  private var mockDay: String? {
    guard let funding = view.mockFunding, session.state != .done, session.state != .rest,
      let date = studyDate(funding.mockDate)
    else {
      return nil
    }

    return date.formatted(.studyDay.month(.abbreviated).day())
  }

  /// A return after a break already says the day is lighter, so it only names the mock.
  @ViewBuilder
  private var mockFunding: some View {
    if let day = mockDay {
      HStack {
        if session.freshStart == .welcomeBack {
          Text(
            "Saving time for \(day)'s mock exam", tableName: "Today",
            comment:
              "Why the day is lighter, on a return after a break that already says so; the argument is the mock's date, like 'May 5'"
          )
        } else {
          Text(
            "Lighter day: saving time for \(day)'s mock exam", tableName: "Today",
            comment: "Why the day is lighter; the argument is the mock's date, like 'May 5'")
        }

        if !session.examAccess.includesMockExams {
          PlusMark()
        }
      }
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
    }
  }
}

private struct DayProgressRow: View {
  let session: StudyDay

  var body: some View {
    MeterParts(parts: session.meterParts)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(
        Text(
          "\(session.blocks.filter(\.isFinished).count) of \(session.blocks.count) done",
          tableName: "Today", comment: "How far the day's session is"))
  }
}

extension HorizontalAlignment {
  private enum BlockTitle: AlignmentID {
    static func defaultValue(in context: ViewDimensions) -> CGFloat { context[.leading] }
  }

  /// Where a `BlockRow`'s words start after its mark, for a line under them.
  fileprivate static let blockTitle = HorizontalAlignment(BlockTitle.self)
}

struct BlockRow: View {
  @Environment(TodayStore.self) private var today

  let block: StudyBlock
  let view: TodayView?
  let isNext: Bool
  let countsTowardMission: Bool
  var isBusy = false
  var failed = false
  var showsDetail = false

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      mark

      AccessibilityStack(alignment: .firstTextBaseline, spacing: 12, stackedSpacing: 2) {
        VStack(alignment: .leading, spacing: 2) {
          Text(block.displayTitle)
            .typeStyle(.rowTitle)
            .foregroundStyle(block.isFinished ? .mutedForeground : .primary)

          if failed {
            FailureLine(
              message: LocalizedStringResource(
                "We couldn't open this step. Try again.", table: "Today",
                comment: "Under a step of the day, or a mission, that didn't open")
            )
            .typeStyle(.note)
          }

          if !block.isFinished {
            ForEach(lines, id: \.self) { line in
              Text(line)
                .typeStyle(.meta)
                .foregroundStyle(.mutedForeground)
            }
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        trailing
      }
      .alignmentGuide(.blockTitle) { $0[.leading] }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(status)
  }

  @ViewBuilder
  private var trailing: some View {
    if !block.isFinished {
      HStack(spacing: 6) {
        if countsTowardMission {
          Image(systemName: "target")
            .foregroundStyle(.brain)
            .accessibilityLabel(
              Text(
                "Counts toward a mission", tableName: "Today",
                comment: "A block that moves today's missions"))
        }

        Text(studyDuration(minutes: block.estimatedMinutes))
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
      }
      .coveredBySpinnerWhenSlow(isBusy, alignment: .trailing)
    }
  }

  @ViewBuilder
  private var mark: some View {
    switch block.status {
    case .completed:
      StatusMark(status: .done)
    case .skipped:
      StatusMark(status: .skipped)
    case .active, .pending:
      KindMark(kind: block.learnKind)
        .frame(minWidth: 20)
    }
  }

  private var lines: [String] {
    var lines: [String] = []

    if let view, today.isBeingWritten(block, in: view) {
      lines.append(
        String(
          localized: "Being written for you…", table: "Today",
          comment:
            "Under a lesson, or under the day's next lessons, while they're written right now. It can be one lesson or several."
        ))
    } else if let label = block.label(isCatchingUp: isCatchingUp) {
      lines.append(label)
    }

    if block.weakest || block.fullReview || showsDetail && block.checkpoint == nil,
      let detail = block.detail
    {
      lines.append(detail)
    }

    return lines
  }

  private var isCatchingUp: Bool {
    view?.session.catchUp?.positions.contains(block.position) == true
  }

  private var status: Text {
    switch block.status {
    case .completed:
      Text("Done", tableName: "Today", comment: "A finished block")
    case .skipped:
      Text("Skipped", tableName: "Today", comment: "A skipped block")
    case .active, .pending:
      isNext ? Text("Next", tableName: "Today", comment: "The day's next block") : Text("")
    }
  }
}

/// Holds the place of the day's lessons that aren't written yet: Today reads again until they land
/// while they're outlined, and asks the learner for them while nobody is.
private struct ComingLessonsRow: View {
  let coming: ComingLessons
  let writingStalled: Bool
  let isBusy: Bool
  let failed: Bool
  let prepare: () -> Void

  @Environment(\.legibilityWeight) private var legibilityWeight

  var body: some View {
    switch coming {
    case .toPrepare:
      Button(action: prepare) {
        row
          .spinnerAtEndWhenSlow(isBusy)
      }
      .tint(.primary)
    case .beingWritten:
      row
        .accessibilityElement(children: .combine)
    }
  }

  private var row: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      KindMark(kind: .lesson)
        .frame(minWidth: 20)

      VStack(alignment: .leading, spacing: 2) {
        Text(
          "Your next lessons", tableName: "Today",
          comment: "Holds the place of the day's lessons that aren't written yet"
        )
        .typeStyle(.rowTitle)

        Group {
          switch coming {
          case .toPrepare:
            Text(
              AttributedString(
                localized: "Not written yet. **Get today's lessons**", table: "Today",
                comment: "Asks for the day's next lessons, which nobody is writing"),
              legibility: legibilityWeight)
          case .beingWritten where writingStalled:
            Text(
              "Taking longer than usual", tableName: "Today",
              comment: "The day's next lessons are taking long to outline")
          case .beingWritten:
            Text(
              "Being written for you…", tableName: "Today",
              comment:
                "Under a lesson, or under the day's next lessons, while they're written right now. It can be one lesson or several."
            )
          }
        }
        .typeStyle(.meta)
        .foregroundStyle(.mutedForeground)

        if failed {
          FailureLine(
            message: LocalizedStringResource(
              "That didn't save. Try again.", table: "Today", comment: "A change couldn't be saved")
          )
          .typeStyle(.meta)
        }
      }
    }
  }
}

private struct PlusLessonRow: View {
  @Environment(AppRouter.self) private var router

  let title: String

  var body: some View {
    Button {
      router.present(.subscription)
    } label: {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        KindMark(kind: .lesson)
          .frame(minWidth: 20)
        Text(title)
          .typeStyle(.rowTitle)
        Spacer(minLength: 8)
        Text("Plus", tableName: "Today", comment: "Marks a lesson that comes with Plus")
          .chip()
          .accessibilityLabel(
            Text("Available with Plus", tableName: "Today", comment: "A Plus lesson"))
      }
    }
    .tint(.primary)
  }
}

private struct FoldRow: View {
  @Binding var isOpen: Bool
  let isDone: Bool
  let count: Int
  let minutes: Int?

  var body: some View {
    Button {
      isOpen.toggle()
    } label: {
      HStack(spacing: 12) {
        Image(systemName: isDone ? "checkmark" : "ellipsis")
          .foregroundStyle(isDone ? AnyShapeStyle(.success) : AnyShapeStyle(.mutedForeground))
          .frame(minWidth: 20)
          .accessibilityHidden(true)

        Group {
          if isDone {
            Text("\(count) done", tableName: "Today", comment: "Folded done blocks")
          } else if isOpen {
            Text("Show less", tableName: "Today", comment: "Folds the day's later blocks")
          } else {
            Text("+\(count) more", tableName: "Today", comment: "Folded later blocks")
          }
        }
        .typeStyle(.rowTitle)

        Spacer()

        if let minutes, minutes > 0, !isOpen {
          Text(studyDuration(minutes: minutes))
            .typeStyle(.data)
        }

        Image(systemName: "chevron.down")
          .rotationEffect(.degrees(isOpen ? 180 : 0))
          .typeStyle(.note)
          .accessibilityHidden(true)
      }
      .foregroundStyle(.mutedForeground)
    }
    .tint(.primary)
  }
}

struct TodayDayStatus: View {
  private enum Link {
    case changeLimit
    case summary
  }

  @Environment(AppRouter.self) private var router

  let view: TodayView
  private let sentence: String
  private let clause: String?
  private let systemImage: String
  private var link: Link?

  init?(view: TodayView, writingStalled: Bool) {
    self.view = view
    let session = view.session

    if view.isPastDate {
      systemImage = "calendar.badge.clock"
      sentence = String(
        localized: "Your goal's date has passed with lessons left.", table: "Today",
        comment: "The goal's date passed")
      clause = String(
        localized: "Adjust your plan to keep going.", table: "Today",
        comment: "The goal's date passed")
      return
    }

    if let limit = session.limitStatus {
      let time = studyDuration(minutes: session.dailyLimit?.limitMinutes ?? 0)
      systemImage = "hourglass"
      link = .changeLimit

      switch limit {
      case .reached:
        sentence = String(
          localized: "You've reached your daily time limit of \(time).", table: "Today",
          comment:
            "The daily time limit is a setting that stops study for the day. The argument is a time, like '3 hr'."
        )
        clause = Self.seeYou(session.week)
      case .cuts:
        sentence = String(
          localized: "Today stops at your daily time limit of \(time).", table: "Today",
          comment:
            "The daily time limit is a setting that stops study for the day. It's shorter than the plan's time for today. The argument is a time, like '3 hr'."
        )
        clause = nil
      }

      return
    }

    let keepLearning = !view.upNextLessons.isEmpty
    let welcomeBack = session.freshStart == .welcomeBack

    switch session.state {
    case .done:
      systemImage = "checkmark.circle"
      sentence =
        session.minutes.dailyGoal == 0
        ? String(
          localized: "You studied on your day off.", table: "Today", comment: "Rest day studied")
        : String(
          localized: "Today's session is complete.", table: "Today", comment: "Day done")
      clause = Self.seeYou(session.week)
      link = keepLearning ? .summary : nil
    case .waiting where writingStalled:
      systemImage = "clock"
      sentence = String(
        localized: "Today's lessons are taking longer than usual.", table: "Today",
        comment: "The day's lessons are taking long to outline")
      clause = String(
        localized: "Come back in a few minutes.", table: "Today",
        comment: "The day's lessons are taking long to outline")
    case .waiting:
      systemImage = "hourglass"
      sentence = String(
        localized: "Getting today's lessons ready…", table: "Today",
        comment: "The day's lessons are being outlined")
      clause = String(
        localized: "They show up here on their own.", table: "Today",
        comment: "The day's lessons are being outlined")
    case .prepare:
      systemImage = "clock"
      sentence = String(
        localized: "Today's lessons aren't written yet.", table: "Today",
        comment: "The day's lessons wait for the learner to ask for them")
      clause = nil
    case .rest:
      systemImage = "moon"
      sentence = String(
        localized: "No study planned today.", table: "Today", comment: "A rest day")
      clause =
        switch (keepLearning, welcomeBack) {
        case (true, true):
          String(
            localized: "Welcome back! Your next lessons are here if you'd like to study.",
            table: "Today", comment: "A rest day after a break")
        case (true, false):
          String(
            localized: "Your next lessons are here if you'd like to study.", table: "Today",
            comment: "A rest day")
        case (false, true):
          String(
            localized: "Welcome back! Today is a rest day in your plan, so enjoy it.",
            table: "Today", comment: "A rest day after a break")
        case (false, false):
          String(localized: "Enjoy your day off!", table: "Today", comment: "A rest day")
        }
    case .ahead:
      systemImage = "sparkles"

      if session.examAccess.trialEnded {
        sentence = String(
          localized: "Nothing to review today.", table: "Today", comment: "Nothing to do")
        clause = nil
      } else {
        sentence = String(
          localized: "Nothing new for today.", table: "Today", comment: "Nothing new")
        clause = String(
          localized: "You've done every lesson in your plan, or already know it.", table: "Today",
          comment: "Nothing new")
      }
    case .limit, .underway:
      return nil
    }
  }

  var announcement: String {
    [sentence, clause].compactMap(\.self).joinedSentences()
  }

  var body: some View {
    Label {
      VStack(alignment: .leading, spacing: 2) {
        Text(sentence)

        if let clause {
          Text(clause)
            .foregroundStyle(.mutedForeground)
        }

        switch link {
        case .changeLimit:
          ChangeLimitButton()
        case .summary:
          Button {
            router.open(.session)
          } label: {
            Text("See today's summary", tableName: "Today", comment: "Opens today's summary")
              .typeWeight(.semibold)
              .underline()
              .multilineTextAlignment(.leading)
          }
          .buttonStyle(.borderless)
        case nil:
          EmptyView()
        }
      }
    } icon: {
      Image(systemName: systemImage)
        .foregroundStyle(.mutedForeground)
    }
    .typeStyle(.note)
  }

  private static func seeYou(_ week: StudyWeek) -> String {
    guard let next = week.nextStudyDate.flatMap(studyDate),
      let today = (week.days.first(where: \.isToday)?.date).flatMap(studyDate)
    else {
      return String(
        localized: "See you in your next session!", table: "Today", comment: "Next session")
    }

    if next.timeIntervalSince(today) <= 86_400 {
      return String(localized: "See you tomorrow!", table: "Today", comment: "Next session")
    }

    let day = next.formatted(.studyDay.weekday(.wide))
    return String(localized: "See you \(day)!", table: "Today", comment: "Next study day")
  }
}

/// Today shows the saved plan, and starting the session fits it to today's time, so the day that
/// opens can differ from the one shown.
private struct TodayEarlierWorkSection: View {
  let items: [TodayView.EarlierWork]
  @Binding var isExpanded: Bool

  var body: some View {
    Section {
      DisclosureGroup(isExpanded: $isExpanded) {
        Text(
          "Start with these. Starting your session fits the plan to today's time.",
          tableName: "Today", comment: "Why the day that opens can differ from the one shown"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)

        ForEach(Array(items.enumerated()), id: \.offset) { _, item in
          Text(item.title)
        }
      } label: {
        Text(
          "Earlier unfinished work\u{00A0}· \(items.count.formatted())", tableName: "Today",
          comment: "Lessons left from earlier days, with how many"
        )
        .typeStyle(.body.weight(.medium))
      }
    }
  }
}
