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
  Duration.seconds(minutes * 60).formatted(
    .units(allowed: [.hours, .minutes], width: .abbreviated, maximumUnitCount: 2))
}

struct PlanRoadmapSection: View {
  @Environment(AppRouter.self) private var router
  @State private var pendingRoute: AppRoute?
  @State private var showsPhases = false

  let context: PlanContext
  let structure: GoalSyllabus?

  var body: some View {
    let phases = context.plan.roadPhases

    if !phases.isEmpty {
      Section {
        if structure != nil {
          Button {
            showsPhases = true
          } label: {
            RoadmapCompact(context: context, opens: true)
          }
          .foregroundStyle(.primary)
        } else {
          RoadmapCompact(context: context, opens: false)
        }
      }
      .sheet(isPresented: $showsPhases, onDismiss: openPendingRoute) {
        NavigationStack {
          List {
            PlanPathRows(context: context)
          }
          .navigationTitle(
            Text("Your path", tableName: "Plan", comment: "Title of the plan's phases")
          )
          .toolbarTitleDisplayMode(.inline)
          .toolbar {
            ToolbarItem(placement: .confirmationAction) {
              PlanSheetDoneButton()
            }
          }
        }
        .presentationDetents([.medium, .large])
        .environment(
          \.planSheetOpen,
          PlanSheetOpen { route in
            pendingRoute = route
            showsPhases = false
          })
      }
    }
  }

  private func openPendingRoute() {
    if let route = pendingRoute {
      pendingRoute = nil
      router.open(route)
    }
  }
}

private struct RoadmapCompact: View {
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
          position(phase: phases[currentIndex])
          Spacer()
          Text(
            "\(currentIndex + 1) of \(phases.count)", tableName: "Plan",
            comment: "The learner's phase number of the plan's phases, under the roadmap"
          )
          .monospacedDigit()
          .foregroundStyle(.secondary)
        } else {
          Text(
            "\(phases.filter { $0.state == .done }.count) of \(phases.count) phases done",
            tableName: "Plan", comment: "Phases done of the plan's phases, once none is current"
          )
          .foregroundStyle(.secondary)
          Spacer()
        }

        if opens {
          Image(systemName: "chevron.right")
            .foregroundStyle(.tertiary)
            .imageScale(.small)
        }
      }
      .font(.subheadline)
    }
    .accessibilityElement(children: .combine)
  }

  private func position(phase: PlanPhase) -> Text {
    let today = context.plan.today

    guard let start = phase.startDate, let end = phase.endDate, start <= today else {
      return Text(phase.title).fontWeight(.medium)
    }

    let day = PlanDate.days(from: start, to: today) + 1
    let days = PlanDate.days(from: start, to: end) + 1

    return Text(
      "\(Text(phase.title).fontWeight(.medium)) · day \(day) of \(days)", tableName: "Plan",
      comment: "Where the learner is: the phase's name, then its day of the phase's days")
  }
}

struct PlanNumbersSection: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @State private var open: Sheet?
  @State private var then: Then?

  let context: PlanContext
  let syllabus: GoalSyllabus?

  private enum Sheet: Identifiable {
    case pace
    case standing

    var id: Self { self }
  }

  private enum Then {
    case adjust
    case open(AppRoute)
  }

  var body: some View {
    let standing = standingNumber

    Section {
      let layout =
        dynamicTypeSize.isAccessibilitySize
        ? AnyLayout(VStackLayout(alignment: .leading, spacing: 16))
        : AnyLayout(HStackLayout(alignment: .top, spacing: 16))

      layout {
        if let standing {
          tile(standing) { open = .standing }
        }

        if let pace = paceNumber {
          if standing != nil {
            Divider()
          }

          tile(pace) { open = .pace }
        }
      }
      .buttonStyle(.plain)
    }
    .sheet(item: $open, onDismiss: doThen) { sheet in
      NavigationStack {
        switch sheet {
        case .standing:
          if context.goal.kind == .language,
            let language = store.languageStanding(goalId: context.goal.id).value
          {
            LanguageLevelSheet(standing: language)
          } else {
            PlanStandingSheet(context: context, syllabus: syllabus)
          }
        case .pace:
          PlanPaceSheet(context: context) {
            then = .adjust
            open = nil
          }
        }
      }
      .presentationDetents([.medium, .large])
      .environment(
        \.planSheetOpen,
        PlanSheetOpen { route in
          then = .open(route)
          open = nil
        })
    }
  }

  private func doThen() {
    switch then {
    case .adjust: context.adjust(.top)
    case .open(let route): router.open(route)
    case nil: break
    }

    then = nil
  }

  private func tile(_ number: PlanNumber, open: @escaping () -> Void) -> some View {
    Button(action: open) {
      VStack(alignment: .leading, spacing: 2) {
        Text(number.label)
          .font(.subheadline)
          .foregroundStyle(.secondary)

        Text(number.value)
          .font(.title2.weight(.semibold))
          .monospacedDigit()

        if let detail = number.detail {
          Text(detail)
            .font(.footnote)
            .foregroundStyle(
              number.detailIsGain ? AnyShapeStyle(.success) : AnyShapeStyle(.secondary))
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .contentShape(.rect)
    }
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
          ? String(
            localized: "No change this week", table: "Plan",
            comment: "Preparation didn't move this week")
          : points > 0
            ? String(
              localized: "+\(points) this week", table: "Plan",
              comment: "Preparation points gained this week")
            : String(
              localized: "\(points) this week", table: "Plan",
              comment: "Preparation points lost this week"),
        detailIsGain: points > 0)
    }

    if context.goal.kind == .language {
      guard let language = store.languageStanding(goalId: context.goal.id).value else {
        return nil
      }

      return PlanNumber(
        label: String(
          localized: "Level", table: "Plan", comment: "Label of a language goal's level"),
        value: language.levelText, detail: language.leadingSkill)
    }

    guard context.goal.kind == .learn, let lessons = syllabus?.lessons else {
      return nil
    }

    let share = lessons.total > 0 ? Double(lessons.done + lessons.known) / Double(lessons.total) : 0

    return PlanNumber(
      label: String(
        localized: "Progress", table: "Plan", comment: "Label of the goal's progress number"),
      value: share.formatted(.percent.precision(.fractionLength(0...2))),
      detail: String(
        localized: "\(lessons.done + lessons.known) of \(lessons.total) lessons",
        table: "Plan", comment: "Lessons studied or known of the plan's lessons"))
  }

  /// A plan without a pace (a free exam plan past its first week) shows none.
  private var paceNumber: PlanNumber? {
    guard let status = context.plan.status else {
      return nil
    }

    let label = String(localized: "Pace", table: "Plan", comment: "Label of the plan's pace number")

    switch status.kind {
    case .finished:
      return PlanNumber(
        label: label,
        value: String(localized: "Finished", table: "Plan", comment: "Pace of a finished plan"))
    case .pastDate:
      return PlanNumber(
        label: label,
        value: String(
          localized: "Past date", table: "Plan", comment: "Pace of a plan whose date came"),
        detail: String(
          localized: "\(status.lessons ?? 0) lessons left", table: "Plan",
          comment: "Lessons left in a plan whose date came"))
    case .challengesLeft:
      return PlanNumber(
        label: label,
        value: String(
          localized: "Challenges", table: "Plan",
          comment: "Pace of a plan with only challenges left"),
        detail: planStatusText(status))
    default:
      break
    }

    if context.isPaused {
      return PlanNumber(
        label: label,
        value: String(localized: "Paused", table: "Plan", comment: "Pace of a paused goal"),
        detail: String(
          localized: "Nothing is planned", table: "Plan", comment: "A paused goal plans nothing"))
    }

    switch status.kind {
    case .ahead:
      return PlanNumber(
        label: label,
        value: String(localized: "Ahead", table: "Plan", comment: "Pace ahead of the plan"),
        detail: planStatusText(status))
    case .behind:
      return PlanNumber(
        label: label,
        value: String(localized: "Behind", table: "Plan", comment: "Pace behind the plan"),
        detail: planStatusText(status))
    case .needsAdjusting:
      return PlanNumber(
        label: label,
        value: String(
          localized: "Too tight", table: "Plan", comment: "Pace of a plan that no longer fits"),
        detail: planStatusText(status))
    default:
      return PlanNumber(
        label: label,
        value: String(
          localized: "On pace", table: "Plan", comment: "Pace keeping up with the plan"),
        detail: String(
          localized:
            "\(planDurationText(minutes: Double(context.plan.schedule.dailyMinutes))) a day",
          table: "Plan", comment: "The plan's time a day, under the pace"))
    }
  }
}

private struct PlanNumber {
  var label: String
  var value: String
  var detail: String?
  var detailIsGain = false
}

func planStatusText(_ status: GoalPlan.Status) -> String {
  switch status.kind {
  case .ahead:
    String(
      localized: "\(status.days ?? 0) days ahead", table: "Plan",
      comment: "How many days ahead of the plan the learner is")
  case .behind:
    if let lessons = status.lessons, lessons > 0 {
      String(
        localized: "\(lessons) lessons to catch up", table: "Plan",
        comment: "Lessons from earlier days still to do")
    } else {
      String(
        localized: "\(status.days ?? 0) days behind", table: "Plan",
        comment: "How many days behind the plan the learner is")
    }
  case .challengesLeft:
    String(
      localized: "\(status.challenges ?? 0) challenges left", table: "Plan",
      comment: "Challenges left once every lesson is done")
  case .finished:
    String(localized: "Plan finished", table: "Plan", comment: "Pace of a finished plan, in words")
  case .needsAdjusting:
    String(
      localized: "Needs adjusting", table: "Plan", comment: "A plan that no longer fits, in words")
  case .onTrack:
    String(localized: "Keeping pace", table: "Plan", comment: "Keeping up with the plan, in words")
  case .pastDate:
    String(localized: "Past your date", table: "Plan", comment: "A plan whose date came, in words")
  }
}

func planPaceFix(_ plan: GoalPlan, isExam: Bool) -> (text: String, adjust: Bool)? {
  guard let status = plan.status else {
    return nil
  }

  switch status.kind {
  case .pastDate:
    let lessons = status.lessons ?? 0
    let text =
      isExam
      ? String(
        localized: "\(lessons) lessons were left before your exam.", table: "Plan",
        comment: "Lessons left when an exam's date came")
      : String(
        localized: "Your date came with \(lessons) lessons left.", table: "Plan",
        comment: "Lessons left when the goal's date came")
    return (text, false)
  case .challengesLeft:
    return (
      String(
        localized: "Every lesson is done: win the challenges to finish your plan.", table: "Plan",
        comment: "What's left once every lesson is done"),
      false
    )
  case .needsAdjusting:
    return (
      String(
        localized: "Your plan no longer fits in the time left.", table: "Plan",
        comment: "A plan that no longer fits before its date"),
      true
    )
  case .behind:
    if let lessons = status.lessons, lessons > 0 {
      let text = String(
        localized:
          "\(lessons) lessons from earlier days come first: once you've done them, you're keeping pace again.",
        table: "Plan", comment: "How a learner behind by some lessons catches up")
      return (text, false)
    }

    let text = String(
      localized:
        "\(status.extraMinutesPerDay ?? 0) more minutes a day for \(status.days ?? 0) days and you're keeping pace again.",
      table: "Plan", comment: "How much more time a day catches up")
    return (text, false)
  default:
    return nil
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
    let checkpoint = ahead.lazy.compactMap(\.checkpoint).first { $0.state == .upcoming }
    let chapter = isExam ? nil : plan.nextChapter

    if mockDate != nil || chapter?.chapterId != nil || checkpoint != nil || isExam {
      Section {
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

        if let chapter, let chapterId = chapter.chapterId {
          NavigationLink(value: chapterRoute(chapterId)) {
            LabeledContent {
              Text(
                "\(chapter.lessonsDone) / \(chapter.lessonsTotal)", tableName: "Plan",
                comment: "Lessons done of a chapter's lessons"
              )
              .monospacedDigit()
            } label: {
              Label {
                Text(chapter.title)
              } icon: {
                StatusMark(status: .next)
              }
            }
          }
        }

        if let checkpoint {
          Button {
            router.open(.challenge(planItemId: checkpoint.planItemId))
          } label: {
            row(
              title: Text(
                "Phase challenge", tableName: "Plan", comment: "The challenge that closes a phase"),
              detail: checkpointWhen(checkpoint), kind: .challenge)
          }
        }

        finishRow
      } header: {
        Text(
          "Next on your path", tableName: "Plan", comment: "Section of what comes next on the plan")
      }
    }
  }

  private func row(title: Text, detail: Text?, kind: LearnKind) -> some View {
    LabeledContent {
      detail
    } label: {
      Label {
        title.foregroundStyle(.primary)
      } icon: {
        KindMark(kind: kind)
      }
    }
  }

  private func checkpointWhen(_ checkpoint: PlanPhase.Checkpoint) -> Text? {
    switch checkpoint.when {
    case .nextSession:
      Text("In your next session", tableName: "Plan", comment: "When the phase's challenge comes")
    case .queued:
      Text(
        "After the challenge before it", tableName: "Plan",
        comment: "When the phase's challenge comes")
    case .date:
      checkpoint.date.map { Text(PlanDate.text($0, today: context.plan.today)) }
    }
  }

  @ViewBuilder
  private var finishRow: some View {
    let label = Label {
      Text(context.goal.title).foregroundStyle(.primary)
    } icon: {
      Image(systemName: "flag")
    }

    let finish = LabeledContent {
      planFinishText(context)
    } label: {
      label
    }

    if context.goal.kind == .exam {
      Button {
        router.open(.exam)
      } label: {
        finish
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
    let date = PlanDate.text(targetDate, today: plan.today, month: schedule.targetDateNamedMonth)
    return schedule.targetDateEstimated ? Text(verbatim: "~\(date)") : Text(date)
  }

  if context.goal.kind == .exam {
    return Text(
      "Date to be confirmed", tableName: "Plan", comment: "An exam whose day isn't known yet")
  }

  return plan.estimate.endDate.map { Text(verbatim: "~\(PlanDate.text($0, today: plan.today))") }
}

struct PlanMoreSection: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(\.tabBarPlacement) private var tabBarPlacement

  let goal: LearnerGoal

  var body: some View {
    let mindMaps = learner.summary.value?.places.mindMaps == true

    if tabBarPlacement?.listsStudyPlaces != true, goal.kind == .exam || mindMaps {
      Section {
        if goal.kind == .exam {
          NavigationLink(value: AppRoute.exam) {
            Label {
              Text("About the exam", tableName: "Plan", comment: "Opens the exam's page")
            } icon: {
              Image(systemName: "graduationcap")
            }
          }
        }

        if mindMaps {
          NavigationLink(value: AppRoute.mindMaps) {
            Label {
              Text("Mind maps", tableName: "Plan", comment: "Opens the goal's mind maps")
            } icon: {
              KindMark(kind: .mindMap)
            }
          }
        }
      } header: {
        Text("More", tableName: "Plan", comment: "Section of other places the Plan leads to")
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
          : Text("Goal date", tableName: "Plan", comment: "Setting: the goal's date"),
        value: dateValue, section: .date)

      setting(
        label: Text("Time a day", tableName: "Plan", comment: "Setting: study time a day"),
        value: Text(planDurationText(minutes: Double(schedule.dailyMinutes))).monospacedDigit(),
        section: .time)

      setting(
        label: Text(
          "Study days", tableName: "Plan", comment: "Setting: the days of the week to study"),
        value: Text(studyDaysText(schedule.weekdayMinutes)), section: .days)
    } header: {
      Text("Your plan", tableName: "Plan", comment: "Section of the plan's settings")
    }
  }

  private var dateValue: Text {
    if context.plan.schedule.targetDate == nil {
      return context.goal.kind == .exam
        ? Text("To be confirmed", tableName: "Plan", comment: "An exam's date not known yet")
        : Text("No date", tableName: "Plan", comment: "A goal without a date")
    }

    return planFinishText(context) ?? Text(verbatim: "")
  }

  private func setting(label: Text, value: Text, section: AdjustPlanSheet.Section) -> some View {
    Button {
      context.adjust(section)
    } label: {
      LabeledContent {
        value
      } label: {
        label.foregroundStyle(.primary)
      }
    }
  }
}

func studyDaysText(_ weekdayMinutes: [Int]) -> String {
  let mondayFirst = [1, 2, 3, 4, 5, 6, 0]
  let days = mondayFirst.filter { weekdayMinutes.indices.contains($0) && weekdayMinutes[$0] > 0 }
  let symbols = Calendar.current.shortWeekdaySymbols

  if days.count == 7 {
    return String(localized: "Every day", table: "Plan", comment: "Study days: all seven")
  }

  let positions = days.compactMap { mondayFirst.firstIndex(of: $0) }
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
