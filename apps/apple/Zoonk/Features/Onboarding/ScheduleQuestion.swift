import SwiftUI

/// Asked once the plan is ready: a goal with a date opens on the time the plan works out it needs,
/// which follows the days until the learner picks their own time.
struct ScheduleQuestion: View {
  let view: GoalOnboarding
  let isSaving: Bool
  let failed: Bool
  let refusal: OnboardingError?
  let onAnswer: ([String: Any]) -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var found = PlanAsking<ScheduleWeek, TimeToCover>()
  @State private var advised = PlanAsking<AdviceKey, TimeAdvice>()
  @State private var picked: Int?
  @State private var fullCourse = false
  @State private var days: [Int]
  @State private var weekendOn = false
  /// The weekend has a time of its own only once one is picked: switched on, it starts as the weekdays'.
  @State private var weekendPicked: Int?

  private struct AdviceKey: Hashable, Sendable {
    let week: ScheduleWeek
    let minutes: Int
  }

  private struct Asked<Key: Hashable>: Hashable {
    let key: Key
    let enabled: Bool
    let round: Int
  }

  /// What the screen shows, worked out once per render.
  private struct Shown {
    let dated: Bool
    /// The plan's ready answer for the days shown.
    let found: TimeToCover?
    /// That answer, else the last ready one while the days shown are asked about.
    let lastFound: TimeToCover?
    let minutes: Int?
    let advice: TimeAdvice?
    let adviceKey: AdviceKey
    let asksAdvice: Bool
    let line: ScheduleTime.Line
  }

  init(
    view: GoalOnboarding,
    isSaving: Bool,
    failed: Bool,
    refusal: OnboardingError?,
    onAnswer: @escaping ([String: Any]) -> Void
  ) {
    self.view = view
    self.isSaving = isSaving
    self.failed = failed
    self.refusal = refusal
    self.onAnswer = onAnswer
    _days = State(initialValue: ScheduleTime.startingDays(view.goal.studyDays))
  }

  var body: some View {
    let shown = self.shown
    let findKey = self.findKey
    let findsTime = datedGuess && !days.isEmpty

    QuestionForm(isSaving: isSaving, failed: failed, failure: refusalWords) {
      StepHeader(
        title: Text(
          "How much time can you study each day?", tableName: "Onboarding",
          comment: "Onboarding question"),
        description: nil)

      Section {
        VStack(alignment: .leading, spacing: 12) {
          timeMenu(shown)
          timeLine(shown)
        }
        .keepsBeforeFold()
        .listRowBackground(Color.clear)
      }

      if isExam, goalDate(shown) != nil, showsFullCourse(shown) {
        Section {
          fullCourseToggle(shown)
        }
      }

      weekSection(shown)

      // While the new days' suggestion is worked out, Continue waits for it.
      StepButtons(canContinue: !days.isEmpty && shown.minutes != nil && !isStale(shown)) {
        submit(shown)
      }
      .environment(\.isSavingAnswer, isSaving || isStale(shown))
    }
    .task(id: Asked(key: findKey, enabled: findsTime, round: found.round)) {
      await found.ask(findKey, when: findsTime) {
        try await onboarding.timeToCover(goalID: view.goal.id, week: findKey)
      }
    }
    .task(id: Asked(key: shown.adviceKey, enabled: shown.asksAdvice, round: advised.round)) {
      let key = shown.adviceKey

      await advised.ask(key, when: shown.asksAdvice) {
        try await onboarding.timeAdvice(
          goalID: view.goal.id, week: key.week, dailyMinutes: key.minutes)
      }
    }
  }

  private var isExam: Bool { view.goal.kind == .exam }

  /// An exam takes its notice's day when the learner gave none.
  private var datedGuess: Bool { view.goal.targetDate != nil || isExam }

  private var studiesOnWeekends: Bool { days.contains(where: ScheduleTime.isWeekend) }

  private var weekend: Int? { studiesOnWeekends && weekendOn ? weekendPicked : nil }

  private var findKey: ScheduleWeek { ScheduleTime.findWeek(days: days, weekend: weekend) }

  private var shown: Shown {
    let findKey = self.findKey
    let lastFound = found.last(for: findKey)
    let current = found.answer(for: findKey)
    let dated = lastFound.map { $0.targetDate != nil } ?? datedGuess
    let findFailed = found.status == .failed

    let minutes = ScheduleTime.shownMinutes(
      fallback: view.recommendedMinutes, first: found.first, found: lastFound, picked: picked,
      settled: !dated || findFailed)

    let adviceKey = AdviceKey(
      week: ScheduleTime.studyWeek(
        days: days, minutes: minutes ?? view.recommendedMinutes, weekend: weekend,
        fullCourse: isExam && fullCourse),
      minutes: minutes ?? view.recommendedMinutes)

    let advice = advised.answer(for: adviceKey)

    return Shown(
      dated: dated, found: current, lastFound: lastFound, minutes: minutes, advice: advice,
      adviceKey: adviceKey,
      asksAdvice: !days.isEmpty
        && ScheduleTime.asksAboutTime(
          dated: dated, found: current, fullCourse: isExam && fullCourse, minutes: minutes),
      line: ScheduleTime.line(
        advice: advice, askFailed: advised.status == .failed, dated: dated,
        findFailed: findFailed, found: current, hasDays: !days.isEmpty, minutes: minutes))
  }

  private func goalDate(_ shown: Shown) -> (isoDate: String, namedMonth: Bool)? {
    guard shown.dated, let time = shown.lastFound, let targetDate = time.targetDate else {
      return nil
    }

    return (targetDate, time.targetDateNamedMonth)
  }

  /// The time shown is still the suggestion for the days before: it shows dimmed, and Continue
  /// waits for the new one.
  private func isStale(_ shown: Shown) -> Bool {
    !days.isEmpty
      && ScheduleTime.waitsForSuggestion(
        failed: found.status == .failed, first: found.first, found: shown.found, picked: picked)
  }

  private var refusalWords: Text? {
    guard case .dayTooShort(let minutes, let goals) = refusal else {
      return nil
    }

    return Text(
      "Choose at least \(duration(minutes)) a day for your \(goals) goals.",
      tableName: "Onboarding",
      comment: "The day's time is shorter than the goals typed together need")
  }

  private func timeMenu(_ shown: Shown) -> some View {
    let minutes = shown.minutes ?? view.recommendedMinutes
    let suggested = ScheduleTime.suggestedMinutes(shown.found)

    return Menu {
      Picker(
        selection: Binding(
          get: { minutes },
          set: {
            picked = ScheduleTime.pickedMinutes(
              first: found.first, found: shown.lastFound, minutes: $0)
          })
      ) {
        ForEach(ScheduleTime.dailyTimes(with: minutes, suggested), id: \.self) { time in
          Text(
            time == suggested
              ? String(
                localized: "\(duration(time)) (suggested)", table: "Onboarding",
                comment: "The time a day the plan suggests, among the times to pick")
              : duration(time)
          )
          .tag(time)
        }
      } label: {
        Text("Time a day", tableName: "Onboarding", comment: "Label of the daily study time picker")
      }
    } label: {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        bigQuantity(duration(minutes))
          .font(.largeTitle.weight(.semibold))
          .monospacedDigit()
          .multilineTextAlignment(.leading)
        Image(systemName: "chevron.down")
          .font(.title3.weight(.semibold))
          .foregroundStyle(.secondary)
      }
      .foregroundStyle(isStale(shown) ? .secondary : .primary)
    }
    .disabled(shown.minutes == nil)
    .redacted(reason: shown.minutes == nil ? .placeholder : [])
    .accessibilityLabel(
      Text("Time a day", tableName: "Onboarding", comment: "Label of the daily study time picker")
    )
    .accessibilityValue(duration(minutes))
  }

  /// What the time shown means, why, and the way back to the suggestion; VoiceOver hears it change.
  private func timeLine(_ shown: Shown) -> some View {
    let failedLine = shown.line == .askFailed || shown.line == .findFailed
    let offer = ScheduleTime.offer(found: shown.found, line: shown.line, minutes: shown.minutes)
    let words = lineWords(shown)

    return VStack(alignment: .leading, spacing: 8) {
      words
        .font(.subheadline)
        .foregroundStyle(.secondary)

      if case .finish = shown.line, let split = splitWords(shown) {
        Text(split)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }

      if failedLine {
        Button {
          if shown.line == .findFailed {
            found.restart()
          } else {
            advised.restart()
          }
        } label: {
          Text("Try again", tableName: "Onboarding", comment: "Asks again what a time covers")
        }
      } else if let offer {
        Button {
          picked = ScheduleTime.pickedMinutes(
            first: found.first, found: shown.found, minutes: offer.minutes)
        } label: {
          offerLabel(offer)
        }
      }
    }
    .buttonStyle(.borderless)
    .font(.subheadline.weight(.semibold))
    .onChange(of: isBusy(shown.line) ? nil : announcement(shown)) { _, line in
      if let line {
        AccessibilityNotification.Announcement(line).post()
      }
    }
  }

  private func isBusy(_ line: ScheduleTime.Line) -> Bool {
    line == .asking || line == .working
  }

  private func offerLabel(_ offer: TimeToCover.Suggested) -> Text {
    switch offer.kind {
    case .everything:
      Text(
        "Cover everything with \(duration(offer.minutes)) a day", tableName: "Onboarding",
        comment: "Picks the time a day that covers the whole goal by its date")
    case .everyTopic:
      Text(
        "Reach every topic with \(duration(offer.minutes)) a day", tableName: "Onboarding",
        comment: "Picks the time a day that brings every topic in by the goal's date")
    }
  }

  private func lineWords(_ shown: Shown) -> Text {
    if case .finish(let endDate) = shown.line {
      let month = PlanDate.longText(endDate, month: true)

      return Text(
        "You finish around \(Text(month).fontWeight(.medium).foregroundStyle(.primary)).",
        tableName: "Onboarding",
        comment:
          "When a goal without a date finishes at the time picked; the argument is a month like 'May 2027'"
      )
    }

    return Text(verbatim: announcement(shown))
  }

  private func announcement(_ shown: Shown) -> String {
    let tooClose = ScheduleTime.tooClose(
      found: shown.found, line: shown.line,
      studiesEveryDay: days.count == ScheduleTime.everyDay.count
    ).map(tooCloseWords)

    return [tooClose, statusWords(shown), splitWords(shown)].compactMap { $0 }.joined(
      separator: " ")
  }

  /// Until every day is a study day, more days bring the time down; only then is the date to blame.
  private func tooCloseWords(_ tooClose: ScheduleTime.TooClose) -> String {
    switch (tooClose.cause, tooClose.recommendedMinutes) {
    case (.days, nil):
      String(
        localized:
          "The days you picked can't cover everything in depth by your date. More study days would help.",
        table: "Onboarding", comment: "No time a day covers the whole goal on the days picked")
    case (.days, let minutes?):
      String(
        localized:
          "Covering everything in depth by your date takes \(duration(minutes)) a day on the days you picked. More study days bring that down.",
        table: "Onboarding",
        comment: "The time a day covering the whole goal by its date on the days picked")
    case (.date, nil):
      String(
        localized: "Your date is too close to cover everything in depth.", table: "Onboarding",
        comment: "No time a day covers the whole goal by its date")
    case (.date, let minutes?):
      String(
        localized:
          "Your date is close: covering everything in depth takes \(duration(minutes)) a day.",
        table: "Onboarding", comment: "The time a day covering the whole goal by its date takes")
    }
  }

  /// The goals typed together share the day's time; the main one weighs most.
  private func splitWords(_ shown: Shown) -> String? {
    guard
      let split = ScheduleTime.daySplit(
        minutes: days.isEmpty ? nil : shown.minutes, count: view.goalIds.count,
        place: max(0, view.goalIds.firstIndex(of: view.goal.id) ?? 0))
    else {
      return nil
    }

    let main = duration(split.mine)
    let other = duration(split.rest)

    return split.others == 1
      ? String(
        localized: "This goal gets \(main) a day and your other goal \(other).",
        table: "Onboarding", comment: "How the day's time splits between two goals typed together")
      : String(
        localized: "This goal gets \(main) a day and your other goals \(other) together.",
        table: "Onboarding",
        comment: "How the day's time splits between three or more goals typed together")
  }

  private func statusWords(_ shown: Shown) -> String? {
    let time = duration(shown.minutes ?? view.recommendedMinutes)
    let goal = goalDate(shown)
    let date = goal.map { PlanDate.longText($0.isoDate, month: $0.namedMonth) }
    let namedMonth = goal?.namedMonth == true

    switch shown.line {
    case .everything(let suggested):
      return date.map { date in
        switch (suggested, isExam, namedMonth) {
        case (true, true, false):
          String(
            localized: "What it takes to cover all your exam topics by \(date).",
            table: "Onboarding",
            comment:
              "Why the time a day the plan suggests for an exam; the argument is a date like 'May 5, 2027'"
          )
        case (true, true, true):
          String(
            localized: "What it takes to cover all your exam topics by the start of \(date).",
            table: "Onboarding",
            comment:
              "Why the time a day the plan suggests for an exam; the argument is the month the learner named, like 'May 2027'"
          )
        case (true, false, false):
          String(
            localized: "What it takes to cover your whole goal by \(date).", table: "Onboarding",
            comment:
              "Why the time a day the plan suggests for a goal; the argument is a date like 'May 5, 2027'"
          )
        case (true, false, true):
          String(
            localized: "What it takes to cover your whole goal by the start of \(date).",
            table: "Onboarding",
            comment:
              "Why the time a day the plan suggests for a goal; the argument is the month the learner named, like 'May 2027'"
          )
        case (false, true, false):
          String(
            localized: "Covers all your exam topics by \(date).", table: "Onboarding",
            comment:
              "The time a day picked covers a whole exam; the argument is a date like 'May 5, 2027'"
          )
        case (false, true, true):
          String(
            localized: "Covers all your exam topics by the start of \(date).", table: "Onboarding",
            comment:
              "The time a day picked covers a whole exam; the argument is the month the learner named, like 'May 2027'"
          )
        case (false, false, false):
          String(
            localized: "Covers your whole goal by \(date).", table: "Onboarding",
            comment:
              "The time a day picked covers a whole goal; the argument is a date like 'May 5, 2027'"
          )
        case (false, false, true):
          String(
            localized: "Covers your whole goal by the start of \(date).", table: "Onboarding",
            comment:
              "The time a day picked covers a whole goal; the argument is the month the learner named, like 'May 2027'"
          )
        }
      }
    case .everyTopic:
      return date.map { date in
        switch (isExam, namedMonth) {
        case (true, false):
          String(
            localized: "Reaches every exam topic by \(date), some in less depth.",
            table: "Onboarding",
            comment:
              "The time a day brings every exam topic in; the argument is a date like 'May 5, 2027'"
          )
        case (true, true):
          String(
            localized: "Reaches every exam topic by the start of \(date), some in less depth.",
            table: "Onboarding",
            comment:
              "The time a day brings every exam topic in; the argument is the month the learner named, like 'May 2027'"
          )
        case (false, false):
          String(
            localized: "Reaches every part of your goal by \(date), some in less depth.",
            table: "Onboarding",
            comment:
              "The time a day brings every part of a goal in; the argument is a date like 'May 5, 2027'"
          )
        case (false, true):
          String(
            localized:
              "Reaches every part of your goal by the start of \(date), some in less depth.",
            table: "Onboarding",
            comment:
              "The time a day brings every part of a goal in; the argument is the month the learner named, like 'May 2027'"
          )
        }
      }
    case .share(let share):
      let percent = share.formatted(.percent.precision(.fractionLength(0)))

      return date.map { date in
        switch (isExam, namedMonth) {
        case (true, false):
          String(
            localized:
              "Covers about \(percent) of your exam topics in depth by \(date), what comes up most first.",
            table: "Onboarding",
            comment:
              "The share of an exam the time a day covers by its date; the second argument is a date like 'May 5, 2027'"
          )
        case (true, true):
          String(
            localized:
              "Covers about \(percent) of your exam topics in depth by the start of \(date), what comes up most first.",
            table: "Onboarding",
            comment:
              "The share of an exam the time a day covers by its date; the second argument is the month the learner named, like 'May 2027'"
          )
        case (false, false):
          String(
            localized:
              "Covers about \(percent) of your goal in depth by \(date), what matters most first.",
            table: "Onboarding",
            comment:
              "The share of a goal the time a day covers by its date; the second argument is a date like 'May 5, 2027'"
          )
        case (false, true):
          String(
            localized:
              "Covers about \(percent) of your goal in depth by the start of \(date), what matters most first.",
            table: "Onboarding",
            comment:
              "The share of a goal the time a day covers by its date; the second argument is the month the learner named, like 'May 2027'"
          )
        }
      }
    case .pastDate:
      return date.map { date in
        namedMonth
          ? String(
            localized:
              "Your date, the start of \(date), has passed. You can choose a new one on the next screen.",
            table: "Onboarding",
            comment:
              "The goal's date has passed; the argument is the month the learner named, like 'May 2027'"
          )
          : String(
            localized:
              "Your date, \(date), has passed. You can choose a new one on the next screen.",
            table: "Onboarding",
            comment: "The goal's date has passed; the argument is a date like 'May 5, 2027'")
      }
    case .finish(let endDate):
      return String(
        localized: "You finish around \(PlanDate.longText(endDate, month: true)).",
        table: "Onboarding",
        comment:
          "When a goal without a date finishes at the time picked; the argument is a month like 'May 2027'"
      )
    case .noFinish:
      return String(
        localized:
          "We can't estimate a finish date for this schedule. Try more time or more study days.",
        table: "Onboarding", comment: "No finish date fits the time and days picked")
    case .noDays:
      return String(
        localized: "Choose at least one study day.", table: "Onboarding",
        comment: "No study day is picked")
    case .working:
      return String(
        localized: "Working out the time your goal needs…", table: "Onboarding",
        comment: "While the plan works out the time a day a goal needs")
    case .findFailed:
      return String(
        localized: "We couldn't work out the time your goal needs.", table: "Onboarding",
        comment: "The time a day a goal needs couldn't be worked out")
    case .asking:
      return date == nil
        ? String(
          localized: "Working out when you'd finish…", table: "Onboarding",
          comment: "While the plan works out when a goal without a date finishes")
        : String(
          localized: "Working out what \(time) a day covers…", table: "Onboarding",
          comment: "While the plan works out what a time a day covers")
    case .askFailed:
      return date == nil
        ? String(
          localized: "We couldn't work out when you'd finish.", table: "Onboarding",
          comment: "When a goal without a date finishes couldn't be worked out")
        : String(
          localized: "We couldn't work out what \(time) a day covers.", table: "Onboarding",
          comment: "What a time a day covers couldn't be read")
    }
  }

  /// An exam's switch shows while the time falls short, and stays while it's on.
  private func showsFullCourse(_ shown: Shown) -> Bool {
    let short: Bool =
      switch shown.line {
      case .share, .everyTopic: true
      default: false
      }

    return short || ScheduleTime.keepsFullCourse(checked: fullCourse, line: shown.line)
  }

  private func fullCourseToggle(_ shown: Shown) -> some View {
    Toggle(isOn: $fullCourse) {
      Text(
        "Study everything, even after the exam", tableName: "Onboarding",
        comment: "Switch for an exam plan that goes on after the exam")

      if fullCourse {
        Text(fullCourseText(shown))
      }
    }
    .tint(.success)
  }

  private func fullCourseText(_ shown: Shown) -> String {
    guard let end = shown.advice?.fullCourseEndDate, let minutes = shown.minutes,
      let date = goalDate(shown)
    else {
      return String(
        localized:
          "Until the exam, what comes up most comes first. What doesn't fit comes after it.",
        table: "Onboarding", comment: "What an exam plan that studies everything does")
    }

    let time = duration(minutes)
    let finishMonth = PlanDate.longText(end, month: true)
    let exam = PlanDate.longText(date.isoDate, month: date.namedMonth)
    let finish =
      date.namedMonth
      ? String(
        localized: "At \(time) a day, you finish in \(finishMonth), after the exam in \(exam).",
        table: "Onboarding",
        comment:
          "When an exam plan that studies everything ends; the second and third arguments are months like 'May 2027'"
      )
      : String(
        localized: "At \(time) a day, you finish in \(finishMonth), after the exam on \(exam).",
        table: "Onboarding",
        comment:
          "When an exam plan that studies everything ends; the second argument is a month like 'May 2027', the third a date like 'May 5, 2027'"
      )

    let until = String(
      localized: "Until the exam, what comes up most comes first.", table: "Onboarding",
      comment: "What an exam plan that studies everything does before the exam")

    return "\(finish) \(until)"
  }

  private func weekSection(_ shown: Shown) -> some View {
    Section {
      ForEach(orderedDays, id: \.self) { day in
        Toggle(
          Calendar.current.standaloneWeekdaySymbols[day],
          isOn: Binding(
            get: { days.contains(day) },
            set: { on in
              days = on ? (days + [day]).sorted() : days.filter { $0 != day }
            }))
      }

      if studiesOnWeekends {
        Toggle(
          isOn: Binding(
            get: { weekendOn },
            set: { on in
              weekendOn = on
              weekendPicked = nil
            })
        ) {
          Text(
            "Different time on weekends", tableName: "Onboarding",
            comment: "Switch giving Saturday and Sunday their own study time")
        }

        if weekendOn {
          let current = weekendPicked ?? shown.minutes ?? view.recommendedMinutes

          Picker(selection: Binding(get: { current }, set: { weekendPicked = $0 })) {
            ForEach(ScheduleTime.dailyTimes(with: current), id: \.self) { time in
              Text(duration(time))
                .tag(time)
            }
          } label: {
            Text(
              "Time on weekends", tableName: "Onboarding",
              comment: "Picks the weekend's own time a day")
          }
          .pickerStyle(.menu)
        }
      }
    } header: {
      Text(
        "Study days", tableName: "Onboarding", comment: "Header over the days the learner studies")
    }
    .tint(.success)
  }

  private var orderedDays: [Int] {
    let first = Calendar.current.firstWeekday - 1
    return ScheduleTime.everyDay.map { (first + $0) % 7 }
  }

  private func submit(_ shown: Shown) {
    guard let minutes = shown.minutes else {
      return
    }

    var input: [String: Any] = [
      "dailyMinutes": minutes, "question": "schedule", "timeZone": TimeZone.current.identifier,
    ]

    if days.count < ScheduleTime.everyDay.count {
      input["studyDays"] = days
    }

    if let weekend {
      input["weekendMinutes"] = weekend
    }

    if isExam {
      input["fullCourse"] = ScheduleTime.keepsFullCourse(checked: fullCourse, line: shown.line)
    }

    onAnswer(input)
  }

  private func duration(_ minutes: Int) -> String {
    planDurationText(minutes: Double(minutes))
  }
}
