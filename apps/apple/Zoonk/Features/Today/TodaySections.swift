import SwiftUI

/// Being done for the day, or resting, never hides what comes next. Its first lesson and Keep
/// learning add the same lessons, each as its own tap, so only the one pressed spins.
struct TodayUpNextSection: View {
  let view: TodayView
  let busy: TodayDayView.Tap?
  let failed: TodayDayView.Tap?
  let keepLearning: (TodayDayView.Tap) -> Void

  var body: some View {
    Section {
      ForEach(Array(view.upNextLessons.enumerated()), id: \.offset) { index, lesson in
        let row = HStack(alignment: .firstTextBaseline, spacing: 12) {
          KindMark(kind: .lesson)
            .frame(minWidth: 20)
          Text(lesson.title)
            .typeStyle(.rowTitle)
          Spacer(minLength: 8)
          Text(studyDuration(minutes: lesson.minutes))
            .typeStyle(.data)
            .foregroundStyle(.mutedForeground)
            .coveredBySpinner(index == 0 && busy == .upNextLesson, alignment: .trailing)
        }

        if index == 0 {
          Button {
            keepLearning(.upNextLesson)
          } label: {
            row
          }
          .tint(.primary)
          .disabled(busy != nil && busy != .upNextLesson)
          .accessibilityBusy(busy == .upNextLesson)
          .currentRow()
        } else {
          row
        }
      }
    } header: {
      SectionTitle(
        Text("Up next in your plan", tableName: "Today", comment: "The plan's next lessons"))
    }

  }
}

/// Nothing beside "Keep learning" or past the goal's date.
struct TodayMoreSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner

  let view: TodayView
  let busy: TodayDayView.Tap?
  let failed: TodayDayView.Tap?
  let addTime: () -> Void
  let catchUp: () -> Void

  var body: some View {
    let state = view.session.state

    if !view.isPastDate && view.upNextLessons.isEmpty {
      if hasRows(state) {
        Section {
          if state == .ahead {
            TodayChallengeRow(view: view)

            Button {
              router.select(.buddy)
            } label: {
              Label {
                Text(
                  "Practice with \(learner.buddyDisplayName)", tableName: "Today",
                  comment: "Opens the buddy's quiz")
              } icon: {
                Image(systemName: "bubble.left")
              }
            }
            .tint(.primary)
          }

          if state == .done && view.session.extraTime.available {
            Button(action: addTime) {
              Label {
                VStack(alignment: .leading, spacing: 2) {
                  view.studiedToday
                    ? Text(
                      "Practice \(view.session.extraTime.minutes) more min", tableName: "Today",
                      comment: "Adds study time once the day is done; the number is minutes")
                    : Text(
                      "Practice \(view.session.extraTime.minutes) min", tableName: "Today",
                      comment: "Adds practice on a day with nothing new; the number is minutes")

                  if failed == .keepLearning {
                    saveFailure
                  }
                }
              } icon: {
                Image(systemName: ActionIcon.play.rawValue)
                  .coveredBySpinner(busy == .keepLearning)
              }
            }
            .disabled(busy != nil && busy != .keepLearning)
            .accessibilityBusy(busy == .keepLearning)
          }

          if let later = view.session.catchUp?.later, later.offered, !view.isWelcomeBack,
            state == .underway || state == .done
          {
            VStack(alignment: .leading, spacing: 8) {
              HStack(alignment: .firstTextBaseline) {
                Text(
                  "\(later.lessons) lessons from earlier days", tableName: "Today",
                  comment: "Lessons earlier days left, which can be added to today"
                )
                .typeStyle(.rowTitle)
                .frame(maxWidth: .infinity, alignment: .leading)

                Text(studyDuration(minutes: later.minutes))
                  .typeStyle(.data)
                  .foregroundStyle(.mutedForeground)
              }

              BusyButton(isBusy: busy == .catchUp, action: catchUp) {
                Text(
                  "Add to today", tableName: "Today",
                  comment: "Adds the lessons earlier days left to today")
              }
              .buttonStyle(.outline)
              .controlSize(.small)
              .disabled(busy != nil && busy != .catchUp)

              if failed == .catchUp {
                saveFailure
              }
            }
          }
        }
      }
    }
  }

  private var saveFailure: some View {
    FailureLine(
      message: LocalizedStringResource(
        "That didn't save. Try again.", table: "Today", comment: "A change couldn't be saved")
    )
    .typeStyle(.note)
  }

  private func hasRows(_ state: DayState) -> Bool {
    switch state {
    case .ahead:
      true
    case .done:
      view.session.extraTime.available || view.session.catchUp?.later.offered == true
    case .underway:
      view.session.catchUp?.later.offered == true
    case .prepare, .rest, .waiting:
      false
    }
  }
}

struct TodayChallengeRow: View {
  @Environment(AppRouter.self) private var router

  let view: TodayView

  var body: some View {
    if let challenge = view.weeklyChallenge, let planItemID = challenge.planItemId,
      let dateText = challenge.date, dateText >= view.session.localDate,
      let date = studyDate(dateText)
    {
      let day = date.formatted(.studyDay.weekday(.wide))

      Button {
        router.open(.challenge(planItemId: planItemID))
      } label: {
        Label {
          challenge.kind == "mock"
            ? Text("See \(day)'s mock exam", tableName: "Today", comment: "The week's mock")
            : Text("See \(day)'s challenge", tableName: "Today", comment: "The week's challenge")
        } icon: {
          KindMark(kind: challenge.kind == "mock" ? .mock : .challenge)
        }
      }
      .tint(.primary)
    }
  }
}

/// Main answers a proposal right on Today, where the Plan never shows it, and missed days that put
/// the goal's date at risk with their choices (C-42, C-43).
struct TodayPlanChangeSection: View {
  @AccessibilityFocusState private var isResultFocused: Bool

  let view: TodayView
  let shown: AnsweredPlanChange
  let next: TodayView.PlanChange?
  @Binding var isOpen: Bool
  let isSaving: Bool
  let failed: Bool
  let answer: (PlanChangeDecision) -> Void
  let showNext: () -> Void
  let adjust: (AdjustPlanSheet.Section) -> Void

  private var change: TodayView.PlanChange { shown.change }

  private var isBehind: Bool { change.kind == "missedDays" && change.behind != nil }

  private var isExam: Bool { view.goal.kind == .exam }

  /// The proposal's answers are in its sheet, so while it's open a failed answer shows there,
  /// beside them; the page keeps it for Undo and the missed-days choices.
  private var answersInSheet: Bool { isOpen && shown.decision == nil && !isBehind }

  var body: some View {
    Section {
      if let decision = shown.decision {
        SuggestionLine {
          StatusMark(status: .done)
        } summary: {
          Text(result(decision))
            .accessibilityFocused($isResultFocused)
        } action: {
          Group {
            if next != nil {
              Button(action: showNext) {
                Text(
                  "Next suggestion", tableName: "Today", comment: "Shows the next plan suggestion")
              }
            } else if decision == .applied, change.canUndo {
              BusyButton(isBusy: isSaving, icon: .undo) {
                answer(.undone)
              } label: {
                Text(
                  "Undo", tableName: "Today", comment: "Undoes a plan change the learner applied")
              }
            }
          }
          .buttonStyle(.outline)
          .controlSize(.small)
        }
        .listRowSeparator(.hidden)
      } else if isBehind, let behind = change.behind {
        missedDays(behind)
      } else {
        SuggestionLine {
          SuggestionMark(kind: change.source == "notice" ? .symbol("doc.badge.clock") : .sparkle)
        } summary: {
          Text(title)
        } action: {
          SuggestionOpen(isOpen: $isOpen) {
            proposal
          }
        }
        .listRowSeparator(.hidden)
      }

      if failed, !answersInSheet {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't save. Try again.", table: "Today", comment: "A change couldn't be saved")
        )
        .typeStyle(.note)
      }
    }
    .onChange(of: shown.decision) {
      // The buttons leave with the answer, so VoiceOver lands on what it did.
      isResultFocused = shown.decision != nil
    }
  }

  private var words: PlanChangeWords.Words {
    PlanChangeWords.words(
      kind: change.kind, source: change.source, status: change.status,
      operations: change.operations, reason: change.reason, effect: change.effect,
      dateKind: GoalDateKind(isExam: isExam))
  }

  /// The question; a focus the Focus test proposes keeps the test's own words (lane A's).
  private var title: String {
    if change.source == "focusTest", let areas = change.operations.first?.areas, !areas.isEmpty {
      return String(
        localized: "Your Focus test suggests more time for \(areas.formatted(.list(type: .and))).",
        table: "Today", comment: "A focus the learner's Focus test answers propose; then subjects")
    }

    return words.title
  }

  @ViewBuilder
  private var proposal: some View {
    let today = view.session.localDate

    VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .typeStyle(.body.weight(.semibold))
        .foregroundStyle(Color(.foreground))

      if change.source != "focusTest", let why = words.why {
        Text(why)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      }
    }

    PlanEffectDiff(
      effect: change.effect, today: today,
      options: PlanChangeOptions(
        byDate: view.goal.targetDate != nil, dateKind: GoalDateKind(isExam: isExam)),
      repriced: shown.repriced)

    if let date = change.officialDate?.date {
      Text(
        "The official exam date is \(PlanDate.longDay(date, today: today)).", tableName: "Today",
        comment: "Under a change that moves the exam off its official date; the argument is a day"
      )
      .typeStyle(.note.weight(.medium))
    }

    ButtonRow {
      Button {
        answer(.declined)
      } label: {
        declineLabel
      }
      .buttonStyle(.outline)

      if change.canApply {
        Button {
          answer(.applied)
        } label: {
          applyLabel
        }
        .buttonStyle(.mainAction)
        .buttonSizing(.flexible)
      }
    }
    .disabled(isSaving)

    if failed {
      SuggestionSaveError()
    }
  }

  /// The official guide's or phase dates' change keeps what the learner has.
  private var keepsMine: Bool {
    change.source == "notice" || change.source == "phaseDates"
  }

  private var applyLabel: Text {
    if change.officialDate != nil {
      return Text(
        "Use my date", tableName: "Today",
        comment: "Applies a change that moves the exam off its official date")
    }

    return change.source == "focusTest"
      ? Text(FocusTestCopy.updatePlan)
      : Text("Change my plan", tableName: "Today", comment: "Applies a proposed plan change")
  }

  private var declineLabel: Text {
    if change.officialDate != nil {
      return Text(
        "Keep official date", tableName: "Today",
        comment: "Declines a change and keeps the exam's official date")
    }

    if change.source == "focusTest" {
      return Text(FocusTestCopy.notNow)
    }

    return keepsMine
      ? Text("Keep mine", tableName: "Today", comment: "Declines a change and keeps the plan's own")
      : Text("Not now", tableName: "Today", comment: "Declines a proposed plan change")
  }

  // MARK: Missed days (C-43)

  @ViewBuilder
  private func missedDays(_ behind: TodayView.PlanChange.Behind) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("You missed a few days", tableName: "Today", comment: "Title after missed study days")
        .typeStyle(.body.weight(.semibold))

      Text(behindSentence(behind))
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    }

    ButtonRow {
      // On a return after a break, nothing that asks for more hours leads.
      if view.session.freshStart == .welcomeBack {
        keepTimeButton
        addTimeButton
      } else {
        addTimeButton
        keepTimeButton
      }
    }
    .disabled(isSaving)

    Menu {
      if behind.canFocus {
        Button {
          adjust(.focus)
        } label: {
          Text(
            "Choose where to focus", tableName: "Today",
            comment: "Opens the choice of the plan's areas to focus on")
        }
      }

      Button {
        adjust(.everything)
      } label: {
        isExam
          ? Text(
            "Keep studying after the exam", tableName: "Today",
            comment: "Opens studying every topic, past the exam's date")
          : Text("Study everything", tableName: "Today", comment: "Opens studying the whole goal")
      }
    } label: {
      Text("More options", tableName: "Today", comment: "Opens the other answers to missed days")
        .typeStyle(.note.weight(.medium))
    }
    .disabled(isSaving)
  }

  private var addTimeButton: some View {
    Button {
      adjust(isExam ? .time : .date)
    } label: {
      Text("Add time", tableName: "Today", comment: "Opens the plan's time a day after missed days")
    }
    .buttonStyle(.outline)
  }

  private var keepTimeButton: some View {
    Button {
      answer(.seen)
    } label: {
      Text(
        "Keep my time", tableName: "Today",
        comment: "Keeps the time a day after missed days, with less of the plan covered")
    }
    .buttonStyle(.outline)
  }

  private func behindSentence(_ behind: TodayView.PlanChange.Behind) -> String {
    let time = studyDuration(minutes: behind.currentMinutes)
    let after = behind.coveredAfter.formatted(.percent.precision(.fractionLength(0)))
    let before = behind.coveredBefore.formatted(.percent.precision(.fractionLength(0)))

    return behind.measure == "exam"
      ? String(
        localized: "\(time) a day now covers \(after) of the exam, down from \(before).",
        table: "Today", comment: "Missed days left an exam plan covering less")
      : String(
        localized: "\(time) a day now covers \(after) of your goal, down from \(before).",
        table: "Today", comment: "Missed days left a plan covering less of its goal")
  }

  private func result(_ decision: PlanChangeDecision) -> String {
    switch decision {
    case .applied:
      PlanChangeWords.appliedLine(todaySession: change.todaySession)
    case .declined:
      String(
        localized: "Your plan stays as it was.", table: "Today",
        comment: "A plan change was declined")
    case .undone:
      String(
        localized: "Undone. Your plan is back as it was.", table: "Today",
        comment: "A plan change was undone")
    case .seen:
      String(
        localized: "Okay. Your time stays the same.", table: "Today",
        comment: "The learner kept their time a day after missed days")
    }
  }
}

/// Today's missions: the header, and the missions behind a press on its title (B1-002).
struct TodayMissionsSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner

  @State private var showsMissions = false

  let view: TodayView
  let busy: TodayDayView.Tap?
  let failed: TodayDayView.Tap?
  let open: (StudyBlock) -> Void

  private var missions: [StudyMission] { view.session.missions }

  var body: some View {
    let earned = view.session.fullMeal.earned

    PageSection(isPanel: true) {
      MissionsSummary(
        missions: missions, bonus: view.session.fullMeal.bonus, earned: earned,
        isOpen: $showsMissions
      )
      .rowSeparatorHiddenBelow()

      if !earned, showsMissions {
        ForEach(Array(missions.enumerated()), id: \.offset) { _, mission in
          let block = view.session.blocks.first { mission.opens($0) }
          let tap = block.map { TodayDayView.Tap.mission($0.position) }

          MissionRow(
            mission: mission, buddyName: learner.buddyDisplayName,
            isBusy: tap != nil && busy == tap, failed: tap != nil && failed == tap
          ) {
            go(mission)
          }
          .disabled(busy != nil && busy != tap)
        }
      }
    } header: {
      EmptyView()
    }
  }

  /// A place of its own saves the day itself on its first answer (core's `saveDayBeforeActivity`).
  private func go(_ mission: StudyMission) {
    guard let opens = mission.opens else {
      return
    }

    switch opens.kind {
    case "block":
      if let block = view.session.blocks.first(where: { mission.opens($0) }) {
        open(block)
      }
    case "mistakesPractice":
      router.open(.mistakePractice())
    case "pattern":
      if let patternID = opens.patternId {
        router.open(.pattern(patternId: patternID))
      }
    case "pronunciation":
      router.open(.pronunciation(goalId: view.goal.id))
    case "call":
      if let chapterID = opens.chapterId {
        router.open(.languageUnit(chapterId: chapterID))
      }
    case "buddy":
      router.select(.buddy)
    case "mockChooser":
      router.open(.mockChooser)
    case "areaPractice":
      if let areaID = opens.areaId {
        router.open(.chapter(chapterId: areaID))
      }
    default:
      router.select(.plan)
    }
  }
}

struct TodayWeekSection: View {
  let view: TodayView

  private var week: StudyWeek { view.session.week }

  private var title: Text {
    Text("This week", tableName: "Today", comment: "The week's header")
  }

  var body: some View {
    // Main's `useWeekDate`: the week marks the current day even while a lesson carries the
    // previous day's session.
    let localDate = week.days.first(where: \.isToday)?.date ?? view.session.localDate

    PageSection {
      HStack {
        ForEach(week.days, id: \.date) { day in
          WeekDayMark(
            day: day, localDate: localDate,
            challenge: view.weeklyChallenge.flatMap { $0.date == day.date ? $0 : nil },
            isExam: view.goal.kind == .exam
          )
        }
      }
      .dynamicTypeSize(...DynamicTypeSize.accessibility1)
      .padding(.vertical, 4)

      // A challenge in a later week waits for its week: the Plan says when the next one is.
      if let challenge = view.weeklyChallenge, let dateText = challenge.date,
        week.days.contains(where: { $0.date == dateText }), let date = studyDate(dateText)
      {
        WeekChallengeRow(challenge: challenge, date: date)
      }
    } header: {
      SectionTitle(title)
    }
  }
}

/// A mock the learner's plan doesn't include leaves its day to a full review of every topic; one the
/// plan adds only once the day opens has nothing to open yet.
private struct WeekChallengeRow: View {
  @Environment(AppRouter.self) private var router

  let challenge: TodayView.WeeklyChallenge
  let date: Date

  private var day: String { date.formatted(.studyDay.weekday(.wide)) }

  var body: some View {
    if challenge.kind == "mock" && challenge.requiresPlus {
      Label {
        VStack(alignment: .leading, spacing: 2) {
          Text("Review", tableName: "Today", comment: "A review block")
          Text(
            "\(day)\u{00A0}· every topic", tableName: "Today",
            comment: "When a review of every topic is; the argument is a weekday"
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }
      } icon: {
        KindMark(kind: .review)
      }
    } else if let planItemID = challenge.planItemId {
      Button {
        router.open(.challenge(planItemId: planItemID))
      } label: {
        label
      }
      .tint(.primary)
    } else {
      label
    }
  }

  private var label: some View {
    Label {
      VStack(alignment: .leading, spacing: 2) {
        challenge.kind == "mock"
          ? Text("Mock exam", tableName: "Today", comment: "The week's mock")
          : Text("Weekly challenge", tableName: "Today", comment: "The week's challenge")
        Text(facts)
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
      }
    } icon: {
      KindMark(kind: challenge.kind == "mock" ? .mock : .challenge)
    }
  }

  private var facts: String {
    var parts = [day]

    if let questions = challenge.questions, questions > 0 {
      parts.append(
        String(
          localized: "\(questions) questions", table: "Today",
          comment: "How many questions the week's challenge asks"))
    }

    if let minutes = challenge.timeLimitMinutes {
      parts.append(studyDuration(minutes: minutes))
    }

    return parts.joinedFacts()
  }
}

private struct WeekDayMark: View {
  let day: StudyWeek.Day
  let localDate: String
  /// The week's challenge, when it falls on this day.
  let challenge: TodayView.WeeklyChallenge?
  let isExam: Bool

  @ScaledMetric(relativeTo: .title3) private var ringSize = 26.0
  @State private var isShown = false

  var body: some View {
    let date = studyDate(day.date)
    let weekday = date?.formatted(.studyDay.weekday(.wide)) ?? day.date

    Button {
      isShown = true
    } label: {
      VStack(spacing: 4) {
        ring
          .frame(width: ringSize, height: ringSize)

        Text(date?.formatted(.studyDay.weekday(.narrow)) ?? "")
          .typeStyle(.small.weight(day.isToday ? .bold : .regular))
          .foregroundStyle(day.isToday ? Color(.foreground) : .mutedForeground)
      }
      .frame(maxWidth: .infinity)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label(weekday: weekday))
    .popover(isPresented: $isShown, arrowEdge: .top) {
      TodayFactsPopover(
        title: weekday.labelCased(), facts: time, factsStyle: Color(.foreground), note: note,
        challenge: challengeLine)
    }
  }

  /// Main's `useDayTime`.
  private var time: String? {
    if day.minutes > 0 {
      return day.goalMinutes > 0
        ? String(
          localized:
            "\(studyDuration(minutes: day.minutes)) of \(studyDuration(minutes: day.goalMinutes)) studied",
          table: "Today", comment: "A day's time studied of the time its plan gave it")
        : String(
          localized: "\(studyDuration(minutes: day.minutes)) studied", table: "Today",
          comment: "Time studied on a day; the argument is a duration like '23 min'")
    }

    return day.goalMinutes > 0
      ? String(
        localized: "\(studyDuration(minutes: day.goalMinutes)) planned", table: "Today",
        comment: "The time a day's plan gives it, on a day not studied yet")
      : nil
  }

  private var challengeLine: (kind: LearnKind, name: String)? {
    guard let challengeKind, let challengeName else {
      return nil
    }

    return (challengeKind, challengeName.labelCased())
  }

  /// Main's `useDayNote`: the day's status, unless its time already says it.
  private var note: String? {
    let saidByTime =
      !day.hitGoal && (day.minutes > 0 || (day.goalMinutes > 0 && day.kind == "study" && !isMissed))
    return saidByTime ? nil : status.labelCased()
  }

  /// Main's `DayRing`: a dash for a day outside the plan.
  @ViewBuilder
  private var ring: some View {
    if !day.studied && (day.kind == "beforeStart" || day.kind == "afterEnd") && !day.isToday {
      Image(systemName: "minus")
        .foregroundStyle(Color(.foreground).opacity(0.2))
    } else {
      GoalRing(share: day.share, track: track, size: ringSize) {
        mark
      }
    }
  }

  @ViewBuilder
  private var mark: some View {
    if day.hitGoal {
      Image(systemName: "checkmark")
        .foregroundStyle(.success)
    } else if !day.studied && (day.kind == "exam" || day.kind == "deadline") {
      Image(systemName: "graduationcap")
        .foregroundStyle(.primary)
    } else if let kind = challengeKind, day.share == 0 {
      KindMark(kind: kind)
    }
  }

  private var isMissed: Bool {
    day.kind == "study" && !day.studied && !day.isToday && day.date < localDate
  }

  private var track: GoalRingTrack {
    if day.isToday {
      return .today
    }

    if isMissed {
      return .missed
    }

    return day.kind == "rest" ? .rest : .standard
  }

  /// A mock the learner's plan doesn't include leaves its day to a full review of every topic.
  private var challengeKind: LearnKind? {
    guard let challenge else {
      return nil
    }

    if challenge.kind == "mock" {
      return challenge.requiresPlus ? .review : .mock
    }

    return .challenge
  }

  private func label(weekday: String) -> Text {
    guard let challengeName else {
      return Text(
        "\(weekday): \(status)", tableName: "Today",
        comment: "A day of the week, then how it went or the challenge it holds")
    }

    return day.date > localDate
      ? Text(
        "\(weekday): \(challengeName)", tableName: "Today",
        comment: "A day of the week, then how it went or the challenge it holds")
      : Text(
        "\(weekday): \(challengeName), \(status)", tableName: "Today",
        comment: "A day of the week, the challenge it holds, such as a mock exam, and how it went")
  }

  private var challengeName: String? {
    switch challengeKind {
    case .review:
      String(
        localized: "review", table: "Today",
        comment: "A day's challenge in a spoken day label: a review of every topic")
    case .mock:
      String(
        localized: "mock exam", table: "Today", comment: "A day's challenge in a spoken day label")
    case .challenge:
      String(
        localized: "weekly challenge", table: "Today",
        comment: "A day's challenge in a spoken day label")
    default:
      nil
    }
  }

  private var status: String {
    if day.hitGoal {
      return String(
        localized: "done", table: "Today",
        comment: "A day's status: the day's study time was met")
    }

    if day.studied {
      return String(localized: "studied", table: "Today", comment: "A day's status")
    }

    switch day.kind {
    case "exam":
      return String(localized: "exam day", table: "Today", comment: "A day's status")
    case "deadline":
      return String(localized: "end date", table: "Today", comment: "A day's status")
    case "beforeStart":
      return String(localized: "before your plan", table: "Today", comment: "A day's status")
    case "afterEnd":
      return isExam
        ? String(localized: "after your exam", table: "Today", comment: "A day's status")
        : String(localized: "after your end date", table: "Today", comment: "A day's status")
    case "rest":
      return String(localized: "rest day", table: "Today", comment: "A day's status")
    default:
      break
    }

    if day.isToday {
      return String(localized: "today", table: "Today", comment: "A day's status")
    }

    return day.date > localDate
      ? String(localized: "planned", table: "Today", comment: "A day's status")
      : String(localized: "not studied", table: "Today", comment: "A day's status")
  }
}

struct TodayProgressSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var plans

  let view: TodayView

  var body: some View {
    if view.goal.kind == .language {
      let standing = plans.languageStanding(goalId: view.goal.id)

      card(
        title: Text("Level", tableName: "Today", comment: "Title of a language goal's level card"),
        value: standing.value?.levelText, detail: nil
      ) {
        EmptyView()
      }
      .loads(standing, refreshable: false)
    } else if let progress = view.progress {
      let syllabus = plans.syllabus(goalId: view.goal.id)

      Group {
        if progress.measure == "preparation" {
          card(
            title: Text(
              "Preparation", tableName: "Today", comment: "Title of an exam's preparation card"),
            value: progress.value.formatted(.percent.precision(.fractionLength(0))),
            detail: weekGain(progress.weekGain ?? 0)
          ) {
            EmptyView()
          }
        } else if let lessons = progress.lessons {
          card(
            title: Text(
              "Progress", tableName: "Today", comment: "Title of the goal's progress card"),
            value: goalProgressPercent(progress.value),
            // Until the syllabus says what was known, known lessons would read as studied.
            detail: syllabus.value.map { studied(lessons, known: $0.lessons.known) }
          ) {
            if lessons.total > 0 {
              MeterParts(parts: parts(lessons, known: syllabus.value?.lessons.known ?? 0))
                .frame(height: 6)
                .accessibilityHidden(true)
            }
          }
        }
      }
      .loads(syllabus, refreshable: false)
    }
  }

  private func card(
    title: Text, value: String?, detail: Text?, @ViewBuilder content: () -> some View
  ) -> some View {
    PageSection {
      Button {
        router.select(.plan)
      } label: {
        VStack(alignment: .leading, spacing: 10) {
          VStack(alignment: .leading, spacing: 2) {
            if let value {
              Text(value)
                .typeStyle(.readout)
            }

            if let detail {
              detail
                .typeStyle(.note)
                .foregroundStyle(.mutedForeground)
            }
          }

          content()

          Label {
            Text("See your plan", tableName: "Today", comment: "Opens the Plan")
          } icon: {
            Image(systemName: "chevron.right")
          }
          .labelStyle(.titleOnly)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(.rect)
      }
      .tint(.primary)
    } header: {
      SectionTitle(title)
    }
  }

  /// Only what was studied: a long plan never leads with its thousand lessons, and what the
  /// learner already knew stays in the number and the bars.
  private func studied(_ lessons: TodayView.Progress.Lessons, known: Int) -> Text {
    let studied = lessons.done - min(lessons.done, known)

    return studied == 0
      ? Text(
        "No lessons studied yet", tableName: "Today",
        comment: "Under the goal's progress, before any lesson is studied")
      : Text(
        "\(studied) lessons studied", tableName: "Today",
        comment: "Lessons studied, under the goal's progress")
  }

  private func parts(_ lessons: TodayView.Progress.Lessons, known: Int) -> [MeterParts.Part] {
    let known = min(lessons.done, known)
    let today = min(lessons.today, max(0, lessons.total - lessons.done))
    let rest = max(0, lessons.total - lessons.done - today)

    return [
      MeterParts.Part(weight: Double(lessons.done - known), fill: .color(.success)),
      MeterParts.Part(weight: Double(known), fill: .color(.mutedForeground)),
      MeterParts.Part(weight: Double(today), fill: .current),
      MeterParts.Part(weight: Double(rest), fill: .track),
    ].filter { $0.weight > 0 }
  }

  /// Nothing in a week without a whole point either way.
  private func weekGain(_ gain: Double) -> Text? {
    let points = Int((gain * 100).rounded())

    if points == 0 {
      return nil
    }

    return points > 0
      ? Text("+\(points) this week", tableName: "Today", comment: "Preparation gained this week")
        .foregroundStyle(.successText)
      : Text("\(points) this week", tableName: "Today", comment: "Preparation lost this week")
  }
}

struct TodayPracticeSection: View {
  @Environment(ExamStore.self) private var exam
  @Environment(LearnerSummaryStore.self) private var learner

  let view: TodayView
  let language: LanguageTodayView?

  var body: some View {
    let places = learner.summary.value?.places

    PageSection {
      if places?.exam == true {
        TodayMockRow(options: exam.mockOptions(goalId: view.goal.id))
      }

      if let speaking = language?.speaking {
        PageLink(route: .speaking) {
          HStack {
            Label {
              VStack(alignment: .leading, spacing: 2) {
                Text(
                  "Exam-style speaking", tableName: "Today",
                  comment: "Opens the exam's speaking tasks")
                Text(
                  "\(speaking.title) tasks on a call", tableName: "Today",
                  comment:
                    "The speaking paper's exam and level, as in B1 Preliminary tasks on a call"
                )
                .typeStyle(.note)
                .foregroundStyle(.mutedForeground)
              }
            } icon: {
              KindMark(kind: .conversation)
            }

          }
        }
      }

      PageLink(route: .mistakes) {
        IconLabeledContent {
          if let ready = places?.readyMistakes, ready > 0 {
            Text(ready, format: .number)
              .monospacedDigit()
          }
        } title: {
          VStack(alignment: .leading, spacing: 2) {
            Text("Mistakes notebook", tableName: "Today", comment: "Opens the mistakes notebook")
            Text("Redo what you got wrong", tableName: "Today", comment: "The notebook's line")
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
        } icon: {
          KindMark(kind: .mistakes)
        }
      }

      if places?.completedLessons == true {
        PageLink(route: .completedLessons) {
          Label {
            Text(
              "Completed lessons", tableName: "Today",
              comment: "Opens the page of the lessons the learner finished")
          } icon: {
            KindMark(kind: .lesson)
          }
        }
      }
    } header: {
      SectionTitle(Text("Practice anytime", tableName: "Today", comment: "Practice section header"))
    }
  }
}

/// Main's `LanguagePracticeRow`: words to say again first, else the pattern noticed in recent
/// mistakes.
struct TodayLanguagePracticeSection: View {
  @Environment(AppRouter.self) private var router

  let view: TodayView
  let language: LanguageTodayView?

  var body: some View {
    if let pronunciation = language?.pronunciation {
      notice(
        title: Text(
          "Say \(pronunciation.count) words again", tableName: "Today",
          comment: "Mispronounced words due to be said again today"),
        detail: Text(pronunciation.words.formatted(.list(type: .and))), systemImage: "mic",
        action: Text(
          "Say them", tableName: "Today",
          comment: "Opens the words to say aloud again; \"them\" is the words")
      ) {
        router.open(.pronunciation(goalId: view.goal.id))
      }
    } else if let pattern = view.pattern {
      if pattern.kind == "typos" {
        notice(
          title: Text("Just typos", tableName: "Today", comment: "Recent mistakes were slips"),
          detail: Text(
            "Your recent mistakes were slips, not a rule to learn.", tableName: "Today",
            comment: "Explains a pattern of typos"),
          systemImage: "keyboard",
          action: Text("Open", tableName: "Today", comment: "Opens the noticed typos")
        ) {
          router.open(.pattern(patternId: pattern.id))
        }
      } else {
        notice(
          title: Text(
            "We noticed a pattern", tableName: "Today",
            comment: "A rule the learner keeps getting wrong, noticed in recent mistakes"),
          detail: Text(pattern.title), systemImage: "sparkles",
          action: Text("Practice it", tableName: "Today", comment: "Opens the noticed pattern")
        ) {
          router.open(.pattern(patternId: pattern.id))
        }
      }
    }
  }

  private func notice(
    title: Text, detail: Text, systemImage: String, action: Text, open: @escaping () -> Void
  ) -> some View {
    Section {
      Label {
        VStack(alignment: .leading, spacing: 2) {
          title
          detail
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      } icon: {
        Image(systemName: systemImage)
          .foregroundStyle(.tint)
      }
      .accessibilityElement(children: .combine)

      Button(action: open) {
        action
      }
    }
  }
}

/// Main's `MockEntryRow`: a running mock first, and no row once the exam offers none.
private struct TodayMockRow: View {
  @Environment(AppRouter.self) private var router

  let options: Resource<MockOptions>

  var body: some View {
    let value = options.value

    if value?.offersMock != false {
      row(value)
        .loads(options, refreshable: false)
    }
  }

  @ViewBuilder
  private func row(_ value: MockOptions?) -> some View {
    if let running = value?.running {
      Button {
        router.open(.mock(blockId: running.id))
      } label: {
        label(
          title: Text("Continue your mock exam", tableName: "Today", comment: "A running mock"),
          detail: Text(
            "It's where you left it", tableName: "Today", comment: "Under a running mock"))
      }
      .tint(.primary)
    } else {
      NavigationLink(value: AppRoute.mockChooser) {
        label(
          title: Text("Take a mock exam", tableName: "Today", comment: "Opens the mock chooser"),
          detail: value.map(description))
      }
    }
  }

  private func label(title: Text, detail: Text?) -> some View {
    Label {
      VStack(alignment: .leading, spacing: 2) {
        title

        if let detail {
          detail
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      }
    } icon: {
      KindMark(kind: .mock)
    }
  }

  private func description(_ value: MockOptions) -> Text {
    value.options.contains { $0.kind == .area }
      ? Text(
        "Whenever you want: a full exam day, half a day or one subject", tableName: "Today",
        comment: "When and how long the learner's mock exams can be, by subject too")
      : Text(
        "Whenever you want: a full exam day or half a day", tableName: "Today",
        comment: "When and how long the learner's mock exams can be")
  }
}
