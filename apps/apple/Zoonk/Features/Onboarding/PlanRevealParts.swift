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
        Chip(
          Text(
            "Plan created", tableName: "Onboarding",
            comment: "Eyebrow over a goal whose plan was just built"),
          tone: .success)

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

/// Main's `RevealReadouts`: the time a day and when it ends, side by side.
struct RevealReadouts: View {
  let plan: GoalPlan
  let isExam: Bool

  var body: some View {
    HStack(alignment: .top, spacing: 0) {
      readout(label: timeLabel) {
        BigQuantity(planDurationText(minutes: Double(plan.schedule.shape.weekdays)))
      }
      .padding(.trailing, 12)

      if let finish {
        Divider()
        readout(label: finish.label) {
          finish.value
        }
        .padding(.leading, 12)
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
    let parts = PlanDate.monthAndYear(date)

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
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(String(parts.characters))
  }
}

/// Main's `RevealToday`: the goal's first day as Today will show it, drawn with Today's rows, the
/// next one tagged where to start. A step still to do opens from its row, as on Today.
struct RevealToday: View {
  let day: StudyDay
  /// What `day` lists, in minutes.
  let minutes: Int
  /// The position of the row opening, or of the one that failed to.
  let busy: Int?
  let failed: Int?
  /// Nil while Start opens.
  let open: ((StudyBlock) -> Void)?
  /// Inside the first week's section, as main nests it, its header is a row of that section.
  var isInWeek = false
  /// Today's own fold: the first few lessons, the rest behind one row, so the list fits a screen.
  @State private var showsMore = false

  var body: some View {
    let next = day.nextBlock
    let (before, after) = day.queue(next: next)
    let shown = showsMore ? after : Array(after.prefix(StudyDay.upcomingRows))
    let rows = day.blocks.filter(\.isFinished) + before + (next.map { [$0] } ?? []) + shown
    let tag =
      day.blocks.contains(where: \.isFinished)
      ? Text("Up next", tableName: "Onboarding", comment: "Tags the plan's next lesson today")
      : Text("Start here", tableName: "Onboarding", comment: "Tags the plan's first lesson today")

    if !rows.isEmpty {
      if isInWeek {
        header
          .listRowSeparator(.hidden)

        list(rows, next: next, tag: tag)
        fold(after)
      } else {
        Section {
          list(rows, next: next, tag: tag)
          fold(after)
        } header: {
          header
        }
      }
    }
  }

  func inWeek() -> RevealToday {
    var today = self
    today.isInWeek = true
    return today
  }

  private var header: some View {
    SectionTitle(
      Text("Today", tableName: "Onboarding", comment: "Header over the plan's lessons today")
    ) {
      FactSegments(
        [
          PlanDate.text(day.localDate, today: day.localDate, weekday: true),
          planDurationText(minutes: Double(minutes)),
        ])
    }
  }

  @ViewBuilder
  private func fold(_ after: [StudyBlock]) -> some View {
    if after.count > StudyDay.upcomingRows {
      DayFoldRow(
        isOpen: $showsMore, isDone: false, count: after.count - StudyDay.upcomingRows,
        more: StudyDay.moreLabel(
          hidden: Array(after.dropFirst(StudyDay.upcomingRows)), lessonsAhead: false),
        minutes: nil)
    }
  }

  private func list(_ rows: [StudyBlock], next: StudyBlock?, tag: Text) -> some View {
    ForEach(rows, id: \.position) { block in
      let isNext = block.position == next?.position
      let row = BlockRow(
        block: block, view: nil, isNext: isNext, countsTowardMission: false,
        isBusy: busy == block.position, failed: failed == block.position,
        tag: isNext ? tag : nil)

      Group {
        if block.opensFromReveal {
          Button {
            open?(block)
          } label: {
            row
          }
          .tint(.primary)
          .disabled(open == nil || (busy != nil && busy != block.position))
          .accessibilityBusy(busy == block.position)
        } else {
          row
        }
      }
      .currentRow(isNext)
    }
  }
}

extension StudyBlock {
  var opensFromReveal: Bool {
    !isFinished && waitReason == nil
  }
}

/// The rest of the week's shape while the reveal's days load, so nothing under it moves as they come.
struct RevealWeekPlaceholder: View {
  var body: some View {
    Section {
      revealPlaceholderRows
    } header: {
      SectionTitle(
        Text(
          "Your first week", tableName: "Onboarding",
          comment: "Header over the plan's next seven days")
      ) {
        revealPlaceholderFacts
      }
    }
    .accessibilityHidden(true)
  }
}

/// Today's lessons while the reveal's days load, holding their place.
struct RevealTodayPlaceholder: View {
  var body: some View {
    Section {
      revealPlaceholderRows
    } header: {
      SectionTitle(
        Text("Today", tableName: "Onboarding", comment: "Header over the plan's lessons today")
      ) {
        revealPlaceholderFacts
      }
    }
    .accessibilityHidden(true)
  }
}

@MainActor private var revealPlaceholderRows: some View {
  ForEach(0..<3, id: \.self) { _ in
    Text(verbatim: "A lesson of the first day")
      .typeStyle(.rowTitle)
      .redacted(reason: .placeholder)
  }
}

@MainActor private var revealPlaceholderFacts: some View {
  FactSegments(["Mon, Nov 17", "30 min"])
    .redacted(reason: .placeholder)
}

/// Main's `RevealWeek`: the week the learner is in, Today first, then the six days after it, each
/// one line: how many lessons, anything else it holds and how long. The names wait for the Plan.
struct RevealWeek: View {
  let days: [RevealDay]
  let week: PlanRevealRead.Week
  var today: RevealToday?

  @Environment(\.stacksContent) private var isStacked
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibility

  var body: some View {
    if week.days == 0 {
      today
    } else {
      Section {
        today?.inWeek()

        ForEach(days) { day in
          row(day)
        }
      } header: {
        SectionTitle(
          Text(
            "Your first week", tableName: "Onboarding",
            comment: "Header over the plan's next seven days")
        ) {
          FactSegments(
            [
              String(
                localized: "\(week.days) study days", table: "Onboarding",
                comment: "How many days of the plan's first week have lessons, today among them"),
              planDurationText(minutes: Double(week.minutes)),
            ])
        }
      }
    }
  }

  private func dateText(_ day: RevealDay) -> String {
    PlanDate.text(day.date, today: PlanDate.today(), weekday: true)
  }

  /// One column for the dates, as wide as the longest, so every day's lessons start on one edge.
  private var dateWidth: CGFloat {
    days.map {
      TypeStyle.data.width(
        of: dateText($0), dynamicTypeSize: dynamicTypeSize, legibility: legibility)
    }.max() ?? 0
  }

  @ViewBuilder
  private func row(_ day: RevealDay) -> some View {
    let date = Text(dateText(day))
      .layoutPart(.lead)
      .typeStyle(.data)
      .foregroundStyle(.mutedForeground)

    Group {
      if isStacked {
        VStack(alignment: .leading, spacing: 2) {
          date
          summary(day)
        }
      } else {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
          date
            .frame(width: dateWidth, alignment: .leading)

          summary(day)
        }
      }
    }
    .layoutRow(.listGroup)
    .accessibilityElement(children: .combine)
  }

  private func summary(_ day: RevealDay) -> some View {
    let lessons = day.items.reduce(0) { $0 + $1.lessons }
    var others: [String] = []

    for item in day.items where !item.isTeaching && !others.contains(item.revealTitle) {
      others.append(item.revealTitle)
    }

    let facts =
      (lessons > 0
        ? [
          String(
            localized: "\(lessons) lessons", table: "Plan",
            comment: "How many lessons a day of a new plan has")
        ] : [])
      + others + (day.minutes > 0 ? [planDurationText(minutes: day.minutes)] : [])

    return Group {
      if day.items.isEmpty {
        Text("Rest day", tableName: "Onboarding", comment: "A day of the plan with no lessons")
          .foregroundStyle(.mutedForeground)
          .layoutPart(.label)
      } else {
        FactSegments(facts)
          .layoutPart(.label)
      }
    }
    .typeStyle(.body)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
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
