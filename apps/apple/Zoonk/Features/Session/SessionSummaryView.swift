import SwiftUI

/// The day's summary, one screen of numbers (B2-020): the title, the tiles, Tomorrow and more time.
/// Two panes keep "Earned today" beside it, as main's wide layout does.
struct SessionSummaryView: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(AppRouter.self) private var router
  @Environment(StudySessionStore.self) private var store
  @Environment(TodayStore.self) private var today

  let sessionID: String
  let stopped: Bool

  @State private var action: Task<Void, Never>?
  @State private var isBusy = false
  @State private var failed: SummaryAction?

  private enum SummaryAction {
    case keepGoing, extraTime
  }

  var body: some View {
    let summary = store.summary(id: sessionID)

    Group {
      if let value = summary.value {
        content(value)
      } else if case .failed = summary.state {
        ContentUnavailableView {
          Label {
            Text("The summary didn't load", tableName: "Session", comment: "Load failed")
          } icon: {
            Image(systemName: "wifi.exclamationmark")
          }
        } actions: {
          Button {
            Task { await summary.refresh() }
          } label: {
            Text("Try again", tableName: "Session", comment: "Retries loading the summary")
          }
          .buttonStyle(.outline)
        }
        .lonePage()
      } else {
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    }
    .loads(summary)
    .completionMoments(
      certificates: summary.value?.certificates ?? [], milestone: summary.value?.ceremony
    )
    .onDisappear {
      action?.cancel()
    }
  }

  private func content(_ summary: SessionSummary) -> some View {
    let visit = "\(sessionID):\(summary.brainPower)"

    return SummaryVisit(visit: visit) {
      PaneSplit {
        page {
          numbers(summary, showsBrainPower: false)
        }
      } secondary: {
        page {
          earnedToday(summary)
        }
        .bottomBar(note: failureNote) { actions(summary) }
      } single: {
        page {
          numbers(summary, showsBrainPower: true)
        }
        .bottomBar(note: failureNote) { actions(summary) }
      }
    }
  }

  private func page(@ViewBuilder content: () -> some View) -> some View {
    ZoonkList {
      content()
    }
    .contentMargins(.top, 0, for: .scrollContent)
    .pageMargins()
    .listSectionSpacing(.compact)
  }

  /// Brain Power is a tile only where "Earned today" isn't beside it.
  @ViewBuilder
  private func numbers(_ summary: SessionSummary, showsBrainPower: Bool) -> some View {
    Section {
      VStack(alignment: .leading, spacing: 4) {
        title(summary)
          .typeStyle(.heroTitle)
          .accessibilityAddTraits(.isHeader)

        if stopped, summary.minutes >= 1 {
          Text(
            "\(studyDuration(minutes: summary.minutes)) today", tableName: "Session",
            comment: "Time studied today, under a summary stopped early"
          )
          .monospacedDigit()
          .foregroundStyle(.mutedForeground)
        }
      }
      .listRowBackground(Color.clear)
    }

    Section {
      SummaryTiles(
        summary: summary, goalKind: learner.summary.value?.shownGoal?.kind,
        showsBrainPower: showsBrainPower)
    }
    .listRowBackground(Color.clear)
    .listRowInsets(.vertical, 0)

    if !stopped, let tomorrow = summary.tomorrow {
      Section {
        Label {
          Text(tomorrow.title)
        } icon: {
          KindMark(kind: .lesson)
        }
      } header: {
        SectionTitle(Text("Tomorrow", tableName: "Session", comment: "Tomorrow's lesson"))
      }
    }

    if !stopped, summary.extraTime.available {
      Section {
        extraTimeButton(summary.extraTime)
      }
      .listRowBackground(Color.clear)
    }

  }

  /// "Earned today" beside the numbers: the buddy, the day's Brain Power even when it's none, and
  /// the rewards.
  @ViewBuilder
  private func earnedToday(_ summary: SessionSummary) -> some View {
    Section {
      VStack(alignment: .leading, spacing: 16) {
        SummaryBuddy(look: learner.summary.value?.buddy ?? BuddyLook())

        MomentReadout(tint: .brainText) {
          EarnedNumber(value: summary.brainPower)
        } words: {
          Text("Brain Power", tableName: "Session", comment: "Brain Power earned")
        }
      }
      .listRowBackground(Color.clear)
    } header: {
      SectionTitle(Text("Earned today", tableName: "Session", comment: "What the session earned"))
    }

    RewardRows(summary: summary, missionsBonus: store.session(id: sessionID).value?.fullMeal.bonus)
  }

  private var failureNote: BarNote? {
    switch failed {
    case .keepGoing:
      BarNote(
        LocalizedStringResource(
          "We couldn't open the next step. Try again.", table: "Session",
          comment: "Going on with a stopped day failed"))
    case .extraTime:
      BarNote(
        LocalizedStringResource(
          "That didn't save. Try again.", table: "Session", comment: "Adding more time failed"))
    case nil:
      nil
    }
  }

  /// "See mistakes" when there are some, "Continue" on a day stopped early, then Finish.
  @ViewBuilder
  private func actions(_ summary: SessionSummary) -> some View {
    if summary.mistakesSaved > 0 {
      Button {
        router.open(.mistakes)
      } label: {
        Text("See mistakes", tableName: "Session", comment: "Opens the mistakes notebook")
      }
      .buttonStyle(.outline)
      .disabled(isBusy)
    }

    if stopped, let next = store.session(id: sessionID).value?.nextBlock {
      BusyButton(isBusy: isBusy) {
        keepGoing(next)
      } label: {
        Text("Continue", tableName: "Session", comment: "Goes on with today's list after stopping")
      }
      .buttonStyle(.outline)
    }

    Button {
      router.dismissTask()
    } label: {
      Text("Finish", tableName: "Session", comment: "Closes the summary")
    }
    .buttonStyle(.mainAction)
    .keyboardShortcut(.defaultAction)
  }

  /// One small button in the column, the same piece Today's extra time uses.
  private func extraTimeButton(_ extraTime: StudyDay.ExtraTime) -> some View {
    BusyButton(isBusy: isBusy) {
      keepLearning()
    } label: {
      if extraTime.lessons.isEmpty {
        Text(
          "Practice \(extraTime.minutes) more min", tableName: "Session",
          comment: "Adds practice once the day is done; the number is minutes")
      } else {
        Text("Keep learning", tableName: "Session", comment: "Adds the next lessons")
      }
    }
    .buttonStyle(.outline)
    .controlSize(.small)
  }

  private func title(_ summary: SessionSummary) -> Text {
    if stopped || !summary.finished {
      return Text("Done for now", tableName: "Session", comment: "Summary after stopping")
    }

    return summary.minutes < 1
      ? Text("Done in under a minute", tableName: "Session", comment: "Session time")
      : Text(
        "Done in \(studyDuration(minutes: summary.minutes))", tableName: "Session",
        comment: "Session time")
  }

  /// Opens the next block, as the next stop's button does.
  private func keepGoing(_ next: StudyBlock) {
    isBusy = true
    failed = nil

    action = Task {
      let result = await today.open(next, as: .next, sessionID: sessionID)
      isBusy = false

      switch result {
      case .done(.session), .done(.lessonWait):
        // The next stop shows the step, and follows a lesson being written.
        router.playback.resume(sessionID: sessionID)
      case .done(let destination) where !Task.isCancelled:
        router.playback.resume(sessionID: sessionID)
        router.openStudy(destination)
      case .failed:
        failed = .keepGoing
      case .done, .obsolete:
        break
      }
    }
  }

  private func keepLearning() {
    isBusy = true
    failed = nil

    action = Task {
      let result = await today.addExtraTime(sessionID: sessionID)
      isBusy = false

      switch result {
      case .done(let destination) where !Task.isCancelled:
        router.openStudy(destination)
      case .failed:
        failed = .extraTime
      case .done, .obsolete:
        break
      }
    }
  }
}

/// Main's session numbers: right answers, where the goal stands and, where "Earned today" isn't
/// beside them, the Brain Power earned.
private struct SummaryTiles: View {
  let summary: SessionSummary
  let goalKind: LearnerGoal.Kind?
  let showsBrainPower: Bool

  @ScaledMetric(relativeTo: .body) private var minimumWidth = 150.0

  var body: some View {
    StatTileGrid(columns: [4, 2], minimumWidth: minimumWidth) {
      if summary.questions > 0 {
        StatTile(
          label: Text("Right", tableName: "Session", comment: "Questions answered right"),
          value: Text(verbatim: "\(summary.correct)/\(summary.questions)"),
          systemImage: "target", tone: .success, detail: rightDetail)
      }

      if let goal = goalNumber {
        StatTile(
          label: goal.label, value: Text(verbatim: goal.value),
          systemImage: goal.dropped ? "chart.line.downtrend.xyaxis" : "chart.line.uptrend.xyaxis",
          tone: goal.dropped ? .neutral : .success,
          detail: goal.before.map { before in
            let change = Text(verbatim: "\(before) → \(goal.value)")
            // A number that went down says so quietly, never in the color of progress.
            return goal.dropped ? change : change.foregroundStyle(.successText)
          })
      }

      if showsBrainPower {
        StatTile(
          label: Text("Brain Power", tableName: "Session", comment: "Brain Power earned"),
          value: EarnedNumber(value: summary.brainPower), tone: .brain,
          icon: { Image(systemName: "brain") }, detail: belt,
          spokenValue: Text(summary.brainPower, format: .number.sign(strategy: .always())))
      }
    }
  }

  private var belt: Text? {
    summary.belt.flatMap { belt in
      ProgressBelt(rawValue: belt.after.color).map { Text(levelName($0, belt.after.level)) }
    }
  }

  private var rightDetail: Text? {
    let accuracy = summary.accuracy.map {
      Text($0, format: .percent.precision(.fractionLength(0))).foregroundStyle(.successText)
    }
    let net = summary.netScore.map {
      Text("net \($0)", tableName: "Session", comment: "Right minus wrong answers")
    }

    guard let accuracy, let net else {
      return accuracy ?? net
    }

    return Text("\(accuracy)\u{00A0}· \(net)")
  }

  /// A language goal has no number here; an exam shows its preparation, any other goal its
  /// progress.
  private var goalNumber: (label: Text, value: String, before: String?, dropped: Bool)? {
    let share: SessionSummary.Share

    switch goalKind {
    case .exam: share = summary.preparation
    case .learn: share = summary.progress
    case .language, .explain, nil: return nil
    }

    guard let after = share.after else {
      return nil
    }

    let start = share.before ?? after
    let format: (Double) -> String =
      goalKind == .exam
      ? { $0.formatted(.percent.precision(.fractionLength(0))) }
      : { goalProgressPercent($0) }
    let moved = format(after) != format(start)

    return (
      goalKind == .exam
        ? Text("Preparation", tableName: "Session", comment: "An exam's preparation")
        : Text("Progress", tableName: "Session", comment: "The goal's progress"),
      format(after), moved ? format(start) : nil, moved && after < start
    )
  }
}

/// Main's `useFirstSummaryVisit`: only the summary's first visit celebrates.
private let celebratedSummaryKey = "celebratedSessionSummary"

private struct SummaryVisit<Content: View>: View {
  let visit: String
  @ViewBuilder let content: Content

  @State private var isFirstVisit: Bool

  init(visit: String, @ViewBuilder content: () -> Content) {
    self.visit = visit
    self.content = content()
    _isFirstVisit = State(
      initialValue: UserDefaults.standard.string(forKey: celebratedSummaryKey) != visit)
  }

  var body: some View {
    content
      .environment(\.celebrates, isFirstVisit)
      .onAppear {
        UserDefaults.standard.set(visit, forKey: celebratedSummaryKey)
      }
  }
}

private struct SummaryBuddy: View {
  @Environment(\.celebrates) private var celebrates

  let look: BuddyLook

  var body: some View {
    var studied = look
    studied.studiedToday = true

    return BuddyCharacter(
      look: studied, expression: celebrates ? .happy : .proud,
      reaction: celebrates ? ActReaction(act: .proud, delay: .beat) : nil
    )
    .frame(width: 96, height: 96)
  }
}

/// Main's reward rows: the day's missions bonus, the new levels and the best streak.
private struct RewardRows: View {
  let summary: SessionSummary
  let missionsBonus: Int?

  var body: some View {
    let stripes = summary.beltGain
    let streak = summary.shownStreak

    if summary.missionsDone || stripes != nil || streak != nil {
      Section {
        if summary.missionsDone {
          IconLabeledContent {
            if let missionsBonus {
              Text(missionsBonus, format: .number.sign(strategy: .always()))
                .monospacedDigit()
                .foregroundStyle(.brainText)
            }
          } title: {
            Text("Today's missions", tableName: "Session", comment: "The missions' header")
            Text(
              "All \(summary.missions.count) done", tableName: "Session",
              comment: "Every one of the day's missions is done")
          } icon: {
            Image(systemName: "checklist")
          }
        }

        if let stripes, let belt = ProgressBelt(rawValue: stripes.after.color) {
          VStack(alignment: .leading, spacing: 8) {
            IconLabeledContent {
              Text(
                "+\(stripes.stripesGained) levels", tableName: "Session",
                comment: "How many belt levels the session added"
              )
              .monospacedDigit()
              .foregroundStyle(.successText)
            } title: {
              Text(levelName(belt, stripes.after.level))
            } icon: {
              BeltDot(belt: belt)
            }

            // The ticks hold still: each level already landed at the end of the block that reached it.
            BeltTicks(belt: belt, level: stripes.after.level)
          }
          .accessibilityElement(children: .combine)
        }

        if let streak {
          Label {
            Text(
              "\(streak) right in a row", tableName: "Session",
              comment: "The session's most right answers in a row")
          } icon: {
            Image(systemName: "chevron.up.2")
          }
        }
      }
    }
  }
}

extension SessionSummary {
  /// The bonus is once a day across goals, so another goal's earning it never says this goal's
  /// missions are done.
  fileprivate var missionsDone: Bool {
    fullMeal && !missions.isEmpty && missions.allSatisfy(\.isDone)
  }

  fileprivate var beltGain: Belt? {
    belt.flatMap { $0.stripesGained > 0 ? $0 : nil }
  }

  fileprivate var shownStreak: Int? {
    bestStreak >= 3 ? bestStreak : nil
  }
}
