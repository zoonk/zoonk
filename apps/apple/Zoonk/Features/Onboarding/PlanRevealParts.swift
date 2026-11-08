import SwiftUI

/// Main's reveal hero: the plan just made, its goal and the buddy, who cheers on the moment's last
/// beat, after the check, the lesson count and "Start here".
struct RevealHero: View {
  let title: String
  let buddy: BuddyLook

  @Environment(\.celebrates) private var celebrates

  var body: some View {
    HStack(alignment: .top, spacing: 16) {
      VStack(alignment: .leading, spacing: 6) {
        Label {
          Text(
            "Plan created", tableName: "Onboarding",
            comment: "Eyebrow over a goal whose plan was just built")
        } icon: {
          Image(systemName: "checkmark.circle.fill")
            .settles()
        }
        .typeStyle(.body.weight(.semibold))
        .foregroundStyle(.successText)

        Text(title)
          .typeStyle(.pageTitle)
          .accessibilityAddTraits(.isHeader)
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      BuddyCharacter(
        look: studied, expression: .happy,
        reaction: celebrates ? ActReaction(act: .cheer, delay: 3 * .beat) : nil
      )
      .frame(width: 80, height: 80)
      .accessibilityHidden(true)
    }
  }

  private var studied: BuddyLook {
    var look = buddy
    look.studiedToday = true
    return look
  }
}

/// Main's `RevealReadouts`: the time a day, the lessons and when it ends, side by side.
struct RevealReadouts: View {
  let plan: GoalPlan
  let isExam: Bool

  var body: some View {
    HStack(alignment: .top, spacing: 0) {
      readout(label: timeLabel) {
        BigQuantity(planDurationText(minutes: Double(plan.schedule.shape.weekdays)))
      }

      if lessons.total > 0 {
        Divider()
        readout(label: lessonsLabel) {
          EarnedNumber(value: lessons.total, delay: .beat, isSigned: false)
            .typeStyle(.readout)
        }
      }

      if let finish {
        Divider()
        readout(label: finish.label) {
          finish.value
        }
      }
    }
    .fixedSize(horizontal: false, vertical: true)
    .padding(.vertical, 12)
    .overlay(alignment: .top) { Divider() }
    .overlay(alignment: .bottom) { Divider() }
  }

  private func readout<Value: View>(label: String, @ViewBuilder value: () -> Value) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      value()
        .lineLimit(1)
        .minimumScaleFactor(0.7)

      Text(label)
        .typeStyle(.meta)
        .foregroundStyle(.mutedForeground)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 12)
    .accessibilityElement(children: .combine)
  }

  private var timeLabel: String {
    let schedule = plan.schedule

    if let weekend = schedule.shape.weekend {
      return String(
        localized: "\(planDurationText(minutes: Double(weekend))) on weekends",
        table: "Onboarding",
        comment: "Under the plan's time a day when weekends have their own time")
    }

    return schedule.weekdayMinutes.allSatisfy { $0 > 0 }
      ? String(
        localized: "a day", table: "Onboarding",
        comment: "Under the plan's time a day, as in \"15 min a day\"")
      : studyDaysText(schedule.weekdayMinutes)
  }

  /// Main's `useRevealPhases`: studying after an exam comes past its finish.
  private var lessons: (total: Int, done: Int) {
    let phases = plan.phases.filter { $0.kind != .afterExam }
    return (phases.reduce(0) { $0 + $1.lessonsTotal }, phases.reduce(0) { $0 + $1.lessonsDone })
  }

  /// Under the number, so it never shows it: one string for one lesson and one for more.
  private var lessonsLabel: String {
    switch (lessons.total == 1, lessons.done > 0) {
    case (true, true):
      String(
        localized: "lesson, \(lessons.done) done", table: "Onboarding",
        comment: "Under the plan's number of lessons when it's one, once it's done")
    case (false, true):
      String(
        localized: "lessons, \(lessons.done) done", table: "Onboarding",
        comment: "Under the plan's number of lessons, once some are done; the argument is how many")
    case (true, false):
      String(
        localized: "lesson", table: "Onboarding",
        comment: "Under the plan's number of lessons when it's one")
    case (false, false):
      String(
        localized: "lessons", table: "Onboarding", comment: "Under the plan's number of lessons")
    }
  }

  private var finish: (value: AnyView, label: String)? {
    let schedule = plan.schedule

    if let targetDate = schedule.targetDate {
      let days = max(0, PlanDate.days(from: plan.today, to: targetDate))
      let text =
        schedule.targetDateEstimated
        ? String(
          localized: "About \(days) days", table: "Onboarding",
          comment: "How long until a goal's estimated date")
        : String(
          localized: "\(days) days", table: "Onboarding", comment: "How long until a goal's date")

      return (
        AnyView(BigQuantity(text)),
        isExam
          ? String(
            localized: "until the exam", table: "Onboarding",
            comment: "Under the days left before the exam on the plan's reveal")
          : String(
            localized: "until your date", table: "Onboarding",
            comment: "Under the days left before the learner's date on the plan's reveal")
      )
    }

    guard let endDate = plan.estimate.endDate, let date = PlanDate.date(endDate) else {
      return nil
    }

    // A language course ends at its aim, so the reveal names the level and when it's reached.
    if let aim = plan.languageAim?.aimAhead {
      return (
        AnyView(Text(verbatim: aim).typeStyle(.readout).monospaced()),
        String(
          localized: "by \(PlanDate.longText(endDate, month: true))", table: "Onboarding",
          comment: "Under the level a language plan reaches, as in 'B1 by Nov 2027'")
      )
    }

    return (
      AnyView(MonthYear(date: date)),
      String(
        localized: "estimated finish", table: "Onboarding",
        comment: "Under the month a plan without a date ends at this pace")
    )
  }
}

/// The month reads first and big, its year small, in the locale's order.
private struct MonthYear: View {
  let date: Date

  var body: some View {
    let parts = date.formatted(
      Date.FormatStyle(timeZone: .gmt).month(.abbreviated).year().attributed)

    HStack(alignment: .firstTextBaseline, spacing: 0) {
      ForEach(Array(parts.runs.enumerated()), id: \.offset) { _, run in
        let text = Text(verbatim: String(parts[run.range].characters))

        if run.dateField == .year {
          text
            .typeStyle(.rowTitle)
            .foregroundStyle(.mutedForeground)
        } else {
          text
            .typeStyle(.readout)
        }
      }
    }
    .accessibilityElement(children: .combine)
  }
}

/// Main's `RevealToday`: the goal's first day as Today will show it, drawn with Today's rows, the
/// next one tagged where to start.
struct RevealToday: View {
  let day: StudyDay

  var body: some View {
    let next = day.nextBlock
    let (before, after) = day.queue(next: next)
    let rows = day.blocks.filter(\.isFinished) + before + (next.map { [$0] } ?? []) + after
    let tag =
      day.blocks.contains(where: \.isFinished)
      ? Text("Up next", tableName: "Onboarding", comment: "Tags the plan's next lesson today")
      : Text("Start here", tableName: "Onboarding", comment: "Tags the plan's first lesson today")

    if !rows.isEmpty {
      Section {
        ForEach(rows, id: \.position) { block in
          let isNext = block.position == next?.position

          BlockRow(
            block: block, view: nil, isNext: isNext, countsTowardMission: false,
            tag: isNext ? tag : nil
          )
          .currentRow(isNext)
        }
      } header: {
        SectionTitle(
          Text("Today", tableName: "Onboarding", comment: "Header over the plan's lessons today")
        ) {
          Text(
            [revealDay(day.localDate), planDurationText(minutes: day.minutes.dailyGoal)]
              .joinedFacts())
        }
      }
    }
  }
}

struct RevealTodayPlaceholder: View {
  var body: some View {
    Section {
      ForEach(0..<3, id: \.self) { _ in
        Text(verbatim: "A lesson of the first day")
          .typeStyle(.rowTitle)
          .redacted(reason: .placeholder)
      }
    } header: {
      SectionTitle(
        Text("Today", tableName: "Onboarding", comment: "Header over the plan's lessons today"))
    }
    .accessibilityHidden(true)
  }
}

/// Main's `RevealWeek`: the six days after today, each day's lessons by name.
struct RevealWeek: View {
  let plan: GoalPlan

  private static let marksShown = 4

  var body: some View {
    let ahead = plan.nextDays.dropFirst().filter { !$0.items.isEmpty || $0.minutes == 0 }

    if ahead.contains(where: { !$0.items.isEmpty }) {
      let studied = plan.nextDays.filter { !$0.items.isEmpty }
      let minutes = studied.reduce(0) { $0 + $1.minutes }

      Section {
        ForEach(ahead) { day in
          row(day)
        }
      } header: {
        SectionTitle(
          Text(
            "Your first week", tableName: "Onboarding",
            comment: "Header over the plan's next seven days")
        ) {
          Text(
            [
              String(
                localized: "\(studied.count) days", table: "Onboarding",
                comment: "How many days of the plan's first week have lessons"),
              planDurationText(minutes: minutes),
            ].joinedFacts())
        }
      }
    }
  }

  private func row(_ day: RevealDay) -> some View {
    let teaching = day.items.filter(\.isTeaching)
    let names = (teaching.isEmpty ? day.items : teaching).map(\.revealTitle)
    let rest = day.items.count - Self.marksShown

    return HStack(alignment: .firstTextBaseline, spacing: 12) {
      Text(revealDay(day.date))
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
        .frame(minWidth: 84, alignment: .leading)

      VStack(alignment: .leading, spacing: 2) {
        if day.items.isEmpty {
          Text("Rest day", tableName: "Onboarding", comment: "A day of the plan with no lessons")
            .foregroundStyle(.mutedForeground)
        } else {
          ForEach(Array(names.enumerated()), id: \.offset) { _, name in
            Text(name)
          }
        }
      }
      .typeStyle(.body)
      .frame(maxWidth: .infinity, alignment: .leading)

      if !day.items.isEmpty {
        HStack(spacing: 4) {
          ForEach(Array(day.items.prefix(Self.marksShown).enumerated()), id: \.offset) { _, item in
            KindMark(kind: item.kind.learnKind)
          }

          if rest > 0 {
            Text(verbatim: "+\(rest)")
              .foregroundStyle(.faint)
          }
        }
        .typeStyle(.small)
        .accessibilityHidden(true)
      }
    }
    .accessibilityElement(children: .combine)
  }
}

/// "Mon, Nov 9", in the locale's order.
private func revealDay(_ isoDate: String) -> String {
  guard let date = PlanDate.date(isoDate) else {
    return isoDate
  }

  return date.formatted(
    Date.FormatStyle(timeZone: .gmt).weekday(.abbreviated).month(.abbreviated).day())
}

extension RevealDay.Item {
  /// Main's `useItemTitle`.
  var revealTitle: String {
    switch kind {
    case .review:
      String(localized: "Review", table: "Onboarding", comment: "A plan day's review")
    case .mock:
      String(localized: "Mock exam", table: "Onboarding", comment: "A plan day's mock exam")
    case .checkpoint, .boss:
      String(localized: "Challenge", table: "Onboarding", comment: "A plan day's challenge")
    case .lesson, .chapter:
      title.isEmpty
        ? String(
          localized: "More lessons", table: "Onboarding",
          comment: "A new plan's chapter whose lessons are still being written")
        : title
    }
  }
}

extension RevealDay.Item.Kind {
  var learnKind: LearnKind {
    switch self {
    case .lesson, .chapter: .lesson
    case .checkpoint, .boss: .challenge
    case .mock: .mock
    case .review: .review
    }
  }
}
