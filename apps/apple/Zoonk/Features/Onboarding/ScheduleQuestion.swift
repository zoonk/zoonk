import SwiftUI

/// Asked once the plan can answer it, the plan's wait shown until then: a goal with a date opens on
/// the time the plan works out it needs, which follows the days until the learner picks their own
/// time.
struct ScheduleQuestion: View {
  /// What the learner set here before leaving to change their date.
  struct Draft {
    let days: [Int]
    let fullCourse: Bool
    let picked: Int?
    let weekendOn: Bool
    let weekendPicked: Int?
  }

  let view: GoalOnboarding
  let isSaving: Bool
  let failed: Bool
  let refusal: OnboardingError?
  let onAnswer: ([String: Any]) -> Void
  let onChangeDate: (Draft) -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @Environment(PlanStore.self) private var plans
  @Environment(\.isPaneSplit) private var isBesidePlan
  @Environment(\.onboardingAside) private var aside
  @State private var found = PlanAsking<FindKey, TimeToCover, ContinuousClock>()
  @State private var advised = PlanAsking<AdviceKey, TimeAdvice, ContinuousClock>()
  @State private var picked: Int?
  @State private var fullCourse: Bool
  @State private var days: [Int]
  @State private var weekendOn: Bool
  /// The weekend has a time of its own only once one is picked: switched on, it starts as the weekdays'.
  @State private var weekendPicked: Int?
  @State private var changesAim = false
  /// What the plan's wait heard from the run: its plan made, then the run ended.
  @State private var planMade = false
  @State private var runEnded = false

  /// The answers are for the goal's date too, so a date saved meanwhile, such as from another
  /// window, asks them again and keeps what the learner set.
  private struct FindKey: Hashable, Sendable {
    let week: ScheduleWeek
    let date: String?
    /// A language goal's aim re-plans, so a new one asks again.
    let aim: String?
  }

  private struct AdviceKey: Hashable, Sendable {
    let week: ScheduleWeek
    let minutes: Int
    let date: String?
    let aim: String?
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
    /// The answer on screen: the last one, updating, while the time shown is worked out again.
    let answer: ScheduleTime.Answer
    let updating: Bool
  }

  init(
    view: GoalOnboarding,
    draft: Draft?,
    isSaving: Bool,
    failed: Bool,
    refusal: OnboardingError?,
    onAnswer: @escaping ([String: Any]) -> Void,
    onChangeDate: @escaping (Draft) -> Void
  ) {
    self.view = view
    self.isSaving = isSaving
    self.failed = failed
    self.refusal = refusal
    self.onAnswer = onAnswer
    self.onChangeDate = onChangeDate
    _days = State(initialValue: draft?.days ?? ScheduleTime.startingDays(view.goal.studyDays))
    _weekendOn = State(initialValue: draft?.weekendOn ?? false)
    _weekendPicked = State(initialValue: draft?.weekendPicked)
    _picked = State(initialValue: draft?.picked)
    _fullCourse = State(initialValue: draft?.fullCourse ?? false)
  }

  /// What the plan's answers say of it, as main's gate reads them: when the goal has no date, the
  /// advice asks next, so the time found says it until the advice comes.
  private struct Gate {
    let last: PlanReadiness?
    let failed: Bool
    let restart: () -> Void
  }

  var body: some View {
    let shown = self.shown
    let findKey = self.findKey
    let gate = gate(shown)
    let wait = ScheduleTime.wait(
      opened: PlanReadiness(view.planReadiness), last: gate.last, runEnded: runEnded)
    // While the wait follows the plan's run, its events say when to ask, not a timer.
    let asks = wait != .building || planMade || runEnded
    let findsTime = asks && datedGuess && !days.isEmpty
    let asksAdvice = asks && shown.asksAdvice

    PlanWaits(wait: wait) { holding in
      PlanBuilding(
        view: view,
        next: .timeQuestion,
        holding: holding,
        readResult: {
          planMade = true
          return true
        },
        onRunEnd: { runEnded = true },
        reconnect: gate.failed ? gate.restart : nil)
    } notice: { holding in
      NoticeReadingView(
        document: examDocument, lastEdition: false, generationID: view.generationId,
        goalID: view.goal.id, next: .timeQuestion, holding: holding,
        reconnect: gate.failed ? gate.restart : nil)
    } ready: {
      question(shown)
        .onboardingColumn()
        .questionShown(.schedule, of: view)
    }
    .task(id: Asked(key: findKey, enabled: findsTime, round: found.round)) {
      await found.ask(findKey, when: findsTime) {
        try await onboarding.timeToCover(goalID: view.goal.id, week: findKey.week)
      }
    }
    .task(id: Asked(key: shown.adviceKey, enabled: asksAdvice, round: advised.round)) {
      let key = shown.adviceKey

      await advised.ask(key, when: asksAdvice) {
        try await onboarding.timeAdvice(
          goalID: view.goal.id, week: key.week, dailyMinutes: key.minutes)
      }
    }
  }

  private func question(_ shown: Shown) -> some View {
    QuestionForm(isSaving: isSaving, failed: failed, failure: refusalWords) {
      // The date and its days left inform the time to pick.
      StepHeader(
        title: Text(
          "How much time can you study each day?", tableName: "Onboarding",
          comment: "Onboarding question"),
        description: isBesidePlan ? nil : aside?.planFacts.map { Text(PlanFact.chips($0)) })

      if let languageAim = view.languageAimView, let aim = languageAim.aim,
        !languageAim.choices.isEmpty
      {
        aimSection(aim: aim, languageAim: languageAim, shown: shown)
          .locksWhileSaving()
      }

      // The days decide the time, and what the time covers arrives last, so nothing above it moves.
      weekSection(shown)
        .locksWhileSaving()

      Section {
        VStack(alignment: .leading, spacing: 12) {
          timeMenu(shown)

          VStack(alignment: .leading, spacing: 0) {
            timeAnswer(shown)
            dateLink(shown)
          }
        }
        .keepsBeforeHinge()
        .listRowBackground(Color.clear)
      } header: {
        // The picker carries the name for VoiceOver; this is its visible title.
        SectionTitle(
          Text(
            "Time a day", tableName: "Onboarding", comment: "Label of the daily study time picker")
        )
        .accessibilityHidden(true)
      }
      .locksWhileSaving()

      if isExam, goalDate(shown) != nil, showsFullCourse(shown) {
        Section {
          fullCourseToggle(shown)
        }
        .locksWhileSaving()
      }

      StepButtons(
        canContinue: ScheduleTime.canContinue(
          hasDays: !days.isEmpty, minutes: shown.minutes, line: shown.line, picked: picked),
        continueLabel: Text(
          "See your plan", tableName: "Onboarding",
          comment: "Answers the time question, the last one, and shows the plan")
      ) {
        submit(shown)
      }
      .environment(
        \.isSavingAnswer,
        isSaving || ScheduleTime.waitsToSave(line: shown.line, picked: picked))
    }
  }

  private func gate(_ shown: Shown) -> Gate {
    guard shown.dated else {
      return Gate(
        last: advised.readiness(for: shown.adviceKey) ?? found.readiness(for: findKey),
        failed: advised.status == .failed, restart: advised.restart)
    }

    return Gate(
      last: found.readiness(for: findKey), failed: found.status == .failed, restart: found.restart)
  }

  private var isExam: Bool { view.goal.kind == .exam }

  /// Main's `getExamDocument`.
  private var examDocument: ExamDocument {
    isExam && view.goal.targetLanguage != nil ? .guide : .notice
  }

  /// An exam takes its notice's day when the learner gave none.
  private var datedGuess: Bool { view.goal.targetDate != nil || isExam }

  private var studiesOnWeekends: Bool { days.contains(where: ScheduleTime.isWeekend) }

  private var weekend: Int? { studiesOnWeekends && weekendOn ? weekendPicked : nil }

  private var findKey: FindKey {
    FindKey(
      week: ScheduleTime.findWeek(days: days, weekend: weekend), date: view.goal.targetDate,
      aim: view.languageAimView?.aim)
  }

  private var timeChoices: [TimeChoice] { view.timeChoices.map(TimeChoice.init) }

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
      minutes: minutes ?? view.recommendedMinutes, date: view.goal.targetDate,
      aim: view.languageAimView?.aim)

    let advice = advised.answer(for: adviceKey)

    let lineAt = { (advice: TimeAdvice?, found: TimeToCover?) in
      ScheduleTime.line(
        advice: advice, askFailed: advised.status == .failed, dated: dated,
        findFailed: findFailed, found: found, hasDays: !days.isEmpty, minutes: minutes)
    }

    let line = lineAt(advice, current)

    let (answer, updating) = ScheduleTime.shownAnswer(
      last: .init(found: lastFound, line: lineAt(advised.last(for: adviceKey), lastFound)),
      now: .init(found: current, line: line))

    return Shown(
      dated: dated, found: current, lastFound: lastFound, minutes: minutes, advice: advice,
      adviceKey: adviceKey,
      asksAdvice: !days.isEmpty
        && ScheduleTime.asksAboutTime(
          dated: dated, found: current, fullCourse: isExam && fullCourse, minutes: minutes),
      line: line, answer: answer, updating: updating)
  }

  private func goalDate(_ shown: Shown) -> TimeAnswer.GoalDate? {
    guard shown.dated, let time = shown.lastFound, let targetDate = time.targetDate else {
      return nil
    }

    return TimeAnswer.GoalDate(isoDate: targetDate, namedMonth: time.targetDateNamedMonth)
  }

  /// The time shown is still the suggestion for the days before: it shows dimmed, and Continue
  /// waits for the new one.
  private func isStale(_ shown: Shown) -> Bool {
    !days.isEmpty
      && ScheduleTime.waitsForSuggestion(
        failed: found.status == .failed, first: found.first, found: shown.found, picked: picked)
  }

  private var refusalWords: String? {
    guard case .dayTooShort(let minutes, let goals) = refusal else {
      return nil
    }

    return String(
      localized: "Choose at least \(duration(minutes)) a day for your \(goals) goals.",
      table: "Onboarding",
      comment: "The day's time is shorter than the goals typed together need")
  }

  private func timeMenu(_ shown: Shown) -> some View {
    let minutes = shown.minutes ?? view.recommendedMinutes
    let marked = ScheduleTime.markedTimes(shown.found)

    return Menu {
      Picker(
        selection: Binding(
          get: { minutes },
          set: {
            picked = ScheduleTime.pickedMinutes(
              first: found.first, found: shown.lastFound, minutes: $0)
          })
      ) {
        ForEach(
          ScheduleTime.dailyTimes(
            timeChoices.map(\.minutes), with: minutes, marked.suggested, marked.full),
          id: \.self
        ) { time in
          Text(TimeAnswer.choiceLabel(time, full: marked.full, suggested: marked.suggested))
            .tag(time)
        }
      } label: {
        Text("Time a day", tableName: "Onboarding", comment: "Label of the daily study time picker")
      }
    } label: {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        bigQuantity(duration(minutes))
          .typeStyle(.momentReadout)
          .multilineTextAlignment(.leading)
        Image(systemName: "chevron.down")
          .typeStyle(.section)
          .foregroundStyle(.mutedForeground)
      }
      .foregroundStyle(isStale(shown) ? .mutedForeground : .primary)
    }
    .disabled(shown.minutes == nil)
    .redacted(reason: shown.minutes == nil ? .placeholder : [])
    .accessibilityLabel(
      Text("Time a day", tableName: "Onboarding", comment: "Label of the daily study time picker")
    )
    .accessibilityValue(duration(minutes))
  }

  /// Main's `ScheduleAim`: the aim sizes the course, so it sits by the time it's reached in, one tap
  /// from changing.
  private func aimSection(aim: String, languageAim: LanguageAimView, shown: Shown) -> some View {
    Section {
      HStack(spacing: 12) {
        VStack(alignment: .leading, spacing: 2) {
          Text(
            "Your aim", tableName: "Onboarding",
            comment:
              "The language level a course goes up to, like B1. Not the learner's goal: the level they aim for."
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)

          AimName(aim: aim)
            .typeStyle(.rowTitle)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)

        Button {
          changesAim = true
        } label: {
          Text(
            "Change", tableName: "Onboarding",
            comment: "Opens the levels a language course can aim for")
        }
        .buttonStyle(.outline)
        .controlSize(.small)
      }
    }
    .sheet(isPresented: $changesAim) {
      AimChoicesSheet(
        languageAim: languageAim,
        fromLine: shown.minutes.map { aimFromLine(level: levelDetail, minutes: $0) },
        planEnd: finishDate(shown),
        today: GoalDate.today(now: .now, timeZone: view.goal.timezone)
      ) { picked in
        await changeAim(picked)
      }
      .zoonkStyles()
    }
  }

  private var levelDetail: String? {
    struct Details: Decodable {
      let level: String?
    }

    return (try? PracticeJSON.recode(view.goal.details, as: Details.self))?.level
  }

  private func finishDate(_ shown: Shown) -> String? {
    if case .finish(let endDate) = shown.answer.line {
      return endDate
    }

    return nil
  }

  /// The change re-plans, so the question's answers are read again for the new aim.
  private func changeAim(_ aim: String) async -> Bool {
    switch await plans.change(goalId: view.goal.id, edits: [.aim(aim)]) {
    case .done(.applied), .done(.unchanged), .done(.undone):
      await onboarding.onboarding(goalID: view.goal.id).refresh()
      return true
    case .done(.invalid), .failed, .obsolete:
      return false
    }
  }

  private func timeAnswer(_ shown: Shown) -> some View {
    let answer = shown.answer

    return TimeAnswer(
      date: goalDate(shown), exam: isExam, line: answer.line, minutes: shown.minutes,
      note: ScheduleTime.fullTimeNote(
        found: answer.found, line: answer.line,
        studiesEveryDay: days.count == ScheduleTime.everyDay.count),
      offer: ScheduleTime.offer(found: answer.found, line: answer.line, minutes: shown.minutes),
      split: days.isEmpty
        ? nil
        : ScheduleTime.split(
          minutes: shown.minutes, choices: timeChoices, answers: Array(found.answers.values)),
      updating: shown.updating,
      aim: view.languageAimView?.aimAhead
    ) {
      if found.status == .failed {
        found.restart()
      } else {
        advised.restart()
      }
    } onUseOffer: { minutes in
      picked = ScheduleTime.pickedMinutes(first: found.first, found: shown.found, minutes: minutes)
    }
  }

  private func dateLink(_ shown: Shown) -> some View {
    Button {
      onChangeDate(
        Draft(
          days: days, fullCourse: fullCourse, picked: picked, weekendOn: weekendOn,
          weekendPicked: weekendPicked))
    } label: {
      (shown.dated
        ? Text(
          "Change date", tableName: "Onboarding",
          comment: "Opens the date question from the daily time question, for a goal with a date")
        : Text(
          "Choose a date", tableName: "Onboarding",
          comment: "Opens the date question from the daily time question, for a goal without a date"
        ))
        .underline()
        .multilineTextAlignment(.leading)
        .frame(minHeight: 44)
        .contentShape(.rect)
    }
    .typeStyle(.body)
    .buttonStyle(.borderless)
  }

  /// An exam's switch shows while the time falls short, and stays while it's on.
  private func showsFullCourse(_ shown: Shown) -> Bool {
    let short: Bool =
      switch shown.answer.line {
      case .share, .focus: true
      default: false
      }

    return short || ScheduleTime.keepsFullCourse(checked: fullCourse, line: shown.answer.line)
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

    return [finish, until].joinedSentences()
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
            ForEach(ScheduleTime.dailyTimes(timeChoices.map(\.minutes), with: current), id: \.self)
            { time in
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
      SectionTitle(
        Text(
          "Study days", tableName: "Onboarding", comment: "Header over the days the learner studies"
        ))
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
