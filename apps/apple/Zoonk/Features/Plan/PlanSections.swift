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

  /// A phase's length on the road: its days, else its hours.
  var weight: Double {
    guard let startDate, let endDate else {
      return 1
    }

    return Double(max(1, PlanDate.days(from: startDate, to: endDate) + 1))
  }
}

/// "45 min", "1 hr, 30 min": minutes as the system says a duration.
func planDurationText(minutes: Double) -> String {
  Duration.seconds(minutes * 60).formatted(
    .units(allowed: [.hours, .minutes], width: .abbreviated, maximumUnitCount: 2))
}

// MARK: - Roadmap

/// The phases in time: a meter of parts (each as long as its days, done ones blue, the current one
/// ringed) and where the learner is under it. With a structure on the page, it opens every phase
/// with its chapters; otherwise the path below names them.
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
            "\(phases.filter { $0.state == .done }.count) of ^[\(phases.count) phase](inflect: true) done",
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

// MARK: - Numbers

/// The two numbers that answer "will I make it?": where the learner stands (an exam's preparation,
/// another goal's lessons) and the pace against the plan, each opening what's behind it.
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

  /// What a sheet's row asked for, done once the sheet is closed.
  private enum Then {
    case adjust
    case open(AppRoute)
  }

  var body: some View {
    let standing = standingNumber

    Section {
      // Side by side, or one over the other at accessibility text sizes.
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
          PlanStandingSheet(context: context, syllabus: syllabus)
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

  /// An exam's preparation with its gain this week; another goal's lessons studied or known.
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

    guard context.goal.kind == .learn, let lessons = syllabus?.lessons else {
      return nil
    }

    let share = lessons.total > 0 ? Double(lessons.done + lessons.known) / Double(lessons.total) : 0

    return PlanNumber(
      label: String(
        localized: "Progress", table: "Plan", comment: "Label of the goal's progress number"),
      value: share.formatted(.percent.precision(.fractionLength(0...2))),
      detail: String(
        AttributedString(
          localized: "\(lessons.done + lessons.known) of ^[\(lessons.total) lesson](inflect: true)",
          table: "Plan", comment: "Lessons studied or known of the plan's lessons"
        ).characters))
  }

  /// The pace in a word, with what it means. A paused goal has no pace to keep; a plan without a
  /// pace (a free exam plan past its first week) shows none.
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
          AttributedString(
            localized: "^[\(status.lessons ?? 0) lesson](inflect: true) left", table: "Plan",
            comment: "Lessons left in a plan whose date came"
          ).characters))
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

/// The pace in a few words: "Keeping pace", "3 days ahead", "2 lessons to catch up".
func planStatusText(_ status: GoalPlan.Status) -> String {
  switch status.kind {
  case .ahead:
    String(
      AttributedString(
        localized: "^[\(status.days ?? 0) day](inflect: true) ahead", table: "Plan",
        comment: "How many days ahead of the plan the learner is"
      ).characters)
  case .behind:
    if let lessons = status.lessons, lessons > 0 {
      String(
        AttributedString(
          localized: "^[\(lessons) lesson](inflect: true) to catch up", table: "Plan",
          comment: "Lessons from earlier days still to do"
        ).characters)
    } else {
      String(
        AttributedString(
          localized: "^[\(status.days ?? 0) day](inflect: true) behind", table: "Plan",
          comment: "How many days behind the plan the learner is"
        ).characters)
    }
  case .challengesLeft:
    String(
      AttributedString(
        localized: "^[\(status.challenges ?? 0) challenge](inflect: true) left", table: "Plan",
        comment: "Challenges left once every lesson is done"
      ).characters)
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

/// The small fix under the pace: what keeps the plan going, and whether it's adjusting the plan.
func planPaceFix(_ plan: GoalPlan, isExam: Bool) -> (text: String, adjust: Bool)? {
  guard let status = plan.status else {
    return nil
  }

  switch status.kind {
  case .pastDate:
    let lessons = status.lessons ?? 0
    let text =
      switch (isExam, lessons == 1) {
      case (true, true):
        String(
          localized: "1 lesson was left before your exam.", table: "Plan",
          comment: "One lesson left when an exam's date came")
      case (true, false):
        String(
          localized: "\(lessons) lessons were left before your exam.", table: "Plan",
          comment: "Lessons left when an exam's date came")
      case (false, _):
        String(
          AttributedString(
            localized: "Your date came with ^[\(lessons) lesson](inflect: true) left.",
            table: "Plan",
            comment: "Lessons left when the goal's date came"
          ).characters)
      }
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
      let text =
        lessons == 1
        ? String(
          localized:
            "1 lesson from earlier days comes first: once you've done it, you're keeping pace again.",
          table: "Plan", comment: "How a learner one lesson behind catches up")
        : String(
          localized:
            "\(lessons) lessons from earlier days come first: once you've done them, you're keeping pace again.",
          table: "Plan", comment: "How a learner behind by several lessons catches up")
      return (text, false)
    }

    let text = AttributedString(
      localized:
        "\(status.extraMinutesPerDay ?? 0) more minutes a day for ^[\(status.days ?? 0) day](inflect: true) and you're keeping pace again.",
      table: "Plan", comment: "How much more time a day catches up")
    return (String(text.characters), false)
  default:
    return nil
  }
}

// MARK: - Slot

/// The one thing the Plan wants the learner to know or decide, the most pressing first: the goal
/// is paused, its date came with lessons left, the plan no longer fits, the learner is behind, or a
/// free exam plan's first week is over.
struct PlanSuggestionSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @State private var isResuming = false

  let context: PlanContext

  var body: some View {
    let plan = context.plan

    if context.isPaused {
      let preview = store.resumeChangesPlan(goalId: context.goal.id)

      suggestion(
        title: Text(
          "\(context.goal.title) is paused", tableName: "Plan",
          comment: "Title of the Plan's notice for a paused goal"),
        systemImage: "pause",
        description: preview.value == true
          ? Text(
            "Your plan picks up from today, starting with the lessons planned for the days you paused.",
            tableName: "Plan", comment: "Explains how resuming the paused goal changes its plan")
          : Text(
            "Nothing is planned until you resume it.", tableName: "Plan",
            comment: "Explains a paused goal")
      ) {
        Button {
          resume()
        } label: {
          Text("Resume", tableName: "Plan", comment: "Resumes the paused goal")
        }
        .disabled(isResuming)
      }
      .loads(preview, refreshable: false)
    } else if plan.status?.kind == .pastDate,
      let fix = planPaceFix(plan, isExam: context.goal.kind == .exam)
    {
      suggestion(
        title: Text(
          "Your date came", tableName: "Plan",
          comment: "Title of the Plan's notice when the goal's date came"),
        systemImage: "calendar.badge.exclamationmark", description: Text(fix.text)
      ) {
        adjustButton(.date)
      }
    } else if plan.status?.kind == .needsAdjusting {
      suggestion(
        title: Text(
          "Your plan no longer fits", tableName: "Plan",
          comment: "Title of the Plan's notice when the plan no longer fits"),
        systemImage: "calendar.badge.clock", description: nil
      ) {
        adjustButton(.top)
      }
    } else if plan.status?.kind == .behind,
      let fix = planPaceFix(plan, isExam: context.goal.kind == .exam)
    {
      suggestion(
        title: Text(
          "A little to catch up", tableName: "Plan",
          comment: "Title of the Plan's notice when behind"),
        systemImage: "calendar.badge.clock", description: Text(fix.text)
      ) {
        Button {
          router.select(.today)
        } label: {
          Text(
            "Go to Today", tableName: "Plan", comment: "Opens Today, which puts what's behind first"
          )
        }
      }
    } else if plan.access.freeWeekOver {
      suggestion(
        title: Text(
          "Your free week of exam prep is over", tableName: "Plan",
          comment: "Title of the Plan's notice when a free exam plan's first week ended"),
        systemImage: "sparkles",
        description: Text(
          "Reviews and fixing your mistakes stay free. Plus opens new lessons, the rest of your plan and mock exams.",
          tableName: "Plan", comment: "What stays free and what Plus opens after the free week")
      ) {
        // TODO(S10): use `SeePlusButton()` once PlusLock.swift lands.
        Button {
          router.present(.subscription)
        } label: {
          Text("See Plus", tableName: "Plan", comment: "Opens the Plus subscription")
        }
      }
    }
  }

  private func suggestion(
    title: Text, systemImage: String, description: Text?,
    @ViewBuilder action: () -> some View
  ) -> some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Label {
          title.font(.headline)
        } icon: {
          Image(systemName: systemImage)
            .foregroundStyle(.warning)
        }

        if let description {
          description
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        action()
          .buttonStyle(.bordered)
      }
      .padding(.vertical, 4)
    }
  }

  private func adjustButton(_ section: AdjustPlanSheet.Section) -> some View {
    Button {
      context.adjust(section)
    } label: {
      Text("Adjust plan", tableName: "Plan", comment: "Opens the plan's settings to change them")
    }
  }

  private func resume() {
    Task {
      isResuming = true
      _ = await store.setStatus(.active, goalId: context.goal.id)
      isResuming = false
    }
  }
}

// MARK: - Next on the path

/// What comes next on the way to the goal, rows the learner can act on: an exam's next mock (any
/// other goal's next chapter), the next challenge that closes a phase, and the goal with its date.
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

/// The end of the plan's road: the goal's date (an estimated day with "~", a named month), or when
/// a plan without one ends at this pace; an exam without a date says it's to be confirmed.
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

// MARK: - More

/// Where the Plan leads that the sidebar lists on a regular width: the exam's page and the mind
/// maps. On a compact width they close the page.
struct PlanMoreSection: View {
  @Environment(LearnerSummaryStore.self) private var learner

  let goal: LearnerGoal

  var body: some View {
    let mindMaps = learner.summary.value?.places.mindMaps == true

    if goal.kind == .exam || mindMaps {
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

// MARK: - Settings

/// The plan's settings at a glance: the goal's date, the time a day and the study days; a tap opens
/// "Adjust plan" at it.
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

/// "Mon – Sat", "Every day" or "Mon, Wed, Fri": the plan's study days, from Monday.
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

/// "Done" in a sheet's bar.
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
