import SwiftUI

extension PlanPhase {
  /// Exam phases come without a name, so the app names them by what they're for.
  var title: String {
    if let name, !name.isEmpty {
      return name
    }

    switch kind {
    case .foundations:
      return String(
        localized: "Foundations", table: "Plan", comment: "Name of an exam plan's first phase")
    case .gaps:
      return String(
        localized: "Fill the gaps", table: "Plan",
        comment: "Name of an exam plan's phase that fills gaps")
    case .practice:
      return String(
        localized: "Practice", table: "Plan", comment: "Name of an exam plan's practice phase")
    case .finalStretch:
      return String(
        localized: "Final stretch", table: "Plan",
        comment: "Name of an exam plan's last phase before the exam")
    case .afterExam:
      return String(
        localized: "After the exam", table: "Plan",
        comment: "Name of the phase that goes on after the exam")
    case .learn:
      return placeName
    }
  }

  /// The phase by its place in the plan, "Phase 2".
  var placeName: String {
    String(
      localized: "Phase \(index + 1)", table: "Plan",
      locale: .appLanguage, comment: "Name of an unnamed phase by its number")
  }

  var weight: Double {
    guard let startDate, let endDate else {
      return 1
    }

    return Double(max(1, PlanDate.days(from: startDate, to: endDate) + 1))
  }
}

func planDurationText(minutes: Double) -> String {
  progressLearningTime(Int((minutes * 60).rounded()))
}

/// Main's `DailyTimeValue`: the time a day, and the weekend's when it has its own, in the same words
/// wherever the plan says it.
func dailyTimeText(_ shape: GoalPlan.WeekShape) -> (text: String, hasWeekend: Bool) {
  let weekdays = planDurationText(minutes: Double(shape.weekdays))

  guard let weekend = shape.weekend else {
    return (weekdays, false)
  }

  return (
    String(
      localized: "\(weekdays) · \(planDurationText(minutes: Double(weekend))) weekends",
      table: "Plan",
      comment:
        "A plan's time a day, then its own weekend time, like '20 min · 30 min weekends'"),
    true
  )
}

struct PlanRoadmapContent: View {
  let context: PlanContext
  let structure: GoalSyllabus?

  var body: some View {
    // Main's: one phase is the whole plan, so there's nothing to place the learner in.
    if context.plan.roadPhases.count >= 2 {
      if structure != nil {
        Button {
          context.show(.path)
        } label: {
          RoadmapCompact(context: context, opens: true)
        }
        .foregroundStyle(.primary)
      } else {
        RoadmapCompact(context: context, opens: false)
      }
    }
  }
}

/// A phase of a new plan, named by its end as everywhere else; a phase behind the learner, or one
/// still being planned, has no date.
struct RoadmapPhaseRow: View {
  let phase: PlanPhase
  let end: PhaseEnd?

  var body: some View {
    ListRow(Text(phase.title)) {
      StatusMark(status: phase.mark)
    } trailing: {
      if let end {
        PlanWhen.date(Text(verbatim: end.shown))
          .foregroundStyle(.mutedForeground)
          .accessibilityLabel(Text(verbatim: end.spoken))
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(
      phase.state == .current
        ? Text("You are here", tableName: "Plan", comment: "Spoken on the learner's current phase")
        : Text(verbatim: ""))
  }

}

/// Main's line under the roadmap: "Phase 1 of 4 · Foundations", then the phase's end.
private struct RoadmapCompact: View {
  @Environment(\.legibilityWeight) private var legibilityWeight

  let context: PlanContext
  let opens: Bool

  var body: some View {
    let phases = context.plan.roadPhases
    let currentIndex = phases.firstIndex { $0.state == .current }

    VStack(alignment: .leading, spacing: 8) {
      MeterParts(
        parts: phases.map { phase in
          MeterParts.Part(
            weight: phase.weight,
            fill: phase.state == .current
              ? .currentPhase(phase.lessonShare) : .share(phase.lessonShare))
        }, minimumWidth: 24)

      line(phases: phases, currentIndex: currentIndex)
    }
    .accessibilityElement(children: .combine)
  }

  private func line(phases: [PlanPhase], currentIndex: Int?) -> some View {
    HStack(spacing: 12) {
      if let currentIndex {
        let phase = phases[currentIndex]

        // Main's `plan-roadmap`: its value and chevron end on the edge; it has no row's label.
        RowLayout(piece: .planRoadmap) {
        } words: {
          position(phase: phase, number: currentIndex + 1, count: phases.count)
        } value: {
          if !context.isPaused, let end = context.plan.phaseEnd(phase) {
            Text(verbatim: end.line)
              .foregroundStyle(.mutedForeground)
              .accessibilityLabel(Text(verbatim: end.spoken))
          }
        }
        // Stacked at accessibility sizes too, the chevron ends the row on its edge.
        .frame(maxWidth: .infinity, alignment: .leading)
      } else if opens {
        Text(
          "\(phases.filter { $0.state == .done }.count) of \(phases.count) phases done",
          tableName: "Plan",
          comment: "Under the roadmap once no phase is current, such as after the plan's date"
        )
        .foregroundStyle(.mutedForeground)
        .frame(maxWidth: .infinity, alignment: .leading)
      }

      if opens {
        DisclosureChevron()
      }
    }
    .typeStyle(.meta)
  }

  private func position(phase: PlanPhase, number: Int, count: Int) -> Text {
    // Main's: the place leads, in the text's color; the phase's own name follows, muted.
    let place = Text(
      "Phase \(number) of \(count)", tableName: "Plan",
      comment: "The learner's phase of the plan's phases, under the roadmap"
    )
    .typeWeight(.medium, legibility: legibilityWeight)
    .foregroundStyle(Color(.foreground))

    guard phase.hasOwnName else {
      return place
    }

    let title = Text(phase.title)

    return Text(
      "\(place)\u{00A0}· \(title)", tableName: "Plan",
      comment: "The learner's phase under the roadmap: its number of the phases, then its name"
    )
    .foregroundStyle(.mutedForeground)
  }
}

/// Where a phase ends: at the end of its row, in a column of dates, "Dec 12", "~Dec 12" or "~Mar";
/// under the roadmap's bar, on its own, "Ends Dec 12" or "Ends ~Dec 12".
struct PhaseEnd: Equatable {
  let shown: String
  let line: String
  let spoken: String

  init(_ isoDate: String, estimate: Bool, month: Bool, today: String) {
    let date =
      month ? PlanDate.monthText(isoDate, today: today) : PlanDate.text(isoDate, today: today)

    guard estimate else {
      shown = date
      spoken = String(
        localized: "Ends \(date)", table: "Plan",
        comment:
          "When a phase of the plan ends, under the plan's phase bar and read aloud; the argument is a day like 'Dec 12'"
      )
      line = spoken
      return
    }

    shown = String(
      localized: "~\(date)", table: "Plan", comment: "An estimated day or month, like '~Nov 20'")

    if month {
      line = String(
        localized: LocalizedStringResource(
          "endsAboutMonthShown", defaultValue: "Ends ~\(date)", table: "Plan",
          comment:
            "Under the plan's phase bar: when the current phase ends, about; the argument is a month like 'Jan' or 'Jan 2028'"
        ))
      spoken = String(
        localized: LocalizedStringResource(
          "endsAboutMonth", defaultValue: "Ends around \(date)", table: "Plan",
          comment:
            "When a phase of the plan ends, about, read aloud; the argument is a month like 'Jan' or 'Jan 2028'"
        ))
    } else {
      line = String(
        localized: "Ends ~\(date)", table: "Plan",
        comment:
          "Under the plan's phase bar: when the current phase ends, about; the argument is a day like 'Dec 12'"
      )
      spoken = String(
        localized: "Ends around \(date)", table: "Plan",
        comment:
          "When a phase of the plan ends, about, read aloud; the argument is a day like 'Dec 12'")
    }
  }
}

extension GoalPlan {
  /// Main's `getPhaseEnd`: nothing for a phase behind the learner. A learning phase's end is an
  /// estimate while it's ahead, and while it's current with its challenge, which has no booked
  /// day, still to come. A phase that ends on its challenge's day is an estimate too, and so is
  /// every phase of a plan whose own date is one, since its phases are laid out back from it.
  func phaseEnd(_ phase: PlanPhase) -> PhaseEnd? {
    guard phase.state == .current || phase.state == .upcoming else {
      return nil
    }

    // A last phase without a day of its own ends with the plan.
    guard let lastDay = phase.untilDate else {
      guard phase.index == phases.last(where: { $0.kind != .afterExam })?.index,
        let endDate = estimate.endDate
      else {
        return nil
      }

      return PhaseEnd(endDate, estimate: true, month: isFar(endDate), today: today)
    }

    let learns = phase.kind == .learn || phase.kind == .afterExam
    let ahead = phase.state == .upcoming
    let endsOnChallenge = lastDay != phase.endDate
    let isEstimate =
      endsOnChallenge || schedule.targetDateEstimated
      || (learns && (ahead || phase.checkpoint?.state == .upcoming))

    return PhaseEnd(
      lastDay, estimate: isEstimate, month: isEstimate && ahead && isFar(lastDay), today: today)
  }

  /// When the plan finished, or the goal's date or estimated end while it's under way.
  func roadmapFinish(isExam: Bool) -> (isoDate: String, estimate: Bool, month: Bool)? {
    if !isExam, let end {
      return end.finishedOn.map { ($0, false, false) }
    }

    if let targetDate = schedule.targetDate {
      return (targetDate, schedule.targetDateEstimated, schedule.targetDateNamedMonth)
    }

    guard !isExam, let endDate = estimate.endDate else {
      return nil
    }

    return (endDate, true, isFar(endDate))
  }

  /// An estimate past six weeks from this week's start names only its month.
  private func isFar(_ isoDate: String) -> Bool {
    PlanDate.days(from: week.startDate, to: isoDate) > 42
  }
}

extension PlanPhase {
  /// A phase named "Phase 2" has no name of its own to say beside its number.
  var hasOwnName: Bool {
    kind != .learn || !(name ?? "").isEmpty
  }

  /// The day the phase is behind you: it ends with its challenge, which can come the day after its
  /// last lesson.
  var untilDate: String? {
    guard let endDate else {
      return nil
    }

    guard let challenge = checkpoint?.date, checkpoint?.state == .upcoming, challenge > endDate
    else {
      return endDate
    }

    return challenge
  }
}

struct PlanNumbersSection: View {
  @Environment(PlanStore.self) private var store
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibilityWeight

  let context: PlanContext
  let syllabus: GoalSyllabus?
  var timeShownBeside = false

  /// Main's `@2xl` container: two tiles side by side only from 42rem, where each value fits one line
  /// in every language.
  @ScaledMetric(relativeTo: .body) private var minimumWidth = 332.0

  var body: some View {
    let standing = standingNumber
    let schedule = scheduleNumber

    if standing != nil || schedule != nil {
      PageSection {
        Group {
          // Main's aside draws the numbers as stats, one under the other with no box; the page's
          // column draws them as tiles.
          if timeShownBeside {
            VStack(alignment: .leading, spacing: 24) {
              numbers(standing: standing, schedule: schedule)
            }
            .environment(\.statTileLone, true)
          } else {
            StatTileGrid(columns: [2, 1], minimumWidth: minimumWidth) {
              numbers(standing: standing, schedule: schedule)
            }
          }
        }
        .buttonStyle(.plain)
        .environment(\.statTileTitled, true)
      } header: {
        EmptyView()
      }
      // Main's numbers and the suggestion under them share one block, a row's room apart.
      .listSectionSpacing(0)
    }
  }

  @ViewBuilder
  private func numbers(standing: PlanNumber?, schedule: PlanNumber?) -> some View {
    if let standing {
      tile(standing) { context.show(.standing) }
    }

    if let schedule {
      tile(schedule) { context.show(.schedule) }
    }
  }

  /// Main's plan tiles: a stat tile's label and readout, a meter for a share, and the line under it.
  private func tile(_ number: PlanNumber, open: @escaping () -> Void) -> some View {
    Button(action: open) {
      StatTile(
        label: Text(number.label),
        value: number.value,
        icon: { EmptyView() },
        detail: number.detail.map {
          Text($0).foregroundStyle(
            number.detailIsGain ? AnyShapeStyle(.successText) : AnyShapeStyle(.mutedForeground))
        },
        meter: number.share,
        meterFill: .success,
        spokenValue: number.spokenValue ?? number.value
      )
      .contentShape(.rect)
    }
    .accessibilityAddTraits(.isButton)
  }

  private var standingNumber: PlanNumber? {
    if context.goal.kind == .exam {
      guard let preparation = store.standing(goalId: context.goal.id).value?.preparation else {
        return nil
      }

      let points = Int((preparation.weekGain * 100).rounded())

      return PlanNumber(
        label: String(
          localized: "Preparation", table: "Plan", comment: "Label of the exam preparation number"),
        value: Text(
          verbatim: preparation.value.formatted(
            .percent.precision(.fractionLength(0)).locale(.appLanguage))),
        detail: points == 0
          ? nil
          : points > 0
            ? String(
              localized: "+\(points) this week", table: "Plan",
              locale: .appLanguage, comment: "Preparation points gained this week")
            : String(
              localized: "\(points) this week", table: "Plan",
              locale: .appLanguage, comment: "Preparation points lost this week"),
        detailIsGain: points > 0, share: preparation.value)
    }

    if context.goal.kind == .language {
      guard let language = store.languageStanding(goalId: context.goal.id).value else {
        return nil
      }

      if let assessment = context.plan.placementTest?.languageResult {
        let facts = PlacementTestCopy.rangeFacts(assessment.skillRanges)
        return PlanNumber(
          label: language.levelTitle,
          value: Text(verbatim: language.levelText(ranges: facts)),
          spokenValue: facts.isEmpty ? nil : Text(verbatim: facts.joined(separator: " · ")))
      }

      return PlanNumber(
        label: language.levelTitle,
        value: language.levelValue(dynamicTypeSize: dynamicTypeSize, legibility: legibilityWeight))
    }

    guard context.goal.kind == .learn, let lessons = syllabus?.lessons else {
      return nil
    }

    let share = lessons.total > 0 ? min(1, Double(lessons.done) / Double(lessons.total)) : 0

    return PlanNumber(
      label: String(
        localized: "Progress", table: "Plan", comment: "Label of the goal's progress number"),
      value: Text(verbatim: goalProgressPercent(share)),
      detail: lessonsProgressLine(studied: lessons.done - lessons.known, known: lessons.known),
      share: share)
  }

  /// Main's `useScheduleNumber`: the plan's state, then the time a day in the "Daily study time"
  /// setting's words while it's under way, or the lessons left once its date passed. Beside the
  /// plan's settings, whose row says it, the time isn't said again.
  private var scheduleNumber: PlanNumber? {
    guard let status = context.plan.status else {
      return nil
    }

    let paused = planIsResting(status, isPaused: context.isPaused)
    let detail: String? =
      switch status.kind {
      case .pastDate:
        String(
          localized: "\(status.lessons ?? 0) lessons left", table: "Plan",
          locale: .appLanguage, comment: "Lessons left in a plan whose date passed")
      case .ahead, .behind, .onTrack:
        timeShownBeside ? nil : dailyTimeText(context.plan.schedule.shape).text
      default:
        nil
      }

    return PlanNumber(
      label: String(
        localized: "Schedule", table: "Plan",
        comment: "Label of the tile with the plan's state, such as \"Up to date\""),
      value: Text(verbatim: planStatusText(status, isPaused: context.isPaused)),
      detail: paused ? nil : detail)
  }
}

private struct PlanNumber {
  var label: String
  var value: Text
  var detail: String?
  var detailIsGain = false
  /// From 0 to 1.
  var share: Double?
  var spokenValue: Text?
}

/// A paused goal rests unless its plan is already over or its date passed.
func planIsResting(_ status: GoalPlan.Status, isPaused: Bool) -> Bool {
  isPaused && ![.finished, .pastDate, .challengesLeft].contains(status.kind)
}

/// The plan's state, one wording everywhere it shows.
func planStatusText(_ status: GoalPlan.Status, isPaused: Bool) -> String {
  if planIsResting(status, isPaused: isPaused) {
    return String(localized: "Paused", table: "Plan", comment: "State of a paused goal's plan")
  }

  switch status.kind {
  case .ahead:
    return String(
      localized: "\(status.days ?? 0) days ahead", table: "Plan",
      locale: .appLanguage, comment: "State of a plan the learner is ahead of, in days")
  case .behind:
    if let lessons = status.lessons, lessons > 0 {
      return String(
        localized: "\(lessons) lessons behind", table: "Plan",
        locale: .appLanguage,
        comment: "State of a plan the learner is behind, in lessons from earlier days")
    }

    return String(
      localized: "\(status.days ?? 0) days behind", table: "Plan",
      locale: .appLanguage, comment: "State of a plan the learner is behind, in days")
  case .challengesLeft:
    return String(
      localized: "\(status.challenges ?? 0) challenges to go", table: "Plan",
      locale: .appLanguage, comment: "State of a plan with every lesson done and challenges left")
  case .finished:
    return String(localized: "Finished", table: "Plan", comment: "State of a finished plan")
  case .needsAdjusting:
    return String(
      localized: "Needs adjusting", table: "Plan",
      comment:
        "A plan's status: it has more lessons than days left, so the learner should change their time or date."
    )
  case .onTrack:
    return String(
      localized: "Up to date", table: "Plan", comment: "State of a plan the learner keeps up with")
  case .pastDate:
    return String(
      localized: "Date passed", table: "Plan", comment: "State of a plan whose date passed")
  }
}

func planFinish(_ context: PlanContext) -> PlanWhen? {
  let plan = context.plan

  guard context.goal.status != .paused else { return nil }

  guard let finish = plan.roadmapFinish(isExam: context.goal.kind == .exam) else {
    return nil
  }

  return .date(
    finish.estimate
      ? PlanDate.estimateText(finish.isoDate, today: plan.today, month: finish.month)
      : Text(PlanDate.text(finish.isoDate, today: plan.today, month: finish.month)))
}

/// The places a phone lists nowhere else: the lessons done, the mind maps and the exam's page.
struct PlanMoreSection: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(\.tabBarPlacement) private var tabBarPlacement

  let goal: LearnerGoal

  var body: some View {
    let places = learner.summary.value?.places
    let hasPlaces =
      places?.completedLessons == true || places?.mindMaps == true || goal.kind == .exam

    if tabBarPlacement?.listsStudyPlaces != true, hasPlaces {
      PageSection {
        PlanStudyPlaceRows()

        if goal.kind == .exam {
          PageLink(route: .exam) {
            Label {
              Text("About the exam", tableName: "Plan", comment: "Opens the exam's page")
            } icon: {
              Image(systemName: "graduationcap")
            }
          }
        }
      } header: {
        SectionTitle(
          Text("More", tableName: "Plan", comment: "Section of other places the Plan leads to"))
      }
    }
  }
}

struct PlanSettingsSection: View {
  let context: PlanContext

  @Environment(\.self) private var environment

  var body: some View {
    let schedule = context.plan.schedule

    PageSection {
      setting(
        label: context.goal.kind == .exam
          ? Text("Exam date", tableName: "Plan", comment: "Setting: the exam's date")
          : Text("End date", tableName: "Plan", comment: "Setting: the goal's end date"),
        value: dateValue, section: .date)

      setting(
        label: Text("Daily study time", tableName: "Plan"),
        value: dailyTimeValue(schedule.shape), section: .time)

      setting(
        label: Text(
          "Study days", tableName: "Plan", comment: "Setting: the days of the week to study"),
        value: Text(studyDaysText(schedule.weekdayMinutes)), section: .days)

      if !context.isPaused, let mocks = schedule.mocks {
        mockExamsRow(mocks)
      }

      ForEach(context.plan.examChoices) { choice in
        setting(
          label: Text(choice.group), value: choiceValue(choice), section: .choice(choice.group))
      }

      if let variety = context.goal.variety {
        setting(
          label: Text(
            "Language", tableName: "Plan", comment: "Setting: the language a goal learns"),
          value: Text(variety.name)
        ) {
          context.show(.language)
        }
      }

      countryRows

      if context.goal.kind == .language, let practiced = practicedText {
        setting(
          label: Text("Practice", tableName: "Plan"), value: Text(practiced), section: .practice)
      }
    } header: {
      SectionTitle(Text("Your plan", tableName: "Plan", comment: "Section of the plan's settings"))
    }
  }

  /// One country row at most, where the language row would be: a goal's content country (with the
  /// lessons' language when it isn't that country's own), a foreign exam's country, or where a
  /// general goal's examples come from.
  @ViewBuilder private var countryRows: some View {
    if let country = context.goal.contentCountry {
      if country.kind == .content, country.editable {
        setting(
          label: countryLabel,
          value: Text(country.name)
        ) {
          context.show(.country)
        }

        if let variety = country.lessonVariety {
          fact(
            label: Text(
              "Lesson language", tableName: "Plan",
              comment:
                "Row under the content country: the language the lessons are written in, such as Portuguese (Brazil)"
            ),
            value: Text(variety.name))
        }
      } else {
        fact(
          label: country.kind == .exam
            ? Text(
              "Exam country", tableName: "Plan",
              comment: "Row with the country an exam belongs to, such as Argentina")
            : countryLabel,
          value: Text(country.name))
      }
    } else if let examples = context.goal.examplesCountry {
      fact(label: countryLabel, value: Text(examples.name))
    }
  }

  /// Mock exams aren't a setting, so the row opens the exam's page, where they are.
  @ViewBuilder
  private func mockExamsRow(_ mocks: GoalPlan.Schedule.MockSchedule) -> some View {
    let label = Text("Mock exams", tableName: "Plan")

    if context.goal.kind == .exam {
      PageLink(route: .exam) {
        LabeledContent {
          mockValue(mocks)
        } label: {
          label.foregroundStyle(.primary)
        }
      }
    } else {
      fact(label: label, value: mockValue(mocks))
    }
  }

  /// Main's `MockScheduleValue`: the weekday they come on, else the next one's day.
  private func mockValue(_ mocks: GoalPlan.Schedule.MockSchedule) -> Text {
    if let weekday = mocks.weekday {
      let days = planWeekdays(weekday)

      if let weeks = mocks.everyWeeks, weeks > 1 {
        return Text(
          "\(days), every \(weeks) weeks", tableName: "Plan",
          comment:
            "When a plan's mock exams come: a weekday, every few weeks, like 'Saturdays, every 2 weeks'"
        )
      }

      return Text(verbatim: days)
    }

    let date = PlanDate.text(mocks.nextDate, today: context.plan.today)

    // A date alone is a value, in the data face; inside words, the words' face.
    return mocks.count > 1
      ? Text(
        "Next \(date)", tableName: "Plan",
        comment:
          "When a plan's next mock exam comes, of several; the argument is a day like 'Dec 13'")
      : Text(verbatim: date).font(TypeStyle.data.font(in: environment))
  }

  /// What a language plan practices: all activities, or the ones it keeps.
  private var practicedText: String? {
    let skipped = Set(context.plan.steering.skippedActivities)
    let practiced = planActivities.filter { !skipped.contains($0) }

    if practiced.isEmpty {
      return nil
    }

    return practiced.count == planActivities.count
      ? String(
        localized: "All activities", table: "Plan",
        comment: "A language plan practices every activity: new words, listening, writing, speaking"
      )
      : practiced.map(planActivityName).joinedFacts()
  }

  private var countryLabel: Text {
    Text(
      "Country", tableName: "Plan",
      comment:
        "Setting: the country a goal's lessons and examples are about, such as Portugal")
  }

  /// Read-only: not a button, read as one label. It keeps the chevron's slot, so its value ends
  /// where the settings' values do.
  private func fact(label: Text, value: Text) -> some View {
    IconLabeledContent {
      value
    } title: {
      label.foregroundStyle(.primary)
    } icon: {
      EmptyView()
    }
  }

  /// A time alone is a value, in the data face; with the weekend's words, the words' face.
  @ViewBuilder
  private func dailyTimeValue(_ shape: GoalPlan.WeekShape) -> some View {
    let time = dailyTimeText(shape)

    if time.hasWeekend {
      Text(verbatim: time.text)
    } else {
      Text(verbatim: time.text).typeStyle(.data)
    }
  }

  private var dateValue: some View {
    let value = PlanEndDateValue(
      targetDate: context.plan.schedule.targetDate, isExam: context.goal.kind == .exam,
      finish: context.isPaused
        ? context.plan.schedule.targetDate.map {
          (
            isoDate: $0, estimate: context.plan.schedule.targetDateEstimated,
            month: context.plan.schedule.targetDateNamedMonth
          )
        }
        : context.plan.roadmapFinish(isExam: context.goal.kind == .exam),
      today: context.plan.today)
    return Text(verbatim: value.shown)
      .typeStyle(value.isDate ? .data : .body)
      .accessibilityLabel(Text(verbatim: value.spoken))
  }

  private func choiceValue(_ choice: GoalPlan.ExamChoice) -> Text {
    guard let picked = choice.pickedNames else {
      return Text("Choose", tableName: "Plan", comment: "An exam choice not made yet")
        .foregroundStyle(.warningText)
    }

    return Text(picked)
  }

  private func setting<Value: View>(label: Text, value: Value, section: AdjustPlanSheet.Section)
    -> some View
  {
    setting(label: label, value: value) {
      context.adjust(section)
    }
  }

  private func setting<Value: View>(label: Text, value: Value, action: @escaping () -> Void)
    -> some View
  {
    Button(action: action) {
      LabeledContent {
        value
      } label: {
        label.foregroundStyle(.primary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .disclosureChevron()
    }
  }
}

func studyDaysText(_ weekdayMinutes: [Int]) -> String {
  let days = ScheduleTime.mondayFirst.filter {
    weekdayMinutes.indices.contains($0) && weekdayMinutes[$0] > 0
  }
  let symbol = { PlanDate.weekdayName(number: $0, short: true) }

  if days.count == 7 {
    return String(localized: "Every day", table: "Plan", comment: "Study days: all seven")
  }

  let positions = days.compactMap { ScheduleTime.mondayFirst.firstIndex(of: $0) }
  let isOneRun = positions.enumerated().allSatisfy { index, position in
    index == 0 || position == positions[index - 1] + 1
  }

  if let first = days.first, let last = days.last, days.count >= 3, isOneRun {
    return String(
      localized: "\(symbol(first)) – \(symbol(last))", table: "Plan",
      comment: "Study days as a run, from its first weekday to its last")
  }

  return days.map(symbol).formatted(.list(type: .and, width: .narrow))
}

/// The line under the Plan's progress percent. The percent counts lessons studied and those the
/// learner already knew, so once there are known ones the line names both.
private func lessonsProgressLine(studied: Int, known: Int) -> String {
  if known > 0 {
    return [
      studied > 0
        ? String(
          localized: "\(studied) studied", table: "Plan",
          locale: .appLanguage,
          comment:
            "Under the plan's progress percent, beside the lessons already known: the lessons studied"
        )
        : nil,
      String(
        localized: "\(known) already known", table: "Plan",
        locale: .appLanguage,
        comment: "Under the plan's progress percent: lessons the learner already knew"),
    ].compactMap(\.self).joinedFacts()
  }

  return studied == 0
    ? String(
      localized: "No lessons studied yet", table: "Plan",
      comment: "Under the plan's progress percent, in a small tile, before any lesson is studied")
    : String(
      localized: "\(studied) lessons studied", table: "Plan",
      locale: .appLanguage,
      comment: "Under the plan's progress percent, in a small tile: the lessons studied")
}
