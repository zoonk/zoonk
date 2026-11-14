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
      return String(
        localized: "Phase \(index + 1)", table: "Plan",
        comment: "Name of an unnamed phase by its number")
    }
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

struct PlanRoadmapSection: View {
  let context: PlanContext
  let structure: GoalSyllabus?
  var listsPhases = false

  var body: some View {
    let phases = context.plan.roadPhases

    if !phases.isEmpty {
      Section {
        if listsPhases {
          RoadmapCompact(context: context, opens: false)

          ForEach(Array(zip(phases, PhaseWhen.of(phases))), id: \.0.id) { phase, when in
            RoadmapPhaseRow(phase: phase, when: when, today: context.plan.today)
          }
        } else if structure != nil {
          Button {
            context.show(.path)
          } label: {
            RoadmapCompact(context: context, opens: true)
          }
          .foregroundStyle(.primary)
        } else {
          RoadmapCompact(context: context, opens: false)
        }
      } header: {
        if listsPhases {
          SectionTitle(
            Text("Phases", tableName: "Plan", comment: "Header over a new plan's phases"))
        }
      }
    }
  }
}

/// What main's roadmap says under each phase: "Today" under the current one and the start of each
/// one after it. Earlier phases say nothing, since one settled by placement would claim today's date.
enum PhaseWhen: Equatable {
  case today
  case starts(String)

  static func of(_ phases: [PlanPhase]) -> [PhaseWhen?] {
    let current = phases.firstIndex { $0.state == .current }

    return phases.enumerated().map { position, phase in
      guard let current, position >= current, let start = phase.startDate else {
        return nil
      }

      return position == current ? .today : .starts(start)
    }
  }
}

private struct RoadmapPhaseRow: View {
  let phase: PlanPhase
  let when: PhaseWhen?
  let today: String

  var body: some View {
    PlanPathRow {
      Label {
        Text(phase.title)
          .typeWeight(.medium)
      } icon: {
        StatusMark(status: phase.mark)
      }
    } value: {
      Group {
        switch when {
        case .today?:
          Text("Today", tableName: "Plan", comment: "When the learner's current phase starts")
        case .starts(let start)?:
          Text(PlanDate.text(start, today: today))
        case nil:
          EmptyView()
        }
      }
      .typeStyle(.data)
      .foregroundStyle(.mutedForeground)
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(
      phase.state == .current
        ? Text("You are here", tableName: "Plan", comment: "Spoken on the learner's current phase")
        : Text(verbatim: ""))
  }

}

/// Main's line under the roadmap: "Phase 1 of 4 · Foundations", then the day the phase is behind
/// you.
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
            fill: phase.state == .done
              ? .color(.success) : phase.state == .current ? .current : .track)
        })

      HStack(alignment: .firstTextBaseline) {
        if let currentIndex {
          let phase = phases[currentIndex]

          PlanPathRow {
            position(phase: phase, number: currentIndex + 1, count: phases.count)
          } value: {
            if let until = phase.untilDate {
              Text(
                "until \(PlanDate.text(until, today: context.plan.today))", tableName: "Plan",
                comment: "When a phase ends; the argument is a date like 'May 5'"
              )
              .typeStyle(.data)
            }
          }
        } else {
          Spacer()
        }

        if opens {
          DisclosureChevron()
        }
      }
      .typeStyle(.meta)
    }
    .accessibilityElement(children: .combine)
  }

  private func position(phase: PlanPhase, number: Int, count: Int) -> Text {
    let place = Text(
      "Phase \(number) of \(count)", tableName: "Plan",
      comment: "The learner's phase of the plan's phases, under the roadmap")

    guard phase.hasOwnName else {
      return place.foregroundStyle(Color(.foreground))
    }

    let title = Text(phase.title)
      .typeWeight(.medium, legibility: legibilityWeight)
      .foregroundStyle(Color(.foreground))

    return Text(
      "\(place)\u{00A0}· \(title)", tableName: "Plan",
      comment: "The learner's phase under the roadmap: its number of the phases, then its name"
    )
    .foregroundStyle(.mutedForeground)
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

  let context: PlanContext
  let syllabus: GoalSyllabus?

  @ScaledMetric(relativeTo: .body) private var minimumWidth = 150.0

  var body: some View {
    let standing = standingNumber

    Section {
      StatTileGrid(columns: [2, 1], minimumWidth: minimumWidth) {
        if let standing {
          tile(standing) { context.show(.standing) }
        }

        if let schedule = scheduleNumber {
          tile(schedule) { context.show(.schedule) }
        }
      }
      .buttonStyle(.plain)
    }
  }

  /// Main's plan tiles: a stat tile's label and readout, a meter for a share, and the line under it.
  private func tile(_ number: PlanNumber, open: @escaping () -> Void) -> some View {
    Button(action: open) {
      StatTile(
        label: Text(number.label),
        value: Text(number.value),
        icon: { EmptyView() },
        detail: number.detail.map {
          Text($0).foregroundStyle(
            number.detailIsGain ? AnyShapeStyle(.successText) : AnyShapeStyle(.mutedForeground))
        },
        meter: number.share,
        meterFill: .success
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
        value: preparation.value.formatted(.percent.precision(.fractionLength(0))),
        detail: points == 0
          ? nil
          : points > 0
            ? String(
              localized: "+\(points) this week", table: "Plan",
              comment: "Preparation points gained this week")
            : String(
              localized: "\(points) this week", table: "Plan",
              comment: "Preparation points lost this week"),
        detailIsGain: points > 0, share: preparation.value)
    }

    if context.goal.kind == .language {
      guard let language = store.languageStanding(goalId: context.goal.id).value else {
        return nil
      }

      return PlanNumber(
        label: String(
          localized: "Level", table: "Plan", comment: "Label of a language goal's level"),
        value: language.levelText)
    }

    guard context.goal.kind == .learn, let lessons = syllabus?.lessons else {
      return nil
    }

    let share = lessons.total > 0 ? min(1, Double(lessons.done) / Double(lessons.total)) : 0

    return PlanNumber(
      label: String(
        localized: "Progress", table: "Plan", comment: "Label of the goal's progress number"),
      value: goalProgressPercent(share),
      detail: studiedText(lessons.done - lessons.known), share: share)
  }

  /// Only the lessons studied: a long plan never leads with its total, which stays in the sheet,
  /// and what the learner already knew stays in the percent and the bars.
  private func studiedText(_ studied: Int) -> String {
    studied == 0
      ? String(
        localized: "No lessons studied yet", table: "Plan",
        comment: "Under the plan's progress percent, in a small tile, before any lesson is studied")
      : String(
        localized: "\(studied) lessons studied", table: "Plan",
        comment: "Under the plan's progress percent, in a small tile: the lessons studied")
  }

  /// The plan's state, and one quiet line: the time a day while it keeps a pace, the lessons left
  /// once its date passed.
  private var scheduleNumber: PlanNumber? {
    guard let status = context.plan.status else {
      return nil
    }

    let paused = planIsResting(status, isPaused: context.isPaused)
    let detail: String? =
      switch status.kind {
      case .onTrack, .ahead, .behind:
        String(
          localized:
            "\(planDurationText(minutes: Double(context.plan.schedule.dailyMinutes))) a day",
          table: "Plan", comment: "The plan's time a day, under its state")
      case .pastDate:
        String(
          localized: "\(status.lessons ?? 0) lessons left", table: "Plan",
          comment: "Lessons left in a plan whose date passed")
      default:
        nil
      }

    return PlanNumber(
      label: String(
        localized: "Schedule", table: "Plan",
        comment: "Label of the tile with the plan's state, such as \"Up to date\""),
      value: planStatusText(status, isPaused: context.isPaused), detail: paused ? nil : detail)
  }
}

private struct PlanNumber {
  var label: String
  var value: String
  var detail: String?
  var detailIsGain = false
  /// From 0 to 1.
  var share: Double?
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
      comment: "State of a plan the learner is ahead of, in days")
  case .behind:
    if let lessons = status.lessons, lessons > 0 {
      return String(
        localized: "\(lessons) lessons behind", table: "Plan",
        comment: "State of a plan the learner is behind, in lessons from earlier days")
    }

    return String(
      localized: "\(status.days ?? 0) days behind", table: "Plan",
      comment: "State of a plan the learner is behind, in days")
  case .challengesLeft:
    return String(
      localized: "\(status.challenges ?? 0) challenges to go", table: "Plan",
      comment: "State of a plan with every lesson done and challenges left")
  case .finished:
    return String(localized: "Finished", table: "Plan", comment: "State of a finished plan")
  case .needsAdjusting:
    return String(
      localized: "Not enough time", table: "Plan",
      comment: "State of a plan with more lessons than days left")
  case .onTrack:
    return String(
      localized: "Up to date", table: "Plan", comment: "State of a plan the learner keeps up with")
  case .pastDate:
    return String(
      localized: "Date passed", table: "Plan", comment: "State of a plan whose date passed")
  }
}

struct NextOnPathSection: View {
  @Environment(AppRouter.self) private var router

  let context: PlanContext

  var body: some View {
    let plan = context.plan
    let isExam = context.goal.kind == .exam
    let ahead = plan.phases.filter {
      $0.kind != .afterExam && ($0.state == .current || $0.state == .upcoming)
    }
    let mockDate = ahead.lazy.compactMap(\.mocks.nextDate).first
    let checkpointPhase = ahead.first { $0.checkpoint?.state == .upcoming }
    let checkpoint = checkpointPhase?.checkpoint
    let chapter = isExam ? nil : plan.nextChapter
    let chapterPhase = plan.phases.first { $0.chapters.contains { $0.state == .current } }
    // A challenge in the next session comes before the next phase's lessons, as on Today.
    let challengeFirst =
      checkpoint?.when == .nextSession
      && (checkpointPhase?.index ?? 0) < (chapterPhase?.index ?? -1)

    if mockDate != nil || chapter?.chapterId != nil || checkpoint != nil || isExam {
      PageSection {
        if let mockDate {
          Button {
            router.open(.exam)
          } label: {
            row(
              title: Text(
                "Mock exam", tableName: "Plan", comment: "The next mock exam on the path"),
              detail: Text(PlanDate.text(mockDate, today: plan.today)), kind: .mock)
          }
        }

        if challengeFirst, let checkpoint {
          checkpointRow(checkpoint)
        }

        if let chapter, let chapterId = chapter.chapterId {
          PageLink(route: chapterRoute(chapterId)) {
            PlanPathRow {
              Label {
                Text(chapter.title)
              } icon: {
                StatusMark(status: .next)
              }
            } value: {
              Text(
                "\(chapter.lessonsDone) / \(chapter.lessonsTotal)", tableName: "Plan",
                comment: "Lessons done of a chapter's lessons"
              )
              .monospacedDigit()
            }
          }
        }

        if !challengeFirst, let checkpoint {
          checkpointRow(checkpoint)
        }

        finishRow
      } header: {
        SectionTitle(
          Text(
            "Next on your path", tableName: "Plan",
            comment: "Section of what comes next on the plan"))
      }
    }
  }

  private func checkpointRow(_ checkpoint: PlanPhase.Checkpoint) -> some View {
    Button {
      router.open(.challenge(planItemId: checkpoint.planItemId))
    } label: {
      PlanChallengeLabel(
        when: checkpoint.whenText(today: context.plan.today), explains: true,
        isLanguage: context.goal.kind == .language)
    }
  }

  private func row(title: Text, detail: Text?, kind: LearnKind) -> some View {
    IconLabeledContent {
      detail
    } title: {
      title.foregroundStyle(.primary)
    } icon: {
      KindMark(kind: kind)
    }
    .disclosureChevron()
  }

  @ViewBuilder
  private var finishRow: some View {
    let finish = IconLabeledContent {
      planFinishText(context)
    } title: {
      Text(context.goal.displayName).foregroundStyle(.primary)
    } icon: {
      Image(systemName: "flag")
    }

    if context.goal.kind == .exam {
      Button {
        router.open(.exam)
      } label: {
        finish
          .disclosureChevron()
      }
    } else {
      finish
    }
  }

  private func chapterRoute(_ chapterId: String) -> AppRoute {
    context.goal.kind == .language
      ? .languageUnit(chapterId: chapterId) : .chapter(chapterId: chapterId)
  }
}

func planFinishText(_ context: PlanContext) -> Text? {
  let plan = context.plan
  let schedule = plan.schedule

  if let targetDate = schedule.targetDate {
    let month = schedule.targetDateNamedMonth

    return schedule.targetDateEstimated
      ? PlanDate.estimateText(targetDate, today: plan.today, month: month)
      : Text(PlanDate.text(targetDate, today: plan.today, month: month))
  }

  if context.goal.kind == .exam {
    return Text(
      "Date to be confirmed", tableName: "Plan", comment: "An exam whose day isn't known yet")
  }

  return plan.estimate.endDate.map { PlanDate.estimateText($0, today: plan.today) }
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

  var body: some View {
    let schedule = context.plan.schedule

    Section {
      setting(
        label: context.goal.kind == .exam
          ? Text("Exam date", tableName: "Plan", comment: "Setting: the exam's date")
          : Text("End date", tableName: "Plan", comment: "Setting: the goal's end date"),
        value: dateValue, section: .date)

      setting(
        label: Text("Time a day", tableName: "Plan", comment: "Setting: study time a day"),
        value: Text(planDurationText(minutes: Double(schedule.dailyMinutes))).monospacedDigit(),
        section: .time)

      setting(
        label: Text(
          "Study days", tableName: "Plan", comment: "Setting: the days of the week to study"),
        value: Text(studyDaysText(schedule.weekdayMinutes)), section: .days)

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

      ForEach(context.plan.examChoices) { choice in
        setting(
          label: Text(choice.group), value: choiceValue(choice), section: .choice(choice.group))
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

  private var countryLabel: Text {
    Text(
      "Country", tableName: "Plan",
      comment:
        "Setting: the country a goal's lessons and examples are about, such as Portugal")
  }

  /// Read-only: not a button, read as one label. It keeps the chevron's slot, so its value ends
  /// where the settings' values do.
  private func fact(label: Text, value: Text) -> some View {
    LabeledContent {
      value
    } label: {
      label.foregroundStyle(.primary)
    }
    .chevronSlot()
    .accessibilityElement(children: .combine)
  }

  private var dateValue: Text {
    if context.plan.schedule.targetDate == nil {
      return context.goal.kind == .exam
        ? Text("To be confirmed", tableName: "Plan", comment: "An exam's date not known yet")
        : Text("No date", tableName: "Plan", comment: "A goal without a date")
    }

    return planFinishText(context) ?? Text(verbatim: "")
  }

  private func choiceValue(_ choice: GoalPlan.ExamChoice) -> Text {
    guard let picked = choice.pickedNames else {
      return Text("Choose", tableName: "Plan", comment: "An exam choice not made yet")
        .foregroundStyle(.warningText)
    }

    return Text(picked)
  }

  private func setting(label: Text, value: Text, section: AdjustPlanSheet.Section) -> some View {
    setting(label: label, value: value) {
      context.adjust(section)
    }
  }

  private func setting(label: Text, value: Text, action: @escaping () -> Void) -> some View {
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
  let symbols = Calendar.current.shortWeekdaySymbols

  if days.count == 7 {
    return String(localized: "Every day", table: "Plan", comment: "Study days: all seven")
  }

  let positions = days.compactMap { ScheduleTime.mondayFirst.firstIndex(of: $0) }
  let isOneRun = positions.enumerated().allSatisfy { index, position in
    index == 0 || position == positions[index - 1] + 1
  }

  if let first = days.first, let last = days.last, days.count >= 3, isOneRun {
    return String(
      localized: "\(symbols[first]) – \(symbols[last])", table: "Plan",
      comment: "Study days as a run, from its first weekday to its last")
  }

  return days.map { symbols[$0] }.formatted(.list(type: .and, width: .narrow))
}

struct PlanSheetDoneButton: View {
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    Button(role: .confirm) {
      dismiss()
    } label: {
      Text("Done", tableName: "Plan", comment: "Closes a sheet")
    }
  }
}
