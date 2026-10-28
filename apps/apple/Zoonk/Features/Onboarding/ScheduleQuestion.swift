import SwiftUI

/// How much time a day and on which days (main's `ScheduleStep`). It comes after placement, once the plan knows what the learner already knows. With a date to cover the goal by, the estimate says what the time picked covers, and follows every pick; while that's less than everything, "Find the time that covers everything" plans the goal at each time, only when the learner asks, and marks the time it finds without picking it. An exam can also study everything, even after the exam; any other goal moves its date on the next screen. The days and the weekend's own time are one tap away.
struct ScheduleQuestion: View {
  let view: GoalOnboarding
  let onAnswer: ([String: Any]) -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var minutes: Int
  @State private var weekendMinutes: Int?
  @State private var days: Set<Int>
  @State private var fullCourse = false
  /// The plan's last answer, with the week and time it was for.
  @State private var answer: AdviceAnswer?
  @State private var asking = Asking.asking
  /// Asking again after it stopped.
  @State private var attempt = 0
  @State private var finding = Finding.idle

  private struct AdviceAnswer: Equatable {
    let advice: TimeAdvice
    let week: ScheduleWeek
    let minutes: Int
  }

  private enum Asking {
    case asking
    case answered
    case stopped
  }

  /// "Find the time that covers everything" for the week it was asked for.
  private enum Finding: Equatable {
    case idle
    case pending(ScheduleWeek)
    case answered(ScheduleWeek, TimeToCover)
    case building(ScheduleWeek)
    case failed(ScheduleWeek)

    var week: ScheduleWeek? {
      switch self {
      case .idle: nil
      case .pending(let week), .answered(let week, _), .building(let week), .failed(let week): week
      }
    }
  }

  private struct AskKey: Hashable {
    let week: ScheduleWeek
    let minutes: Int
    let attempt: Int
  }

  /// Main's times a day: a short habit to a full study day for a big exam.
  private static let presets = [15, 30, 45, 60, 90, 120, 180, 240]
  /// Every time a day "Other time" offers: quarter hours up to 4 hours, then half hours to a day.
  private static let everyTime =
    Array(stride(from: 15, through: 240, by: 15))
    + Array(stride(from: 270, through: 1440, by: 30))
  private static let weekdays: Set<Int> = [1, 2, 3, 4, 5]
  private static let weekend: Set<Int> = [0, 6]

  init(view: GoalOnboarding, onAnswer: @escaping ([String: Any]) -> Void) {
    self.view = view
    self.onAnswer = onAnswer
    _minutes = State(initialValue: view.recommendedMinutes)
    let goalDays = view.goal.studyDays
    _days = State(
      initialValue: !goalDays.isEmpty && goalDays.count < 7 ? Set(goalDays) : Self.weekdays)
  }

  var body: some View {
    let share = pickedShare

    StepHeader(
      subject: nil,
      title: Text(
        "How much time can you study each day?", tableName: "Onboarding",
        comment: "Onboarding question"),
      description: nil)

    Section {
      Picker(selection: $minutes) {
        ForEach(choices, id: \.self) { value in
          if let note = note(for: value) {
            Text(duration(value)).badge(note)
              .tag(value)
          } else {
            Text(duration(value))
              .tag(value)
          }
        }
      } label: {
        Text(
          "Minutes a day", tableName: "Onboarding", comment: "Label of the daily study time picker")
      }
      .pickerStyle(.inline)
      .labelsHidden()

      Picker(selection: $minutes) {
        ForEach(Self.withShown(minutes), id: \.self) { value in
          Text(duration(value)).tag(value)
        }
      } label: {
        Text(
          "Other time a day", tableName: "Onboarding",
          comment: "Picks any time a day the presets don't have")
      }
      .pickerStyle(.menu)
    }

    if dated {
      estimate(share)
    }

    coverEverything(share)

    Section {
      DisclosureGroup {
        ForEach(orderedDays, id: \.self) { day in
          Toggle(
            isOn: Binding(
              get: { days.contains(day) },
              set: { isOn in
                if isOn {
                  days.insert(day)
                } else {
                  days.remove(day)
                }
              })
          ) {
            Text(Calendar.current.standaloneWeekdaySymbols[day])
          }
        }

        if studiesOnWeekends {
          Picker(selection: weekendBinding) {
            ForEach(Self.withShown(weekendMinutes ?? minutes), id: \.self) { value in
              Text(duration(value)).tag(value)
            }
          } label: {
            Text(
              "Minutes on weekends", tableName: "Onboarding",
              comment: "Picks the weekend's own time a day")
          }
          .pickerStyle(.menu)
        }
      } label: {
        LabeledContent {
          Text(
            "\(days.count) days · \(duration(weeklyMinutes)) a week",
            tableName: "Onboarding",
            comment: "How many days the learner studies and their time a week")
        } label: {
          Text(
            "Which days?", tableName: "Onboarding",
            comment: "Opens the days of the week the learner studies")
        }
      }
    }
    .task(id: AskKey(week: week, minutes: minutes, attempt: attempt)) {
      await ask()
    }

    StepButtons(canContinue: !days.isEmpty) {
      var input: [String: Any] = [
        "dailyMinutes": minutes, "question": "schedule", "timeZone": TimeZone.current.identifier,
      ]

      if days.count < 7 {
        input["studyDays"] = days.sorted()
      }

      if let weekend = week.weekendMinutes {
        input["weekendMinutes"] = weekend
      }

      if isExam {
        input["fullCourse"] = studiesEverything(share)
      }

      onAnswer(input)
    }
  }

  // MARK: The estimate

  /// What the time picked covers by the date; while another time is asked about, the last share, dimmed.
  @ViewBuilder
  private func estimate(_ share: (known: Bool, value: Double?)) -> some View {
    let stopped = !share.known && asking == .stopped
    let shown = share.known ? share.value : lastAdvice?.coveredShare

    if !(share.known && share.value == nil) {
      Section {
        if stopped {
          VStack(alignment: .leading, spacing: 8) {
            Text(
              "We couldn't work out what \(duration(minutes)) a day covers.",
              tableName: "Onboarding", comment: "What a time a day covers couldn't be read")
            Button {
              attempt += 1
            } label: {
              Text("Try again", tableName: "Onboarding", comment: "Asks again what a time covers")
            }
          }
        }

        if let shown, let advice = lastAdvice {
          VStack(alignment: .leading, spacing: 10) {
            if stopped, let last = answer?.minutes {
              Text(
                "Last estimate, for \(duration(last)) a day", tableName: "Onboarding",
                comment: "Over the estimate kept for another time a day"
              )
              .font(.caption)
              .foregroundStyle(.secondary)
            }

            estimateWords(advice: advice, share: shown)
            ProgressView(value: shown)
              .tint(.success)
              .accessibilityHidden(true)
          }
          .opacity(share.known ? 1 : 0.6)
        } else if !stopped {
          HStack(spacing: 8) {
            ProgressView()
            Text(
              "Working out what your time covers…", tableName: "Onboarding",
              comment: "While the plan works out what a time a day covers"
            )
            .foregroundStyle(.secondary)
          }
        }
      } header: {
        Text("Estimate", tableName: "Onboarding", comment: "Header over what a time a day covers")
      }
    }
  }

  private func estimateWords(advice: TimeAdvice, share: Double) -> Text {
    let percent = share.formatted(.percent.precision(.fractionLength(0)))
    let date =
      advice.targetDate.map {
        PlanDate.longText($0, month: advice.targetDateNamedMonth)
      } ?? ""

    if share >= 1 {
      return advice.measure == "exam"
        ? Text(
          "\(percent) of the plan's exam topics in depth by \(date).", tableName: "Onboarding",
          comment: "What a time a day covers of an exam: all of it, by the date")
        : Text(
          "\(percent) of your goal in depth by \(date).", tableName: "Onboarding",
          comment: "What a time a day covers of a goal: all of it, by the date")
    }

    return advice.measure == "exam"
      ? Text(
        "~\(percent) of the plan's exam topics in depth by \(date), what comes up most first.",
        tableName: "Onboarding", comment: "What a time a day covers of an exam by its date")
      : Text(
        "~\(percent) of your goal in depth by \(date), what matters most first.",
        tableName: "Onboarding", comment: "What a time a day covers of a goal by its date")
  }

  // MARK: Covering everything

  /// What studying everything would take, only while the time picked leaves something out (or before that's known): the time that covers it, then an exam's switch to go on after the exam, or that any other goal moves its date next.
  @ViewBuilder
  private func coverEverything(_ share: (known: Bool, value: Double?)) -> some View {
    let shown = share.known ? share.value : lastAdvice?.coveredShare
    let short = shown.map { $0 < 1 } ?? false

    if !dated {
      Section {
      } footer: {
        Text(
          "You can change this anytime.", tableName: "Onboarding",
          comment: "Under the time a day of a goal without a date")
      }
    } else if shown == nil || short || (isExam && studiesEverything(share)) {
      Section {
        if shown == nil || short {
          findLine
        }

        if isExam {
          Toggle(isOn: $fullCourse) {
            Text(
              "Study everything, even after the exam", tableName: "Onboarding",
              comment: "Switch for an exam plan that goes on after the exam")
            Text(fullCourseText)
          }
        } else if short {
          Text(
            "To cover everything at \(duration(minutes)) a day, move your date on the next screen.",
            tableName: "Onboarding",
            comment: "How a goal whose time leaves something out covers it all"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
      }
    }
  }

  /// "Find the time that covers everything", its search and its answer; while the plan is still built, that it's being built.
  @ViewBuilder
  private var findLine: some View {
    if !planReady {
      Text(
        answer?.advice.readingNotice == true
          ? String(
            localized: "Reading the exam's official documents first…", table: "Onboarding",
            comment: "While an exam's plan waits for its official documents")
          : String(
            localized: "Building your plan…", table: "Onboarding",
            comment: "While the plan the time question asks about is built")
      )
      .foregroundStyle(.secondary)
    } else {
      switch currentFinding {
      case .idle:
        Button {
          Task { await find() }
        } label: {
          Text(
            "Find the time that covers everything", tableName: "Onboarding",
            comment: "Works out the time a day that covers the whole goal by its date")
        }
      case .pending:
        HStack(spacing: 8) {
          ProgressView()
          Text("Finding the time…", tableName: "Onboarding", comment: "While the time is found")
            .foregroundStyle(.secondary)
        }
      case .answered(_, let found):
        foundWords(found)
      case .building:
        retryLine(
          Text(
            "Your plan is still being built. Try again in a moment.", tableName: "Onboarding",
            comment: "The time can't be found before the plan is built"))
      case .failed:
        retryLine(
          Text(
            "We couldn't work out the time needed.", tableName: "Onboarding",
            comment: "Finding the time that covers everything failed"))
      }
    }
  }

  private func retryLine(_ message: Text) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      message
        .foregroundStyle(.secondary)
      Button {
        Task { await find() }
      } label: {
        Text("Try again", tableName: "Onboarding", comment: "Asks again what a time covers")
      }
    }
  }

  /// The time that covers everything in depth by the date, or that no time does, with the time that studies every topic.
  @ViewBuilder
  private func foundWords(_ found: TimeToCover) -> some View {
    if let targetDate = found.targetDate {
      let date = PlanDate.longText(targetDate, month: found.targetDateNamedMonth)

      if let covering = found.recommendedMinutes {
        Text(
          "\(duration(covering)) a day covers everything in depth by \(date).",
          tableName: "Onboarding", comment: "The time a day found that covers the whole goal"
        )
        .fontWeight(.medium)
      } else {
        VStack(alignment: .leading, spacing: 4) {
          Text(
            "No amount of time a day covers everything in depth by \(date).",
            tableName: "Onboarding", comment: "No time a day covers the whole goal by its date")

          if let core = found.coreMinutes {
            Text(
              "\(duration(core)) a day studies every topic, some in less depth.",
              tableName: "Onboarding", comment: "The time a day that studies every topic")
          }
        }
        .foregroundStyle(.secondary)
      }
    }
  }

  /// What studying everything does: when it ends, once the plan says so for the time picked, and that until the exam what comes up most comes first.
  private var fullCourseText: String {
    let until = String(
      localized: "Until the exam, what comes up most comes first.", table: "Onboarding",
      comment: "What an exam plan that studies everything does before the exam")

    guard fullCourse, let advice = currentAdvice, answer?.minutes == minutes,
      let end = advice.fullCourseEndDate, let targetDate = advice.targetDate
    else {
      return String(
        localized:
          "Until the exam, what comes up most comes first. What doesn't fit comes after it.",
        table: "Onboarding", comment: "What an exam plan that studies everything does")
    }

    let finish = String(
      localized:
        "At \(duration(minutes)) a day, you finish in \(PlanDate.longText(end, month: true)), after the exam on \(PlanDate.longText(targetDate, month: advice.targetDateNamedMonth)).",
      table: "Onboarding", comment: "When an exam plan that studies everything ends")

    return "\(finish) \(until)"
  }

  // MARK: State

  private var isExam: Bool { view.goal.kind == .exam }

  /// The goal has a date (its own, or its exam's) to cover it by.
  private var dated: Bool { view.goal.targetDate != nil || isExam }

  private var studiesOnWeekends: Bool { !days.isDisjoint(with: Self.weekend) }

  /// The weekend's own time counts only while it differs from the weekdays'.
  private var week: ScheduleWeek {
    let weekend = studiesOnWeekends ? weekendMinutes.flatMap { $0 == minutes ? nil : $0 } : nil
    return ScheduleWeek(
      studyDays: days.sorted(), weekendMinutes: weekend, fullCourse: isExam && fullCourse)
  }

  /// The week Find searches: the days and any weekend time the learner set, whatever the time a day.
  private var findWeek: ScheduleWeek {
    ScheduleWeek(studyDays: days.sorted(), weekendMinutes: studiesOnWeekends ? weekendMinutes : nil)
  }

  private var weekendBinding: Binding<Int> {
    Binding(get: { weekendMinutes ?? minutes }, set: { weekendMinutes = $0 })
  }

  private var weeklyMinutes: Int {
    days.reduce(0) { total, day in
      total + (Self.weekend.contains(day) ? (week.weekendMinutes ?? minutes) : minutes)
    }
  }

  /// The plan's answer for this week, once it's ready.
  private var currentAdvice: TimeAdvice? {
    guard let answer, answer.week == week, answer.advice.ready else {
      return nil
    }

    return answer.advice
  }

  /// The last ready answer, for any week, to keep showing while another is asked about.
  private var lastAdvice: TimeAdvice? {
    answer?.advice.ready == true ? answer?.advice : nil
  }

  private var currentFinding: Finding {
    finding.week == findWeek ? finding : .idle
  }

  private var found: TimeToCover? {
    if case .answered(_, let found) = currentFinding {
      return found
    }

    return nil
  }

  /// What the time picked covers, and whether that's known: the plan's answer for this very time, or the time Find found (all of it).
  private var pickedShare: (known: Bool, value: Double?) {
    guard let advice = currentAdvice else {
      return (false, nil)
    }

    if answer?.minutes == minutes {
      return (true, advice.coveredShare)
    }

    if let found, found.recommendedMinutes == minutes {
      return (true, 1)
    }

    return (false, nil)
  }

  /// The plan said it's built, or asking stopped: Find can answer.
  private var planReady: Bool {
    answer?.advice.ready == true || asking == .stopped
  }

  /// An exam's choice to study everything stands until the time picked is known to cover everything.
  private func studiesEverything(_ share: (known: Bool, value: Double?)) -> Bool {
    fullCourse && !(share.known && (share.value ?? 0) >= 1)
  }

  /// The presets, with the time picked and the time Find offers among them.
  private var choices: [Int] {
    Set(Self.presets + [minutes, offeredMinutes].compactMap { $0 }).sorted()
  }

  /// The time Find offers: the one that covers everything, or else the one that studies every topic.
  private var offeredMinutes: Int? {
    found.flatMap { $0.recommendedMinutes ?? $0.coreMinutes }
  }

  private func note(for value: Int) -> Text? {
    guard let found, value == offeredMinutes else {
      return nil
    }

    return found.recommendedMinutes == nil
      ? Text(
        "Every topic", tableName: "Onboarding", comment: "Marks the time that studies every topic")
      : Text(
        "Covers everything", tableName: "Onboarding",
        comment: "Marks the time that covers the whole goal")
  }

  /// The week as the learner's calendar starts it.
  private var orderedDays: [Int] {
    let first = Calendar.current.firstWeekday - 1
    return (0..<7).map { (first + $0) % 7 }
  }

  private static func withShown(_ minutes: Int) -> [Int] {
    everyTime.contains(minutes) ? everyTime : (everyTime + [minutes]).sorted()
  }

  private func duration(_ minutes: Int) -> String {
    Duration.seconds(minutes * 60).formatted(.units(allowed: [.hours, .minutes], width: .wide))
  }

  // MARK: Asking

  /// Asks the plan what the time picked covers in the week shown, again after each change; the plan may still be built, so it asks until it's ready, and says so when asking keeps failing or runs too long.
  private func ask() async {
    guard dated, !pickedShare.known else {
      return
    }

    let week = week
    let minutes = minutes
    asking = .asking
    var failures = 0

    // About two minutes, as long as any onboarding wait.
    for _ in 0..<40 {
      do {
        let advice = try await onboarding.timeAdvice(
          goalID: view.goal.id, week: week, dailyMinutes: minutes)
        answer = AdviceAnswer(advice: advice, week: week, minutes: minutes)
        failures = 0

        if advice.ready {
          asking = .answered
          return
        }
      } catch is CancellationError {
        return
      } catch {
        failures += 1

        if failures == 3 {
          break
        }
      }

      do {
        try await Task.sleep(for: .seconds(3))
      } catch {
        return
      }
    }

    asking = .stopped
  }

  /// Plans the goal at each time a day for the week shown, only when the learner asks.
  private func find() async {
    let week = findWeek
    finding = .pending(week)

    let result = try? await onboarding.timeToCover(goalID: view.goal.id, week: week)

    guard finding == .pending(week) else {
      return
    }

    switch result {
    case .some(let time) where time.ready:
      finding = .answered(week, time)
    case .some:
      finding = .building(week)
    case nil:
      finding = .failed(week)
    }
  }
}
