import SwiftUI

/// What the learner opened or closed in the day's session. Kept by the screen above its panes, so
/// folding or unfolding keeps it.
struct TodayDisclosures {
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
  let prepare: () -> Void

  static let moreFold = "TodaySessionSection.moreFold"

  /// Done blocks shown before folding them into one row.
  private let doneRows = 1

  private var session: StudyDay { view.session }

  var body: some View {
    Section {
      queue

      if let status = TodayDayStatus(view: view, writingStalled: writingStalled) {
        status
      }
    }
  }

  @ViewBuilder
  private var queue: some View {
    let next = session.nextBlock
    let done = session.blocks.filter(\.isFinished)
    let (before, upcoming) = session.queue(next: next)
    let foldsDone = done.count > doneRows
    let coming = next == nil ? nil : session.comingLessons
    let timedRows = upcoming.count + (coming == nil ? 0 : 1)
    let upcomingCount = timedRows
    let shownUpcoming = disclosures.showsMore ? upcomingCount : StudyDay.upcomingRows

    if foldsDone {
      FoldRow(
        isOpen: $disclosures.showsDone, isDone: true, count: done.count,
        skipped: done.filter { $0.status == .skipped }.count, minutes: nil)
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
            .contentShape(.rect)

          TestOutLine {
            router.open(.testOut(chapterId: chapterID))
          }
          .padding(.top, 6)
        }
        // A list row with a default-style button sends a tap anywhere in it to one of its buttons,
        // which opened the test from the lesson's title; borderless, each answers only its own area.
        .buttonStyle(.borderless)
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
      .disabled(busy != nil && busy != .prepare)
    }

    if upcomingCount > StudyDay.upcomingRows {
      FoldRow(
        isOpen: $disclosures.showsMore, isDone: false, count: upcomingCount - StudyDay.upcomingRows,
        minutes: timedRows > StudyDay.upcomingRows
          ? session.foldedMinutes(
            showing: before + [next].compactMap { $0 } + upcoming.prefix(StudyDay.upcomingRows))
          : nil
      )
      .id(Self.moreFold)
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
      .disabled(busy != nil && busy != .block(block.position))
      .accessibilityBusy(busy == .block(block.position))
    } else {
      row
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
  /// Adds the plan's next lessons once the day is done or resting.
  let keepLearning: () -> Void
  /// After an exam's date: studies the lessons left after the exam.
  let keepStudying: () -> Void
  /// After an exam's date, once confirmed.
  let archive: () -> Void
  /// Beside the page's title rather than across the column.
  var isInHeader = false

  private var session: StudyDay { view.session }

  /// Whether the day has one, so a place that holds it can leave itself out.
  static func offers(_ view: TodayView) -> Bool {
    if view.isPastDate {
      return true
    }

    if !view.upNextLessons.isEmpty {
      return true
    }

    switch view.session.state {
    case .underway: return view.session.nextBlock != nil
    case .done, .prepare: return true
    case .ahead, .rest, .waiting: return false
    }
  }

  @State private var isArchiving = false

  private var asksAfterExam: Bool { view.isPastDate && view.goal.kind == .exam }

  var body: some View {
    let action = action

    action?.inHeader(isInHeader)
      .disabled(busy != nil && action?.isBusy != true)

    if asksAfterExam {
      BusyButton(isBusy: busy == .archive, icon: .archive) {
        isArchiving = true
      } label: {
        Text("Archive goal", tableName: "Today", comment: "Archives the goal whose exam is over")
      }
      .buttonStyle(.outline)
      .controlSize(.large)
      .buttonSizing(isInHeader ? .fitted : .flexible)
      .disabled(busy != nil && busy != .archive)
      .archiveGoalConfirmation(named: view.goal.title, isPresented: $isArchiving, archive: archive)
    }
  }

  /// What failed, for the bottom bar's line: in the bar the button can't say it under itself.
  var failure: LocalizedStringResource? {
    if failed == .archive {
      return TodayMainAction.saveFailure
    }

    return action.flatMap { $0.failed ? $0.failure : nil }
  }

  private var action: TodayMainAction? {
    let state = session.state

    if asksAfterExam {
      return TodayMainAction(
        kind: .keepStudying, isBusy: busy == .keepStudying, failed: failed == .keepStudying,
        action: keepStudying)
    }

    if view.isPastDate {
      return TodayMainAction(kind: .seePlan, isBusy: false, failed: false) {
        router.select(.plan)
      }
    }

    if !view.upNextLessons.isEmpty {
      return TodayMainAction(
        kind: .keepLearning, isBusy: busy == .keepLearning,
        failed: failed == .keepLearning || failed == .upNextLesson, action: keepLearning)
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
    case .ahead, .rest, .waiting:
      return nil
    }
  }
}

struct TodayMainAction: View {
  enum Kind {
    case continueSession
    case keepLearning
    case keepStudying
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
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
      .buttonSizing(isInHeader ? .fitted : .flexible)

      if failed, isInHeader {
        FailureLine(message: failure)
          .typeStyle(.note)
      }
    }
  }

  static let saveFailure = LocalizedStringResource(
    "That didn't save. Try again.", table: "Today", comment: "A change couldn't be saved")

  var failure: LocalizedStringResource {
    switch kind {
    case .prepareLessons, .practice, .keepStudying:
      Self.saveFailure
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
      Text("Continue", tableName: "Today", comment: "Continues today's session")
    case .keepLearning:
      Text("Keep learning", tableName: "Today", comment: "Adds the plan's next lessons")
    case .keepStudying:
      Text(
        "Keep studying", tableName: "Today",
        comment: "After an exam's date: keeps studying the lessons left")
    case .practice(let minutes):
      Text(
        "Practice \(minutes) min", tableName: "Today",
        comment: "Adds practice on a day with nothing new; the number is minutes")
    case .prepareLessons:
      Text(
        "Get today's lessons", tableName: "Today",
        comment: "Asks for the day's lessons, which aren't written yet")
    case .seePlan:
      Text("See your plan", tableName: "Today", comment: "Opens the Plan")
    case .startSession:
      Text("Start", tableName: "Today", comment: "Starts today's session")
    case .summary:
      Text("See today's summary", tableName: "Today", comment: "Opens today's summary")
    }
  }
}

/// What opens main's `TodaySession` before its queue: why the day is as it is, then its meter.
struct TodayDayLead: View {
  let view: TodayView
  let writingStalled: Bool

  private var session: StudyDay { view.session }

  var isEmpty: Bool { !session.showsDayProgress }

  var body: some View {
    if session.showsDayProgress {
      DayProgressRow(session: session, writingStalled: writingStalled)
    }
  }
}

extension TodayView {
  /// The day is shorter to keep time for a mock exam on this day, like "May 5".
  var mockDay: String? {
    guard let funding = mockFunding, session.state != .done, session.state != .rest,
      let date = studyDate(funding.mockDate)
    else {
      return nil
    }

    return date.formatted(.studyDay.month(.abbreviated).day())
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
  /// Said in place of the row's own line, such as a review's first explanations.
  var lineOverride: String?
  /// Main's reveal tags its next block where to start, on the moment's third beat.
  var tag: Text?

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      mark

      AccessibilityStack(alignment: .firstTextBaseline, spacing: 12, stackedSpacing: 2) {
        VStack(alignment: .leading, spacing: 2) {
          Text(block.displayTitle)
            .typeStyle(.rowTitle)
            .foregroundStyle(block.isFinished ? .mutedForeground : .primary)

          if let tag {
            tag
              .typeStyle(.meta.weight(.medium))
              .foregroundStyle(.successText)
              .settles(delay: 2 * .beat)
          }

          if failed {
            FailureLine(
              message: LocalizedStringResource(
                "We couldn't open this step. Try again.", table: "Today",
                comment: "Under a step of the day, or a mission, that didn't open")
            )
            .typeStyle(.note)
          }

          if !block.isFinished, let line {
            Text(line)
              .typeStyle(.meta)
              .foregroundStyle(.mutedForeground)
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
      .coveredBySpinner(isBusy, alignment: .trailing)
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

  /// A row is its title and at most one short line.
  private var line: String? {
    if let view, today.isBeingWritten(block, in: view) {
      return String(
        localized: "Getting ready…", table: "Today",
        comment:
          "Under a lesson, or under the day's next lessons, while they're being made ready. It can be one lesson or several."
      )
    }

    return lineOverride ?? (showsDetail ? block.detail : block.label)
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
          .spinnerAtEnd(isBusy)
      }
      .tint(.primary)
      .accessibilityBusy(isBusy)
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
                localized: "**Get them now**", table: "Today",
                comment:
                  "Under Your next lessons: asks for the day's next lessons, which nobody has asked for yet"
              ),
              legibility: legibilityWeight)
          case .beingWritten where writingStalled:
            Text(
              "Taking longer than usual", tableName: "Today",
              comment: "The day's next lessons are taking long to outline")
          case .beingWritten:
            Text(
              "Getting ready…", tableName: "Today",
              comment:
                "Under a lesson, or under the day's next lessons, while they're being made ready. It can be one lesson or several."
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

private struct FoldRow: View {
  @Binding var isOpen: Bool
  let isDone: Bool
  let count: Int
  var skipped = 0
  let minutes: Double?

  private var onlySkipped: Bool { skipped > 0 && skipped == count }

  var body: some View {
    Button {
      isOpen.toggle()
    } label: {
      HStack(spacing: 12) {
        Image(systemName: onlySkipped ? "forward.fill" : isDone ? "checkmark" : "ellipsis")
          .imageScale(onlySkipped ? .small : .medium)
          .foregroundStyle(
            isDone && !onlySkipped ? AnyShapeStyle(.success) : AnyShapeStyle(.mutedForeground)
          )
          .frame(minWidth: 20)
          .accessibilityHidden(true)

        Group {
          if isDone, skipped > 0 {
            Text(doneAndSkipped)
          } else if isDone {
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

  /// Skipped blocks fold with the done ones, but never count as done.
  private var doneAndSkipped: String {
    let skippedFact = String(
      localized: "\(skipped) skipped", table: "Today", comment: "Folded skipped blocks")

    guard !onlySkipped else { return skippedFact }

    return [
      String(localized: "\(count - skipped) done", table: "Today", comment: "Folded done blocks"),
      skippedFact,
    ].joinedFacts()
  }
}

struct TodayDayStatus: View {
  private enum Link {
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
      let lessons = view.progress?.status?.lessons ?? 0
      systemImage = "calendar.badge.clock"

      if view.goal.kind == .exam {
        sentence = String(
          localized: "Your exam date has passed with \(lessons) lessons left.", table: "Today",
          comment: "An exam's date passed with lessons left; the number is the lessons")
        clause = String(
          localized: "Keep studying them, or archive this goal?", table: "Today",
          comment:
            "After an exam's date: asks whether to study the lessons left or archive the goal")
      } else {
        sentence = String(
          localized: "Your end date has passed with \(lessons) lessons left.", table: "Today",
          comment: "A goal's end date passed with lessons left; the number is the lessons")
        clause = nil
      }

      return
    }

    let keepLearning = !view.upNextLessons.isEmpty

    switch session.state {
    case .done:
      systemImage = "checkmark.circle"
      sentence =
        session.minutes.dailyGoal == 0
        ? String(
          localized: "You studied on your day off.", table: "Today", comment: "Rest day studied")
        : String(
          localized: "You're done for today.", table: "Today", comment: "Day done")
      clause = nil
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
      clause = nil
    case .prepare:
      systemImage = "clock"
      sentence = String(
        localized: "Today's lessons aren't ready yet.", table: "Today",
        comment: "The day's lessons wait for the learner to ask for them")
      clause = nil
    case .rest:
      systemImage = "moon"
      sentence = String(
        localized: "No study planned today.", table: "Today", comment: "A rest day")
      clause =
        keepLearning
        ? String(
          localized: "Your next lessons are below if you want to study.", table: "Today",
          comment: "A rest day, over the plan's next lessons")
        : String(localized: "Enjoy your day off!", table: "Today", comment: "A rest day")
    case .ahead:
      systemImage = "sparkles"
      clause = nil

      if view.progress?.status?.kind == "finished" {
        sentence = String(
          localized: "You finished your plan.", table: "Today", comment: "The plan is finished")
      } else {
        sentence = String(
          localized: "You're all caught up.", table: "Today", comment: "Nothing new today")
      }
    case .underway:
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

}
