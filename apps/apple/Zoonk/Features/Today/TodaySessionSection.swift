import SwiftUI

/// Today's session: why the day is lighter, how far along it is, its blocks as a queue with the
/// next one highlighted, what the day is when there's nothing to start, and the day's one main
/// action under it.
struct TodaySessionSection: View {
  @Environment(AppRouter.self) private var router

  let view: TodayView
  let busy: TodayDayView.Tap?
  let failed: TodayDayView.Tap?
  let open: (StudyBlock, Bool) -> Void

  @State private var showsDone = false
  @State private var showsMore = false

  /// Done blocks shown before folding them into one row, and upcoming ones before "+N more".
  private let doneRows = 2
  private let upcomingRows = 6

  private var session: StudyDay { view.session }

  var body: some View {
    if !view.earlierWork.isEmpty {
      TodayEarlierWorkSection(items: view.earlierWork)
    }

    Section {
      if let freshStart {
        Text(freshStart)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }

      mockFunding

      if !session.blocks.isEmpty {
        DayProgressRow(session: session)
      }

      queue

      ForEach(Array(session.plusLessons.enumerated()), id: \.offset) { _, lesson in
        PlusLessonRow(title: lesson.title)
      }

      if let status = TodayDayStatus(view: view) {
        status
      }
    }

    if let action {
      Section {
        action
      }
      .listRowBackground(Color.clear)
      .listRowInsets(EdgeInsets())
      .listSectionSpacing(.compact)
    }
  }

  /// Why today is lighter, kindly and briefly; nil on an ordinary day. It belongs to the session
  /// it explains, so it goes once the learner starts, and a day with nothing to start says its own
  /// words instead.
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

  /// Why a study day is lighter than the learner's time: it saves some for a mock exam longer than
  /// their day. A return after a break already says the day is lighter, so it only names the mock;
  /// a mock the learner's plan doesn't include wears the Plus mark.
  @ViewBuilder
  private var mockFunding: some View {
    if let funding = view.mockFunding, session.state != .done, session.state != .rest,
      let date = studyDate(funding.mockDate)
    {
      let day = date.formatted(.studyDay.month(.abbreviated).day())

      HStack {
        if session.freshStart == .welcomeBack {
          Text(
            "Saving time for \(day)'s mock exam", tableName: "Today",
            comment: "Why the day is lighter, on a return after a break that already says so")
        } else {
          Text(
            "Lighter day: saving time for \(day)'s mock exam", tableName: "Today",
            comment: "Why the day is lighter")
        }

        if !session.examAccess.includesMockExams {
          PlusMark()
        }
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }
  }

  @ViewBuilder
  private var queue: some View {
    let next = session.dailyLimit?.reached == true ? nil : session.nextBlock
    let done = session.blocks.filter(\.isFinished)
    let upcoming = session.blocks.filter { !$0.isFinished && $0.position != next?.position }
    let foldsDone = next != nil && done.count > doneRows
    let markedUpTo = upcoming.lastIndex { countsTowardMission($0) }.map { $0 + 1 } ?? 0
    let shownUpcoming = showsMore ? upcoming.count : max(upcomingRows, markedUpTo)

    if foldsDone {
      FoldRow(isOpen: $showsDone, isDone: true, count: done.count, minutes: nil)
    }

    if !foldsDone || showsDone {
      ForEach(done, id: \.position) { block in
        BlockRow(block: block, view: view, isNext: false, countsTowardMission: false)
      }
    }

    if let next {
      blockButton(next, isNext: true)
        .listRowSeparator(
          next.canTestOut && next.chapterId != nil ? .hidden : .automatic, edges: .bottom)

      if next.canTestOut, let chapterID = next.chapterId {
        Button {
          router.open(.testOut(chapterId: chapterID))
        } label: {
          Text(
            "Already know this? **Take the test**", tableName: "Today",
            comment: "Skips the next lesson's chapter with its test"
          )
          .font(.footnote)
          .foregroundStyle(.secondary)
        }
        .listRowBackground(NextRowBackground())
        .listRowSeparator(.hidden, edges: .top)
      }
    }

    ForEach(Array(upcoming.prefix(shownUpcoming)), id: \.position) { block in
      if next == nil {
        BlockRow(block: block, view: view, isNext: false, countsTowardMission: false)
      } else {
        blockButton(block, isNext: false)
      }
    }

    if upcoming.count > shownUpcoming || (showsMore && upcoming.count > upcomingRows) {
      FoldRow(
        isOpen: $showsMore, isDone: false, count: upcoming.count - max(upcomingRows, markedUpTo),
        minutes: upcoming.dropFirst(max(upcomingRows, markedUpTo)).reduce(0) {
          $0 + $1.estimatedMinutes
        })
    }

    if session.lessonsComing {
      Text(
        "\(session.blocks.count) activities so far · more as you go", tableName: "Today",
        comment: "A day whose lessons are still being outlined"
      )
      .font(.footnote.monospacedDigit())
      .foregroundStyle(.secondary)
    }
  }

  /// A block still to do opens from its row, in whatever order the learner likes; one waiting for
  /// earlier work doesn't.
  @ViewBuilder
  private func blockButton(_ block: StudyBlock, isNext: Bool) -> some View {
    let row = BlockRow(
      block: block, view: view, isNext: isNext, countsTowardMission: countsTowardMission(block),
      isBusy: busy == .block(block.position) || (isNext && busy == .main))

    if block.waitReason == nil {
      Button {
        open(block, false)
      } label: {
        row
      }
      .tint(.primary)
      .disabled(busy != nil)
      .listRowBackground(isNext ? NextRowBackground() : nil)
    } else {
      row
    }
  }

  /// Whether a mission still to do opens this block: doing it moves the day's missions.
  private func countsTowardMission(_ block: StudyBlock) -> Bool {
    !session.fullMeal.earned
      && session.missions.contains { !$0.isDone && $0.waitReason == nil && $0.opens(block) }
  }

  /// The day's main action: Start or Continue while there's a block to go on with, "Keep learning"
  /// with the plan's next lessons once it's done or on a rest day, the summary once it's done,
  /// practice on a day with nothing new, the Plan once the goal's date came with lessons left.
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
    case .ahead, .limit, .rest, .waiting:
      return nil
    }
  }
}

/// The day's main action as one full-width button, saying when it couldn't open the step.
struct TodayMainAction: View {
  enum Kind {
    case continueSession
    case keepLearning
    case practice(minutes: Int)
    case seePlan
    case startSession
    case summary
  }

  let kind: Kind
  let isBusy: Bool
  let failed: Bool
  let action: () -> Void

  var body: some View {
    VStack(spacing: 8) {
      Button(action: action) {
        HStack {
          if isBusy {
            ProgressView()
          }

          title
        }
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
      .disabled(isBusy)

      if failed {
        Text(
          "We couldn't open the next step. Try again.", tableName: "Today",
          comment: "Opening the day's next step failed"
        )
        .font(.footnote)
        .foregroundStyle(.destructive)
      }
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
    case .seePlan:
      Text("See your plan", tableName: "Today", comment: "Opens the Plan")
    case .startSession:
      Text("Start session", tableName: "Today", comment: "Starts today's session")
    case .summary:
      Text("See today's summary", tableName: "Today", comment: "Opens today's summary")
    }
  }
}

/// The day's segments, each as long as its block, with the time still to go.
private struct DayProgressRow: View {
  let session: StudyDay

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      if session.minutesLeft > 0 {
        Text(
          "\(studyDuration(minutes: session.minutesLeft)) left", tableName: "Today",
          comment: "The time still to go in today's session"
        )
        .font(.subheadline.monospacedDigit())
        .foregroundStyle(.secondary)
      }

      MeterParts(parts: session.meterParts)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      Text(
        "\(session.blocks.filter(\.isFinished).count) of \(session.blocks.count) done",
        tableName: "Today", comment: "How far the day's session is"))
  }
}

/// One block of the day: its mark, its name with what it's part of under it, and its minutes. A
/// finished one is one quiet line: the done mark and its name.
struct BlockRow: View {
  let block: StudyBlock
  let view: TodayView?
  let isNext: Bool
  let countsTowardMission: Bool
  var isBusy = false
  /// What the block holds, under its name: the session's next stop says it, Today's queue doesn't.
  var showsDetail = false

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      mark

      VStack(alignment: .leading, spacing: 2) {
        Text(block.displayTitle)
          .font(isNext ? .body.weight(.semibold) : .body)
          .foregroundStyle(block.isFinished ? .secondary : .primary)

        if !block.isFinished {
          ForEach(lines, id: \.self) { line in
            Text(line)
              .font(.footnote)
              .foregroundStyle(.secondary)
          }
        }
      }

      Spacer(minLength: 8)

      if isBusy {
        ProgressView()
      } else if !block.isFinished {
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
            .font(.footnote.monospacedDigit())
            .foregroundStyle(.secondary)
        }
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(status)
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

    if let view, view.isBeingWritten(block) {
      lines.append(
        String(
          localized: "Being written for you…", table: "Today",
          comment: "A lesson being written right now"))
    } else if let label = block.label(isCatchingUp: isCatchingUp) {
      lines.append(label)
    }

    if block.weakest || block.fullReview || showsDetail, let detail = block.detail {
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

/// A lesson the plan dates today that the learner's plan holds for Plus, after the day's blocks.
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

/// Done blocks or the day's later ones folded into one row that opens them.
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
          .foregroundStyle(isDone ? AnyShapeStyle(.success) : AnyShapeStyle(.secondary))
          .frame(minWidth: 20)
          .accessibilityHidden(true)

        if isDone {
          Text("\(count) done", tableName: "Today", comment: "Folded done blocks")
        } else if isOpen {
          Text("Show less", tableName: "Today", comment: "Folds the day's later blocks")
        } else {
          Text("+\(count) more", tableName: "Today", comment: "Folded later blocks")
        }

        Spacer()

        if let minutes, !isOpen {
          Text(studyDuration(minutes: minutes))
            .font(.footnote.monospacedDigit())
        }

        Image(systemName: "chevron.down")
          .rotationEffect(.degrees(isOpen ? 180 : 0))
          .font(.footnote)
          .accessibilityHidden(true)
      }
      .foregroundStyle(.secondary)
    }
    .tint(.primary)
  }
}

/// What the day is when there's nothing to start, in one line under the queue: done, a rest day,
/// the study time used up, nothing new, the goal's date that came with lessons left, or lessons
/// still being written.
private struct TodayDayStatus: View {
  let view: TodayView
  private let sentence: String
  private let clause: String?
  private let systemImage: String

  init?(view: TodayView) {
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
    case .waiting:
      systemImage = "hourglass"
      sentence = String(
        localized: "Getting today's lessons ready…", table: "Today",
        comment: "The day's lessons are being outlined")
      clause = String(
        localized: "They show up here on their own.", table: "Today",
        comment: "The day's lessons are being outlined")
    case .limit:
      systemImage = "hourglass"
      sentence = String(
        localized: "That's today's study time.", table: "Today", comment: "Daily limit reached")
      clause = Self.seeYou(session.week)
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
    case .underway:
      return nil
    }
  }

  var body: some View {
    Label {
      VStack(alignment: .leading, spacing: 2) {
        Text(sentence)

        if let clause {
          Text(clause)
            .foregroundStyle(.secondary)
        }
      }
    } icon: {
      Image(systemName: systemImage)
        .foregroundStyle(.secondary)
    }
    .font(.subheadline)
  }

  /// When the learner's study time is back: tomorrow, the next study day by name, or next session.
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

/// The day's next row, highlighted as main's muted row: a system fill over the row's own background,
/// so it reads on dark rows (where a fill alone shows the black page through it) and grows with
/// Increase Contrast.
struct NextRowBackground: View {
  var body: some View {
    Color(.secondarySystemGroupedBackground)
      .overlay(Color(.tertiarySystemFill))
  }
}

/// Earlier unfinished lessons, in the plan's saved order, over a day not opened yet: Today shows
/// the saved plan, and starting the session fits it to today's time, starting with these, so the
/// day that opens can differ from the one shown. Open while the list is short.
private struct TodayEarlierWorkSection: View {
  @State private var isExpanded: Bool

  let items: [TodayView.EarlierWork]

  init(items: [TodayView.EarlierWork]) {
    self.items = items
    _isExpanded = State(initialValue: items.count <= 5)
  }

  var body: some View {
    Section {
      DisclosureGroup(isExpanded: $isExpanded) {
        Text(
          "Start with these. Starting your session fits the plan to today's time.",
          tableName: "Today", comment: "Why the day that opens can differ from the one shown"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)

        ForEach(Array(items.enumerated()), id: \.offset) { _, item in
          Text(item.title)
        }
      } label: {
        Text(
          "Earlier unfinished work · \(items.count.formatted())", tableName: "Today",
          comment: "Lessons left from earlier days, with how many"
        )
        .font(.body.weight(.medium))
      }
    }
  }
}
