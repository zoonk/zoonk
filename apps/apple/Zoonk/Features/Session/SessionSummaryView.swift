import SwiftUI

/// Main's two steps: how the session went, then what it earned. One column pages them, and gives
/// the rewards a step of their own only when the session earned more than Brain Power; two panes
/// show both, as main's wide layout does.
struct SessionSummaryView: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(AppRouter.self) private var router
  @Environment(StudySessionStore.self) private var store
  @Environment(TodayStore.self) private var today

  let sessionID: String
  let stopped: Bool

  @State private var action: Task<Void, Never>?
  @State private var isBusy = false
  @State private var failed: SummaryAction?
  /// Above the split, so folding or unfolding keeps the learner's step.
  @State private var step = SummaryStep.done
  /// Main's `revisited`: a step the learner moved on from shows still when they come back to it.
  @State private var stepsLeft: Set<SummaryStep> = []
  @AccessibilityFocusState private var focusedStep: SummaryStep?

  /// The least Finish keeps beside a stopped session's two choices (main's `lg:min-w-40`), so on a
  /// phone it fills a line of its own.
  @ScaledMetric(relativeTo: .body) private var finishMinimumWidth = 160.0

  private enum SummaryAction {
    case keepGoing, extraTime
  }

  private enum SummaryStep: Hashable {
    case done, rewards
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
        page(.done, visit: visit) {
          doneStep(summary, showsBrainPower: false)
        }
      } secondary: {
        page(.rewards, visit: visit) {
          rewards(summary, isStep: false)
        }
        .pageBar { actionBar(summary, at: nil) }
      } single: {
        if !stopped, summary.hasRewardsBeyondBrainPower {
          TabView(selection: $step) {
            page(.done, visit: visit) {
              doneStep(summary, showsBrainPower: true)
            }
            .tag(SummaryStep.done)

            page(.rewards, visit: visit) {
              rewards(summary, isStep: true)
            }
            .tag(SummaryStep.rewards)
          }
          .tabViewStyle(.page(indexDisplayMode: .always))
          .indexViewStyle(.page(backgroundDisplayMode: .always))
          .pageBar {
            // Only the page slides: the buttons change at once, as they do after a swipe.
            actionBar(summary, at: step)
              .animation(nil, value: step)
          }
        } else {
          page(.done, visit: visit) {
            doneStep(summary, showsBrainPower: true)
          }
          .pageBar { actionBar(summary, at: nil) }
        }
      }
      .onChange(of: step) { previous, current in
        stepsLeft.insert(previous)
        focusedStep = current
      }
    }
  }

  /// A step celebrates on its first visit only: coming back to it, or drawing it again after a
  /// fold, shows it still.
  private func page(
    _ shown: SummaryStep, visit: String, @ViewBuilder content: () -> some View
  ) -> some View {
    ZoonkList {
      content()
    }
    .contentMargins(.top, 0, for: .scrollContent)
    .pageMargins()
    .listSectionSpacing(.compact)
    .celebratesOnce(id: "\(visit):\(shown)")
    .transformEnvironment(\.celebrates) { celebrates in
      celebrates = celebrates && !stepsLeft.contains(shown)
    }
  }

  /// Main's `DoneStep`. Brain Power is a tile only where the rewards aren't beside it.
  @ViewBuilder
  private func doneStep(_ summary: SessionSummary, showsBrainPower: Bool) -> some View {
    Section {
      VStack(alignment: .leading, spacing: 4) {
        title(summary)
          .typeStyle(.heroTitle)
          .accessibilityAddTraits(.isHeader)
          .accessibilityFocused($focusedStep, equals: .done)

        if stopped, summary.minutes >= 1 {
          Text(
            "\(studyDuration(minutes: summary.minutes)) so far", tableName: "Session",
            comment: "Time studied in a session stopped for today"
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

    let risen = summary.risenSkills

    if !risen.isEmpty {
      Section {
        ForEach(risen, id: \.skillId) { skill in
          LabeledContent {
            Text(
              "\(skill.from.label) → \(skill.to.label.foregroundStyle(Color(.foreground)))",
              tableName: "Session",
              comment: "A skill's state before and after the session, such as Learning → Solid")
          } label: {
            Text(skill.name)
          }
        }
      } header: {
        SectionTitle(
          Text("Skills that rose", tableName: "Session", comment: "Skills that moved up"))
      }
    }

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
  }

  /// Main's `RewardsStep`, or its "Earned today" beside the session, which shows the Brain Power
  /// even when the session earned none.
  @ViewBuilder
  private func rewards(_ summary: SessionSummary, isStep: Bool) -> some View {
    if isStep {
      Section {
        rewardsHead(summary, isStep: true)
      }
    } else {
      Section {
        rewardsHead(summary, isStep: false)
      } header: {
        SectionTitle(Text("Earned today", tableName: "Session", comment: "What the session earned"))
      }
    }

    RewardRows(summary: summary, missionsBonus: store.session(id: sessionID).value?.fullMeal.bonus)
  }

  private func rewardsHead(_ summary: SessionSummary, isStep: Bool) -> some View {
    VStack(alignment: .leading, spacing: 16) {
      SummaryBuddy(look: learner.summary.value?.buddy ?? BuddyLook())

      if summary.brainPower > 0 || !isStep {
        MomentReadout(tint: .brainText) {
          EarnedNumber(value: summary.brainPower)
        } words: {
          Text("Brain Power", tableName: "Session", comment: "Brain Power earned")
        }
        .accessibilityAddTraits(isStep ? .isHeader : [])
        .accessibilityFocused($focusedStep, equals: .rewards)
      } else if isStep {
        Text("Rewards", tableName: "Session", comment: "Title of what the session earned")
          .typeStyle(.heroTitle)
          .accessibilityAddTraits(.isHeader)
          .accessibilityFocused($focusedStep, equals: .rewards)
      }
    }
    .listRowBackground(Color.clear)
  }

  /// Main's `SummaryButtons` and `SummaryOptions`. `shownStep` is the step one column shows, nil
  /// where the summary has no steps. More time sits only beside Finish: two buttons that keep
  /// studying would leave the learner guessing which one does.
  private func actionBar(_ summary: SessionSummary, at shownStep: SummaryStep?) -> some View {
    VStack(spacing: 12) {
      if failed == .keepGoing {
        failure(
          LocalizedStringResource(
            "We couldn't open the next step. Try again.", table: "Session",
            comment: "Keep going failed"))
      }

      actions(summary, at: shownStep)

      if !stopped, shownStep != .done, summary.extraTime.available {
        extraTimeButton(summary.extraTime)

        if failed == .extraTime {
          failure(
            LocalizedStringResource(
              "That didn't save. Try again.", table: "Session",
              comment: "Adding more time failed"))
        }
      }
    }
    .controlSize(.large)
  }

  /// See mistakes and Keep going sit before Finish, which takes the rest of the line. A stopped
  /// session with mistakes has both: they share a line above Finish where it would keep less than
  /// `finishMinimumWidth` beside them, and take a line each where their labels don't fit side by
  /// side. The first of two steps ends with Continue, and the rewards step starts with Back.
  @ViewBuilder
  private func actions(_ summary: SessionSummary, at shownStep: SummaryStep?) -> some View {
    let next = stopped ? store.session(id: sessionID).value?.nextBlock : nil
    let seesMistakes = summary.mistakesSaved > 0

    if shownStep == .rewards {
      HStack(spacing: 12) {
        StepBackButton(
          label: Text(
            "Back", tableName: "Session", comment: "Goes back to the summary's first step")
        ) {
          turn(to: .done)
        }

        finishButton
      }
    } else if seesMistakes, let next {
      ViewThatFits(in: .horizontal) {
        HStack(spacing: 12) {
          seeMistakesButton(sharesLine: false)
          keepGoingButton(next, sharesLine: false)
          finishButton
            .frame(minWidth: finishMinimumWidth)
        }

        VStack(spacing: 12) {
          HStack(spacing: 12) {
            seeMistakesButton(sharesLine: true)
            keepGoingButton(next, sharesLine: true)
          }

          finishButton
        }

        VStack(spacing: 12) {
          seeMistakesButton(sharesLine: false)
          keepGoingButton(next, sharesLine: false)
          finishButton
        }
        .buttonSizing(.flexible)
      }
    } else {
      ButtonRow(spacing: 12) {
        if seesMistakes {
          seeMistakesButton(sharesLine: false)
        }

        if let next {
          keepGoingButton(next, sharesLine: false)
        }

        if shownStep == .done {
          continueButton
        } else {
          finishButton
        }
      }
    }
  }

  private var continueButton: some View {
    Button {
      turn(to: .rewards)
    } label: {
      Text("Continue", tableName: "Session", comment: "Turns to what the session earned")
        .frame(maxWidth: .infinity)
    }
    .buttonStyle(.mainAction)
    .keyboardShortcut(.defaultAction)
  }

  private func turn(to shown: SummaryStep) {
    withAnimation(reduceMotion ? nil : .default) {
      step = shown
    }
  }

  private var finishButton: some View {
    Button {
      router.dismissTask()
    } label: {
      Text("Finish", tableName: "Session", comment: "Closes the summary")
        .frame(maxWidth: .infinity)
    }
    .buttonStyle(.mainAction)
    .keyboardShortcut(.defaultAction)
  }

  private func seeMistakesButton(sharesLine: Bool) -> some View {
    Button {
      router.open(.mistakes)
    } label: {
      choiceLabel(
        Text("See mistakes", tableName: "Session", comment: "Opens the mistakes notebook"),
        sharesLine: sharesLine)
    }
    .buttonStyle(.outline)
    .disabled(isBusy)
  }

  private func keepGoingButton(_ next: StudyBlock, sharesLine: Bool) -> some View {
    BusyButton(isBusy: isBusy) {
      keepGoing(next)
    } label: {
      choiceLabel(
        Text("Keep going", tableName: "Session", comment: "Goes on with a stopped session"),
        sharesLine: sharesLine)
    }
    .buttonStyle(.outline)
  }

  /// Main's `SHARED_ROW_ACTION_CLASS`: the two split a shared line evenly, and neither cuts its label
  /// short.
  @ViewBuilder
  private func choiceLabel(_ label: Text, sharesLine: Bool) -> some View {
    if sharesLine {
      label
        .fixedSize()
        .frame(maxWidth: .infinity)
    } else {
      label
    }
  }

  private func extraTimeButton(_ extraTime: StudyDay.ExtraTime) -> some View {
    BusyButton(isBusy: isBusy) {
      keepLearning()
    } label: {
      Group {
        if extraTime.lessons.isEmpty {
          Text(
            "Study \(extraTime.minutes) more minutes", tableName: "Session",
            comment: "Adds practice once the day is done")
        } else {
          Text("Keep learning", tableName: "Session", comment: "Adds the next lessons")
        }
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.ghost)
  }

  private func failure(_ message: LocalizedStringResource) -> some View {
    FailureLine(message: message)
      .typeStyle(.note)
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

  /// Main's "Keep going" opens the next block, as the next stop's button does.
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

/// Main's session numbers: right answers, where the goal stands, what comes back to review and, where
/// the rewards aren't beside them, the Brain Power earned.
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

      StatTile(
        label: Text("To review", tableName: "Session", comment: "Topics that come back to review"),
        value: Text(summary.comesBack.reduce(0) { $0 + $1.skills }, format: .number),
        systemImage: "arrow.counterclockwise", detail: comesBack)

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
    summary.belt.map {
      Text(
        "\(beltName($0.after.color) ?? $0.after.color), level \($0.after.level)",
        tableName: "Session", comment: "The belt and level reached")
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

  private var comesBack: Text? {
    guard !summary.comesBack.isEmpty else {
      return nil
    }

    let days = summary.comesBack.compactMap { studyDate($0.date) }
      .map { $0.formatted(.studyDay.month(.abbreviated).day()) }

    return Text(
      "Back \(days.formatted(.list(type: .and)))", tableName: "Session",
      comment: "When the topics to review come back, such as Back Oct 30 and Nov 7")
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

/// Main's reward rows: the day's missions bonus, a belt's new levels and the best streak.
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
              Text(
                "\(beltName(stripes.after.color) ?? stripes.after.color), level \(stripes.after.level)",
                tableName: "Session", comment: "The belt and level reached")
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

  /// Main's `hasRewardsBeyondBrainPower`: what gives the rewards a step of their own.
  fileprivate var hasRewardsBeyondBrainPower: Bool {
    missionsDone || beltGain != nil || shownStreak != nil
  }

  /// Main's `getRisenSkills`: a skill that slipped back is memory's to bring back, not news for the
  /// end of the day.
  fileprivate var risenSkills: [SkillMove] {
    Array(skillsMoved.filter { $0.to.rank > $0.from.rank }.prefix(2))
  }
}

extension GoalChapter.Skill.State {
  fileprivate var rank: Int {
    switch self {
    case .new: 0
    case .learning: 1
    case .solid: 2
    case .mastered: 3
    }
  }
}
