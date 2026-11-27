import SwiftUI

/// Being done for the day, resting, or waiting on a mock never hides what comes next. Its first lesson and Keep
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
          .currentRow(view.session.nextBlock == nil)

          if view.session.nextBlock != nil, failed == .upNextLesson {
            FailureLine(
              message: LocalizedStringResource(
                "We couldn't open the next step. Try again.", table: "Today"))
          }
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

          // While extras wait, Continue is the day's action.
          if state == .done && view.session.nextBlock == nil && view.session.extraTime.available {
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
      studyDate(dateText) != nil
    {
      let day = PlanDate.weekdayName(dateText)

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
/// the goal's date at risk with their choices.
struct TodayPlanChangeSection: View {
  @AccessibilityFocusState private var isResultFocused: Bool
  /// A missed-days choice that opens the Plan editor once the sheet it was made in has closed.
  @State private var chosen: MissedDaysChoices.Option?

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

  /// The answers are in the sheet, so while it's open a failed answer shows there, beside them; the
  /// page keeps it for Undo.
  private var answersInSheet: Bool { isOpen && shown.decision == nil }

  var body: some View {
    if change.kind == "testedOut",
      shown.decision == .undone || (change.status == "applied" && change.canUndo)
    {
      TestedOutChangeCard(
        change: change, today: view.session.localDate, isUndone: shown.decision == .undone,
        isSaving: isSaving, failed: failed
      ) {
        answer(.undone)
      }
    } else {
      standardChange
    }
  }

  private var standardChange: some View {
    Section {
      if let decision = shown.decision {
        SuggestionLine {
          StatusMark(status: .done)
        } summary: {
          SuggestionResult(text: result(decision))
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
      } else if change.kind == "noticeChanged" {
        followsGuide
      } else if isBehind, let behind = change.behind {
        missedDays(behind)
      } else {
        SuggestionLine {
          SuggestionMark(kind: change.source == "notice" ? .symbol("doc.badge.clock") : .sparkle)
        } summary: {
          Text(title)
        } action: {
          SuggestionOpen(
            isOpen: $isOpen, note: failed ? BarNote(SuggestionSaveError.message) : nil
          ) {
            proposal
          } actions: {
            proposalAnswers
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
      dateKind: GoalDateKind(isExam: isExam), lessonsSkipped: change.lessonsSkipped)
  }

  /// The question; a focus the Focus test proposes keeps the test's own words.
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
      SuggestionHeader(Text(title))

      if change.source != "focusTest", let why = words.why {
        SuggestionDescription(Text(why))
      }
    }

    PlanEffectDiff(
      effect: change.effect, today: today,
      options: PlanChangeOptions(
        byDate: view.goal.targetDate != nil, dateKind: GoalDateKind(isExam: isExam)),
      repriced: shown.repriced)

    if let date = change.officialDate?.date {
      SuggestionDescription(
        Text(
          "The official exam date is \(PlanDate.longDay(date, today: today)).", tableName: "Today",
          comment: "Under a change that moves the exam off its official date; the argument is a day"
        ))
    }

  }

  @ViewBuilder
  private var proposalAnswers: some View {
    Button {
      answer(.declined)
    } label: {
      declineLabel
    }
    .buttonStyle(.outline)
    .disabled(isSaving)

    if change.canApply {
      Button {
        answer(.applied)
      } label: {
        applyLabel
      }
      .buttonStyle(.mainAction)
      .disabled(isSaving)
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

  /// A change the plan made that the learner answers on Today itself: its title, one sentence and
  /// its answers under them, small, as main's suggestion panel draws them.
  private func statement<Answers: View>(
    title: Text, sentence: String?, @ViewBuilder answers: () -> Answers
  ) -> some View {
    TodaySuggestionCard {
      VStack(alignment: .leading, spacing: 4) {
        SuggestionHeader(title)

        if let sentence {
          SuggestionDescription(Text(sentence))
        }
      }

      ButtonRow(wraps: true) {
        answers()
      }
      .controlSize(.small)
      .disabled(isSaving)
    }
  }

  // MARK: Missed days

  private var missedDaysTitle: Text {
    Text("You missed a few days", tableName: "Today", comment: "Title after missed study days")
  }

  /// Main's card: what happened and why, with what changes and the choices in its sheet.
  @ViewBuilder
  private func missedDays(_ behind: TodayView.PlanChange.Behind) -> some View {
    TodaySuggestionCard(mark: .symbol("calendar.badge.clock")) {
      VStack(alignment: .leading, spacing: 4) {
        SuggestionHeader(missedDaysTitle)
        SuggestionDescription(Text(behindSentence))
      }

      missedDaysOpen(behind)
    }
  }

  // MARK: The official guide

  /// Done without a tap, so it says what left and only takes "Got it".
  private var followsGuide: some View {
    statement(
      title: change.examDocument == .notice
        ? Text(
          LocalizedStringResource(
            "planFollowsNotice", defaultValue: "Your plan now follows the official guide",
            table: "Today",
            comment:
              "Title once the plan changed by itself to follow the exam's public notice, the document that lists its subjects"
          ))
        : Text(
          "Your plan now follows the official guide", tableName: "Today",
          comment:
            "Title once the plan changed by itself to follow the official guide of a language certificate"
        ),
      sentence: noticeRemovedSentence(change.effect?.noticeRemoved ?? [])
    ) {
      BusyButton(isBusy: isSaving) {
        answer(.seen)
      } label: {
        Text("Got it", tableName: "Today")
      }
      .buttonStyle(.outline)
    }
  }

  private func missedDaysOpen(_ behind: TodayView.PlanChange.Behind) -> some View {
    SuggestionOpen(
      isOpen: $isOpen, note: failed ? BarNote(SuggestionSaveError.message) : nil,
      label: Text("See what changes", tableName: "Today"), onDismiss: openChosen
    ) {
      SuggestionHeader(missedDaysTitle)

      PlanEffectDiff(
        effect: change.effect, today: view.session.localDate,
        options: PlanChangeOptions(dateKind: GoalDateKind(isExam: isExam)))
    } actions: {
      missedDaysChoices(behind)
    }
  }

  @ViewBuilder
  private func missedDaysChoices(_ behind: TodayView.PlanChange.Behind) -> some View {
    let choices = MissedDaysChoices(
      canFocus: behind.canFocus, isReturn: view.session.freshStart == .welcomeBack)

    // Sharing a row with the main action, which takes the room they leave, their words stay whole.
    PlanOtherOptions {
      ForEach(choices.others, id: \.self) { option in
        Button {
          choose(option)
        } label: {
          label(option)
        }
      }
    }
    .buttonStyle(.outline)
    .layoutPriority(1)

    Button {
      answer(.seen)
    } label: {
      Text(
        "Keep my time", tableName: "Today",
        comment: "Keeps the time a day after missed days, with less of the plan covered")
    }
    .buttonStyle(.outline)
    .disabled(isSaving)
    .layoutPriority(1)

    if let lead = choices.lead {
      Button {
        choose(lead)
      } label: {
        label(lead)
      }
      .buttonStyle(.mainAction)
    }
  }

  /// The Plan editor opens over Today once this sheet has closed: a sheet can't open from Today
  /// while another is still up.
  private func choose(_ option: MissedDaysChoices.Option) {
    chosen = option
    isOpen = false
  }

  private func openChosen() {
    guard let option = chosen else {
      return
    }

    chosen = nil
    adjust(option.section)
  }

  private func label(_ option: MissedDaysChoices.Option) -> Text {
    switch option {
    case .adjustTime:
      isExam
        ? Text(
          "Add time", tableName: "Today", comment: "Opens the plan's time a day after missed days")
        : Text(
          "Adjust plan", tableName: "Plan", comment: "Opens the plan's settings to change them")
    case .focus:
      Text(
        "Choose where to focus", tableName: "Today",
        comment: "Opens the choice of the plan's areas to focus on")
    case .studyEverything:
      isExam
        ? Text(
          "Keep studying after the exam", tableName: "Today",
          comment: "Opens studying every topic, past the exam's date")
        : Text("Remove end date", tableName: "Today")
    }
  }

  private var behindSentence: String {
    String(
      localized: "Let's fit your plan to the days left.", table: "Today",
      comment:
        "Under \"You missed a few days\": the plan has more lessons than the days left hold. Followed by a button to see the plan's changes."
    )
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

/// Main's missed-days choices. On a return after a break, nothing that asks for more hours leads.
struct MissedDaysChoices: Equatable {
  enum Option: Hashable {
    case adjustTime
    case focus
    case studyEverything

    var section: AdjustPlanSheet.Section {
      switch self {
      case .adjustTime: .time
      case .focus: .focus
      case .studyEverything: .everything
      }
    }
  }

  let lead: Option?
  /// Behind "Other options".
  let others: [Option]

  init(canFocus: Bool, isReturn: Bool) {
    let options: [Option] =
      canFocus ? [.adjustTime, .focus, .studyEverything] : [.adjustTime, .studyEverything]
    let lead: Option? = !isReturn ? .adjustTime : canFocus ? .focus : nil

    self.lead = lead
    others = options.filter { $0 != lead }
  }
}

struct TodayMissionsSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.isPaneSplit) private var isPaneSplit

  @State private var showsMissions = false

  let view: TodayView
  let busy: TodayDayView.Tap?
  let failed: TodayDayView.Tap?
  let open: (StudyBlock) -> Void

  private var missions: [StudyMission] { view.session.missions }

  var body: some View {
    let earned = view.session.fullMeal.earned
    let listed = horizontalSizeClass == .regular || isPaneSplit

    PageSection(isPanel: true) {
      MissionsSummary(
        missions: missions, bonus: view.session.fullMeal.bonus, earned: earned,
        isOpen: listed ? nil : $showsMissions
      )
      .rowSeparatorHiddenBelow()

      if !earned, listed || showsMissions {
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
      WeekDaysRow(target: 44) {
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

      if week.days.contains(where: { $0.isMissed(on: localDate) }) {
        MissedDayKey()
      }
    } header: {
      SectionTitle(title)
    }
  }
}

/// Beside the title the count stands alone, as main's; under the words, where it reads as a line
/// of its own, it says what it counts.
private struct MistakesCount: View {
  let ready: Int

  @Environment(\.stacksContent) private var isStacked

  var body: some View {
    let phrase = Text(
      "Fix \(ready) mistakes", tableName: "Today",
      comment: "Mistakes to fix: a step of the day, or how many the notebook has ready")

    if isStacked {
      phrase
        .typeStyle(.meta)
    } else {
      Text(ready, format: .number)
        .accessibilityLabel(phrase)
    }
  }
}

/// Main's key under the week: the one day drawing a reader can't guess, a missed study day.
private struct MissedDayKey: View {
  var body: some View {
    HStack(spacing: 6) {
      GoalRing(share: 0, track: .missed, size: 14) {}
        .accessibilityHidden(true)

      Text(
        String(localized: "not studied", table: "Today", comment: "A day's status").labelCased())
    }
    .typeStyle(.meta)
    .foregroundStyle(.mutedForeground)
    .rowSeparatorHiddenBelow()
  }
}

/// A mock the learner's plan doesn't include leaves its day to a full review of every topic; one the
/// plan adds only once the day opens has nothing to open yet.
private struct WeekChallengeRow: View {
  @Environment(AppRouter.self) private var router

  let challenge: TodayView.WeeklyChallenge
  let date: Date

  private var day: String { PlanDate.weekdayName(PlanDate.isoDate(date)) }

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
        FactSegments(facts)
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
      }
    } icon: {
      KindMark(kind: challenge.kind == "mock" ? .mock : .challenge)
    }
  }

  private var facts: [String] {
    var parts = [day]

    if let questions = challenge.questions, questions > 0 {
      parts.append(
        String(
          localized: "\(questions) questions", table: "Today",
          locale: .appLanguage, comment: "How many questions the week's challenge asks"))
    }

    if let minutes = challenge.timeLimitMinutes {
      parts.append(studyDuration(minutes: minutes))
    }

    return parts
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
    let weekday = PlanDate.weekdayName(day.date)

    Button {
      isShown = true
    } label: {
      VStack(spacing: 4) {
        ring
          .frame(width: ringSize, height: ringSize)
          .layoutAnchor("week-ring")

        Text(PlanDate.weekdayLetter(day.date))
          .typeStyle(.small.weight(day.isToday ? .bold : .regular))
          .foregroundStyle(day.isToday ? Color(.foreground) : .mutedForeground)
      }
      // The whole day is the target, so its tap reaches past the ring.
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .weekDayMark(width: ringSize)
    .accessibilityLabel(label(weekday: weekday))
    .popover(isPresented: $isShown, arrowEdge: .top) {
      TodayFactsPopover(
        title: weekday.labelCased(), facts: time.map { [.init(text: $0)] },
        factsStyle: Color(.foreground),
        note: note,
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

  private var ring: some View {
    WeekDayRing(day: day, localDate: localDate, size: ringSize) {
      if let kind = challengeKind, day.share == 0 {
        KindMark(kind: kind)
      }
    }
  }

  private var isMissed: Bool {
    day.isMissed(on: localDate)
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
    day.status(on: localDate, isExam: isExam)
  }
}

struct TodayProgressSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var plans
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibilityWeight

  let view: TodayView

  var body: some View {
    if view.goal.kind == .language {
      let standing = plans.languageStanding(goalId: view.goal.id)

      card(
        // A space holds the title's line until the language's level is read.
        title: Text(standing.value?.levelTitle ?? " "),
        value: standing.value?.levelValue(
          dynamicTypeSize: dynamicTypeSize, legibility: legibilityWeight),
        detail: nil
      ) {
        EmptyView()
      }
      .loads(standing, refreshable: false)
    } else if let progress = view.progress {
      if progress.measure == "preparation" {
        card(
          title: Text(
            "Preparation", tableName: "Today", comment: "Title of an exam's preparation card"),
          value: Text(
            verbatim: progress.value.formatted(
              .percent.precision(.fractionLength(0)).locale(.appLanguage))),
          detail: weekGain(progress.weekGain ?? 0)
        ) {
          EmptyView()
        }
      } else if let lessons = progress.lessons {
        card(
          title: Text(
            "Progress", tableName: "Today", comment: "Title of the goal's progress card"),
          value: Text(verbatim: goalProgressPercent(progress.value)),
          detail: nil,
          spoken: Text(
            "The share of your plan's lessons you've studied or already knew.", tableName: "Plan",
            comment: "What the goal's progress number is made of")
        ) {
          if lessons.total > 0 {
            CoverageBar(studied: Double(lessons.done) / Double(lessons.total))
          }
        }
      }
    }
  }

  private func card(
    title: Text, value: Text?, detail: Text?, spoken: Text? = nil,
    @ViewBuilder content: () -> some View
  ) -> some View {
    PageSection {
      Button {
        router.select(.plan)
      } label: {
        VStack(alignment: .leading, spacing: 10) {
          VStack(alignment: .leading, spacing: 2) {
            if let value {
              value
                .typeStyle(.readout)
            }

            if let detail {
              detail
                .typeStyle(.note)
                .foregroundStyle(.mutedForeground)
            }
          }

          content()

          // Main's: the words, then the chevron that says the card opens the Plan.
          HStack(spacing: 4) {
            Text("See plan", tableName: "Today", comment: "Opens the Plan")

            Image(systemName: "chevron.forward")
              .imageScale(.small)
              .accessibilityHidden(true)
          }
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(.rect)
      }
      .tint(.primary)
      .accessibilityValue(spoken ?? Text(verbatim: ""))
    } header: {
      SectionTitle(title)
    }
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
        ListRow(
          Text("Mistakes notebook", tableName: "Today", comment: "Opens the mistakes notebook"),
          description: Text(
            "Redo what you got wrong", tableName: "Today", comment: "The notebook's line")
        ) {
          KindMark(kind: .mistakes)
        } trailing: {
          if let ready = places?.readyMistakes, ready > 0 {
            MistakesCount(ready: ready)
          }
        }
      }

      if places?.completedLessons == true {
        PageLink(route: .completedLessons) {
          ListRow(
            Text(
              "Completed lessons", tableName: "Today",
              comment: "Opens the page of the lessons the learner finished"),
            description: Text(
              "Do a lesson again", tableName: "Today",
              comment: "The line under Completed lessons in Practice anytime.")
          ) {
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
        summary: Text(
          "Say \(pronunciation.count) words again", tableName: "Today",
          comment: "Mispronounced words due to be said again today"),
        mark: .symbol("mic"),
        action: Text(
          "Say them", tableName: "Today",
          comment: "Opens the words to say aloud again; \"them\" is the words")
      ) {
        router.open(.pronunciation(goalId: view.goal.id))
      }
    } else if let pattern = view.pattern {
      notice(
        summary: Text("We noticed a pattern: \(pattern.title)", tableName: "Today"),
        mark: .sparkle,
        action: Text("Practice it", tableName: "Today", comment: "Opens the noticed pattern")
      ) {
        router.open(.pattern(patternId: pattern.id))
      }
    }
  }

  /// Main's `PracticeNotice`: one line with its action at the end.
  private func notice(
    summary: Text, mark: SuggestionMark.Kind, action: Text, open: @escaping () -> Void
  ) -> some View {
    Section {
      SuggestionLine {
        SuggestionMark(kind: mark)
      } summary: {
        summary
      } action: {
        Button(action: open) {
          action
        }
        .buttonStyle(.outline)
        .controlSize(.small)
      }
      .listRowSeparator(.hidden)
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
    ListRow(title, description: detail) {
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

/// "Out of your plan: Língua Portuguesa, Raciocínio Lógico and Língua Inglesa": every name, since
/// nothing else says what left the plan. Nil when nothing left.
private func noticeRemovedSentence(_ names: [String]) -> String? {
  guard !names.isEmpty else {
    return nil
  }

  return String(
    localized: "Out of your plan: \(names.formatted(.list(type: .and)))",
    table: "Today",
    comment:
      "Lists every subject or topic the plan no longer holds, like \"Portuguese, Logic and English\"."
  )
}
