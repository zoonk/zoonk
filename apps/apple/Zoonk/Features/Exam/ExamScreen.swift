import Charts
import SwiftUI

/// How ready the learner is lives on the Plan, so it isn't repeated here.
struct ExamScreen: View {
  @Environment(ExamStore.self) private var store
  @Environment(LearnerSummaryStore.self) private var learner

  var body: some View {
    Group {
      if let goalId = learner.summary.value?.activeGoalID {
        ExamContent(exam: store.exam(goalId: goalId), options: store.mockOptions(goalId: goalId))
      }
    }
  }
}

private struct ExamContent: View {
  let exam: Resource<ExamView>
  let options: Resource<MockOptions>

  var body: some View {
    content
      .loads(exam, options)
  }

  @ViewBuilder
  private var content: some View {
    switch exam.state {
    case .idle, .loading:
      ProgressView()
        .navigationTitle(Text("Your exam", tableName: "Exam", comment: "Exam page title"))
    case .empty, .failed(.notFound):
      ContentUnavailableView {
        Label {
          Text("Your exam", tableName: "Exam", comment: "Exam page title")
        } icon: {
          Image(systemName: "graduationcap")
        }
      } description: {
        Text(
          "Your exam's areas, how ready you are for each, and its mock exams.", tableName: "Exam",
          comment: "What the exam page shows, for a goal that isn't an exam")
      }
    case .failed:
      ContentUnavailableView {
        Label {
          Text("Your exam didn't load", tableName: "Exam", comment: "Loading the exam failed")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } actions: {
        Button {
          Task { await exam.refresh() }
        } label: {
          Text("Try again", tableName: "Exam", comment: "Button to retry loading")
        }
        .buttonStyle(.bordered)
      }
    case .loaded(let view):
      ExamList(exam: view, options: options.value)
    }
  }
}

private struct ExamList: View {
  let exam: ExamView
  let options: MockOptions?
  /// Above the split: folding iPhone Duo recreates its panes, and the result form and the speaking
  /// mock's start are in one.
  @State private var result = ExamResultForm()
  @State private var callStart = CallStart()
  @State private var isReporting = false

  var body: some View {
    PaneSplit(primaryShare: 0.55) {
      List {
        moment
        ExamProgressSection(exam: exam)
      }
    } secondary: {
      List {
        ExamMocksSection(exam: exam, options: options)
        whatsOnIt
        ExamSpeakingSection(exam: exam, callStart: callStart)
        ExamScoringSection(exam: exam)
      }
    } single: {
      List {
        moment
        ExamMocksSection(exam: exam, options: options)
        ExamProgressSection(exam: exam)
        whatsOnIt
        ExamSpeakingSection(exam: exam, callStart: callStart)
        ExamScoringSection(exam: exam)
      }
    }
    .onDisappear {
      callStart.cancel()
    }
    .navigationTitle(exam.examName)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Button {
            isReporting = true
          } label: {
            Label {
              Text(
                "Report a problem", tableName: "Exam",
                comment: "Opens the feedback form about the exam page")
            } icon: {
              Image(systemName: "flag")
            }
          }
        } label: {
          Label {
            Text("Exam options", tableName: "Exam", comment: "Spoken label of the exam's … menu")
          } icon: {
            Image(systemName: "ellipsis")
          }
        }
      }
    }
    .sheet(isPresented: $isReporting) {
      FeedbackSheet(
        api: FeedbackAPI.live(), context: FeedbackContext(screen: "exam"), isReport: true)
    }
  }

  @ViewBuilder
  private var moment: some View {
    ExamHero(exam: exam, options: options)
    ExamMomentSection(exam: exam)

    if exam.takesResult {
      ExamResultSection(exam: exam, form: $result)
    }
  }

  @ViewBuilder
  private var whatsOnIt: some View {
    if !exam.format.isEmpty {
      ExamFormatSection(exam: exam)
    } else if let map = exam.map, !map.subjects.isEmpty {
      ExamMapSection(map: map)
    }
  }
}

private struct ExamHero: View {
  @Environment(\.dynamicTypeSize) private var typeSize
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var plan
  @State private var usingDate = false
  @State private var dateFailed = false
  let exam: ExamView
  let options: MockOptions?

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 6) {
        eyebrow
          .font(.caption.monospaced())
          .foregroundStyle(.secondary)
        if !facts.isEmpty {
          Text(facts.joined(separator: " · "))
            .font(.subheadline.monospacedDigit())
        }
      }
      .accessibilityElement(children: .combine)

      if let options, options.offersMock {
        Button {
          if let running = options.running {
            router.open(.mock(blockId: running.id))
          } else {
            router.open(.mockChooser)
          }
        } label: {
          HStack {
            Label {
              if options.running != nil {
                Text("Continue your mock exam", tableName: "Exam", comment: "A running mock")
              } else {
                Text("Take a mock exam", tableName: "Exam", comment: "Opens the mock chooser")
              }
            } icon: {
              if !typeSize.isAccessibilitySize {
                Image(systemName: "timer")
              }
            }
            if options.access == .plusRequired, options.running == nil {
              PlusMark()
            }
          }
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .listRowSeparator(.hidden)
      }
    } footer: {
      if let note = dateNote {
        Text(note)
      }
    }

    if let noticeDay = exam.noticeDay, let date = studyDate(noticeDay.date) {
      Section {
        VStack(alignment: .leading, spacing: 8) {
          let day = date.formatted(.studyDay.weekday(.wide).month(.wide).day())
          if noticeDay.estimated {
            Text(
              "The exam's likely date is now \(day).", tableName: "Exam",
              comment:
                "The exam's likely day, while the notice isn't out; the argument is a date like 'Tuesday, May 5'"
            )
          } else if exam.examDocument == .notice {
            Text(
              "The exam notice says \(day).", tableName: "Exam",
              comment: "The notice's day; the argument is a date like 'Tuesday, May 5'")
          } else {
            Text(
              "The exam's official calendar says \(day).", tableName: "Exam",
              comment: "The official calendar's day; the argument is a date like 'Tuesday, May 5'")
          }
          if dateFailed {
            Text(
              "That didn't go through. Try again in a moment.", tableName: "Exam",
              comment: "Changing the date failed"
            )
            .foregroundStyle(.destructive)
          }
          Button {
            Task { await useDate(noticeDay.date) }
          } label: {
            Text("Use this date", tableName: "Exam", comment: "Moves the plan to the notice's day")
          }
          .buttonStyle(.bordered)
          .disabled(usingDate)
        }
      }
    }

    noSittingSection
  }

  @ViewBuilder
  private var noSittingSection: some View {
    if exam.noticeDay == nil, let noSitting = exam.noSitting, let month = studyDate(noSitting.month)
    {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text(
            "No exam date in \(month.formatted(.studyDay.month(.wide)))", tableName: "Exam",
            comment:
              "An exam with no sitting in the learner's month; the argument is a month like 'May'"
          )
          .font(.headline)
          Group {
            if noSitting.closest.count == 1 {
              Text(
                "Your plan keeps your date unless you switch to the closest one.",
                tableName: "Exam", comment: "One closest sitting to pick")
            } else {
              Text(
                "Your plan keeps your date unless you switch to one of the closest.",
                tableName: "Exam", comment: "The closest sittings to pick from")
            }
          }
          .foregroundStyle(.secondary)
        }

        ForEach(noSitting.closest, id: \.self) { closest in
          if let date = studyDate(closest) {
            Button {
              Task { await useDate(closest) }
            } label: {
              Text(
                "Use \(date.formatted(.studyDay.month(.wide).day().year()))", tableName: "Exam",
                comment:
                  "Moves the plan to one of the closest sittings; the argument is its date, like 'May 5, 2027'"
              )
            }
            .disabled(usingDate)
          }
        }

        if dateFailed {
          Text(
            "That didn't go through. Try again in a moment.", tableName: "Exam",
            comment: "Changing the date failed"
          )
          .foregroundStyle(.destructive)
        }
      }
    }
  }

  private var eyebrow: Text {
    guard let days = exam.daysLeft, days > 0 else {
      return Text("Exam", tableName: "Exam", comment: "Eyebrow over the exam's name")
    }

    return exam.daysEstimated
      ? Text("Exam · About \(days) days left", tableName: "Exam", comment: "Estimated days left")
      : Text("Exam · \(days) days left", tableName: "Exam", comment: "Days left to the exam")
  }

  private var facts: [String] {
    let dates = exam.days.compactMap { day in studyDate(day.date).map { (day, $0) } }

    if exam.namedMonth {
      return dates.map { $0.1.formatted(.studyDay.month(.wide).year()) }
    }

    let times = Set(exam.days.map(\.startTime))
    let shared = times.count == 1 ? exam.days.first?.startTime : nil
    // The Plan's date rule: the year shows beyond the next twelve months.
    let farOff = Calendar.current.date(byAdding: .year, value: 1, to: .now) ?? .now
    let days = dates.map { day, date in
      var style = Date.FormatStyle.studyDay.month(.abbreviated).day()
      if dates.count == 1 { style = style.weekday(.abbreviated) }
      if date > farOff { style = style.year() }
      let text = date.formatted(style)
      let time = shared == nil ? day.startTime.flatMap(timeOfDay) : nil
      return time.map { "\(text) · \($0)" } ?? text
    }

    var facts = times.count > 1 ? days : (days.isEmpty ? [] : [days.formatted(.list(type: .and))])

    if let shared, let time = timeOfDay(shared) {
      facts.append(time)
    }

    if exam.daysEstimated, !exam.namedMonth {
      facts.append(
        String(
          localized: "estimated from past editions", table: "Exam",
          comment: "The exam's days are an estimate"))
    }

    return facts
  }

  private var dateNote: String? {
    guard !exam.days.isEmpty else { return nil }
    let notice = exam.examDocument == .notice

    if exam.namedMonth {
      guard exam.noticeDay == nil else { return nil }
      return notice
        ? String(
          localized: "The month you told us. We'll tell you the day once the notice sets it.",
          table: "Exam", comment: "A named month, before the notice")
        : String(
          localized:
            "The month you told us. We'll tell you the day once the official calendar sets it.",
          table: "Exam", comment: "A named month, before the calendar")
    }

    guard exam.daysEstimated else { return nil }
    return notice
      ? String(
        localized: "Estimated from past editions. We'll tell you when the official notice is out.",
        table: "Exam", comment: "Estimated days, before the notice")
      : String(
        localized: "Estimated from past editions. We'll tell you when the official dates are out.",
        table: "Exam", comment: "Estimated days, before the calendar")
  }

  private func timeOfDay(_ text: String) -> String? {
    let parts = text.split(separator: ":").compactMap { Int($0) }
    guard parts.count >= 2,
      let date = Calendar(identifier: .gregorian).date(
        from: DateComponents(
          timeZone: .gmt, year: 2000, month: 1, day: 1, hour: parts[0], minute: parts[1]))
    else {
      return nil
    }

    var style = Date.FormatStyle(timeZone: .gmt).hour().minute()
    style.calendar.timeZone = .gmt
    return date.formatted(style)
  }

  private func useDate(_ date: String) async {
    usingDate = true
    dateFailed = false
    defer { usingDate = false }

    switch await plan.change(goalId: exam.goalId, edits: [.targetDate(date)]) {
    case .done(.applied), .done(.undone), .done(.unchanged), .obsolete: break
    case .done(.invalid), .failed: dateFailed = true
    }
  }
}

/// Calm, and never a promise.
private struct ExamMomentSection: View {
  let exam: ExamView

  var body: some View {
    if let copy {
      Section {
        Label {
          VStack(alignment: .leading, spacing: 4) {
            Text(copy.title).font(.headline)
            if exam.stage != .afterExam, let day = exam.days.first,
              let date = studyDate(day.date)
            {
              Text(date.formatted(.studyDay.weekday(.wide).month(.wide).day().year()))
                .font(.subheadline.monospacedDigit())
            }
            Text(copy.body)
              .foregroundStyle(.secondary)
          }
        } icon: {
          Image(systemName: icon)
        }

        if exam.stage == .dayBefore || exam.stage == .examDay {
          ForEach(exam.checklist, id: \.self) { item in
            Label {
              Text(checklistLabel(item))
            } icon: {
              Image(systemName: "checklist")
            }
          }
        }
      } footer: {
        if exam.stage == .dayBefore || exam.stage == .examDay, !exam.tools.isEmpty {
          Text(
            "What you may use: \(exam.tools.formatted(.list(type: .and)))", tableName: "Exam",
            comment: "The tools the exam allows")
        }
      }
    }
  }

  private var icon: String {
    switch exam.stage {
    case .dayBefore: "moon"
    case .examDay: "calendar"
    default: "flag"
    }
  }

  private var copy: (title: String, body: String)? {
    switch exam.stage {
    case .finalStretch:
      (
        String(localized: "The final stretch", table: "Exam", comment: "The exam's last weeks"),
        String(
          localized:
            "The last days before the exam go to mixed review and mock exams. New topics wait, unless they weigh a lot and are quick.",
          table: "Exam", comment: "What the final stretch does")
      )
    case .dayBefore:
      (
        String(
          localized: "\(exam.examName) is tomorrow", table: "Exam", comment: "The day before"),
        dayBeforeBody
      )
    case .examDay:
      (
        String(localized: "\(exam.examName) is today", table: "Exam", comment: "Exam day"),
        work
      )
    case .preparing, .afterExam:
      nil
    }
  }

  private var work: String {
    let done =
      exam.mocks.isEmpty
      ? String(
        localized: "You did \(exam.sessionsDone) sessions.", table: "Exam",
        comment: "Sessions done before the exam")
      : String(
        localized: "You did \(exam.sessionsDone) sessions and \(exam.mocks.count) mock exams.",
        table: "Exam", comment: "Sessions and mocks done before the exam")

    return exam.prepared
      ? "\(done) \(String(localized: "You've prepared for this.", table: "Exam", comment: "Prepared"))"
      : done
  }

  private var dayBeforeBody: String {
    switch exam.dayBefore {
    case .mock:
      String(
        localized: "Today is your short mock, then a look at what it finds. Then rest. \(work)",
        table: "Exam", comment: "The day before: a mock")
    case .learnAndMock:
      String(
        localized: "Today goes to the topics that come up most, then a short mock. Then rest.",
        table: "Exam", comment: "The day before: learn and a mock")
    case .learn:
      String(
        localized: "Today goes to the topics that come up most. Then rest.", table: "Exam",
        comment: "The day before: learn")
    case .review:
      String(
        localized:
          "Today is a full review of every topic, in your test's format, your weakest first. Then rest. \(work)",
        table: "Exam", comment: "The day before: a full review")
    case .light:
      String(
        localized: "Today is a short, light review. Then rest. \(work)", table: "Exam",
        comment: "The day before: light review")
    }
  }

  private func checklistLabel(_ item: ExamView.ChecklistItem) -> String {
    switch item {
    case .documents:
      String(
        localized: "Photo ID and your registration card", table: "Exam", comment: "Checklist")
    case .blackPen:
      String(localized: "A black pen with a clear barrel", table: "Exam", comment: "Checklist")
    case .route:
      String(localized: "Your route there, with time to spare", table: "Exam", comment: "Checklist")
    case .examTime:
      String(
        localized: "When the gates close and the exam starts", table: "Exam", comment: "Checklist")
    case .sleep:
      String(localized: "A good night's sleep", table: "Exam", comment: "Checklist")
    case .materials:
      String(
        localized: "What your teacher lets you bring, like a pen or a calculator", table: "Exam",
        comment: "Checklist")
    }
  }
}

/// The score is optional and so is knowing whether they passed; either is enough.
private struct ExamResultSection: View {
  @Environment(ExamStore.self) private var store
  let exam: ExamView
  @Binding var form: ExamResultForm

  private var scale: String {
    exam.scoring.scale?.rawValue ?? (exam.scoring.method == .irt ? "irt" : "points")
  }

  private var parsedScore: Double? {
    Double(form.score.replacingOccurrences(of: ",", with: "."))
  }

  var body: some View {
    Section {
      if form.saved || exam.result != nil {
        Label {
          if let value = exam.result?.score, !form.saved || parsedScore == nil {
            Text(
              "Result saved: \(MockLabels.number(value)). Thank you for telling us.",
              tableName: "Exam", comment: "A reported result")
          } else if form.saved, let parsedScore {
            Text(
              "Result saved: \(MockLabels.number(parsedScore)). Thank you for telling us.",
              tableName: "Exam", comment: "A reported result")
          } else {
            Text(
              "Result saved. Thank you for telling us.", tableName: "Exam",
              comment: "A reported result without a score")
          }
        } icon: {
          Image(systemName: "checkmark.circle.fill").foregroundStyle(.success)
        }
      }

      TextField(text: $form.score) {
        scoreLabel
      }
      .keyboardType(.decimalPad)

      if scale == "points" {
        TextField(text: $form.maxScore) {
          Text("out of", tableName: "Exam", comment: "The score's maximum")
        }
        .keyboardType(.decimalPad)
      }

      Picker(selection: $form.passed) {
        Text("Yes", tableName: "Exam", comment: "Passed").tag(ExamResultForm.Passed.yes)
        Text("No", tableName: "Exam", comment: "Didn't pass").tag(ExamResultForm.Passed.no)
        Text("Not yet", tableName: "Exam", comment: "Doesn't know yet")
          .tag(ExamResultForm.Passed.unknown)
      } label: {
        Text("Did you pass?", tableName: "Exam", comment: "Asks whether the learner passed")
      }

      if form.failed {
        Text(
          "That didn't go through. Try again in a moment.", tableName: "Exam",
          comment: "Saving the result failed"
        )
        .foregroundStyle(.destructive)
      }

      Button {
        Task { await save() }
      } label: {
        Text("Save my result", tableName: "Exam", comment: "Saves the official result")
      }
      .disabled(form.saving || (parsedScore == nil && form.passed == .unknown))
    } header: {
      Text("How did it go?", tableName: "Exam", comment: "Asks for the official result")
    } footer: {
      Text(
        "Add your official result when it comes out. You can change it later.", tableName: "Exam",
        comment: "Under the official result form")
    }
  }

  private var scoreLabel: Text {
    switch scale {
    case "ap": Text("Your AP score (1 to 5)", tableName: "Exam", comment: "AP score field")
    case "irt":
      Text(
        "Your score (the average, if there are several)", tableName: "Exam",
        comment: "IRT score field")
    case "sat": Text("Your total score (400 to 1600)", tableName: "Exam", comment: "SAT field")
    case "toefl": Text("Your total band (1 to 6)", tableName: "Exam", comment: "TOEFL field")
    default: Text("Your score", tableName: "Exam", comment: "Score field")
    }
  }

  private func save() async {
    form.saving = true
    form.failed = false
    defer { form.saving = false }

    let input = ExamResultInput(
      maxScore: scale == "points"
        ? Double(form.maxScore.replacingOccurrences(of: ",", with: ".")) : nil,
      passed: form.passed == .unknown ? nil : form.passed == .yes,
      scale: parsedScore == nil ? nil : scale,
      score: parsedScore)
    let goalId = exam.goalId

    switch await store.write(
      invalidating: [.learnerModel],
      { api, token in
        try await api.reportResult(token: token, goalId: goalId, input: input)
      })
    {
    case .done(true): form.saved = true
    case .done(false), .failed: form.failed = true
    case .obsolete: break
    }
  }
}

private struct ExamResultForm {
  enum Passed: Hashable {
    case yes
    case no
    case unknown
  }

  var score = ""
  var maxScore = ""
  var passed = Passed.unknown
  var saving = false
  var saved = false
  var failed = false
}

private struct ExamMocksSection: View {
  @Environment(AppRouter.self) private var router
  let exam: ExamView
  let options: MockOptions?

  var body: some View {
    if !exam.runningMocks.isEmpty || exam.nextMock != nil || !exam.mocks.isEmpty
      || exam.mocksRequirePlus
    {
      Section {
        ForEach(exam.runningMocks) { mock in
          Button {
            router.open(.mock(blockId: mock.id))
          } label: {
            LabeledContent {
              if let deadline = mock.deadline, deadline > .now {
                Text(timerInterval: Date.now...deadline, countsDown: true)
                  .monospacedDigit()
              } else if mock.deadline == nil {
                Text("Handed in", tableName: "Exam", comment: "A mock waiting to be graded")
              } else {
                Text("Time's up", tableName: "Exam", comment: "A running mock's time ran out")
              }
            } label: {
              Label {
                Text(MockLabels.title(number: mock.number))
                  .foregroundStyle(.primary)
                Text(
                  "\(mock.answered) of \(mock.questions) answered", tableName: "Exam",
                  comment: "A running mock's progress")
              } icon: {
                StatusMark(status: mock.id == exam.runningMocks.first?.id ? .next : .todo)
              }
            }
          }
        }

        if let next = exam.nextMock {
          Button {
            router.open(.challenge(planItemId: next.planItemId, sessionId: nil))
          } label: {
            LabeledContent {
              if let date = next.date.flatMap(studyDate) {
                Text(date.formatted(.studyDay.weekday(.abbreviated).month(.abbreviated).day()))
              }
            } label: {
              Label {
                Text(MockLabels.daySize(fullLength: next.fullLength, day: nil))
                  .foregroundStyle(.primary)
                Text("\(next.questions) questions", tableName: "Exam", comment: "Next mock size")
              } icon: {
                StatusMark(status: exam.runningMocks.isEmpty ? .next : .todo)
              }
            }
          }
        }

        ForEach(exam.mocks) { mock in
          if let blockId = mock.blockId {
            MockSummaryRow(mock: mock, blockId: blockId)
          }
        }

        if exam.mocksRequirePlus {
          PlusNotice(
            description: Text(
              "Mock exams come with Plus: whenever you want, every week in your plan, and your progress over time.",
              tableName: "Exam", comment: "What mocks with Plus unlock"),
            isInset: true)
        }
      } header: {
        HStack {
          Text("Mock exams", tableName: "Exam", comment: "The exam's mocks")
          Spacer()
          if !exam.mocks.isEmpty {
            Text("\(exam.mocks.count) taken", tableName: "Exam", comment: "Mocks taken")
              .monospacedDigit()
          }
        }
      }
    }
  }
}

private struct ExamProgressSection: View {
  let exam: ExamView

  var body: some View {
    if let progress = exam.progress, let latest = latestMock(progress) {
      Section {
        LabeledContent {
          Text((Double(latest.percent) / 100).formatted(.percent)).monospacedDigit()
        } label: {
          Label {
            Text("Latest mock", tableName: "Exam", comment: "The latest mock's score")
            Text(latestDetail(progress, latest: latest))
          } icon: {
            Image(systemName: "timer")
          }
        }

        if let best = bestArea(progress) {
          LabeledContent {
            Text((Double(best.percent) / 100).formatted(.percent)).monospacedDigit()
          } label: {
            Label {
              Text("Best area", tableName: "Exam", comment: "The subject that went best")
              Text(best.name)
            } icon: {
              Image(systemName: "trophy").foregroundStyle(.success)
            }
          }
        }

        if progress.mocks.count > 1, let first = progress.mocks.first {
          Chart(progress.mocks) { mock in
            LineMark(
              x: .value(
                Text("Mock exam", tableName: "Exam", comment: "Chart axis"), mock.finishedAt),
              y: .value(Text("Score", tableName: "Exam", comment: "Chart axis"), mock.percent)
            )
            .foregroundStyle(.success)
            PointMark(
              x: .value(
                Text("Mock exam", tableName: "Exam", comment: "Chart axis"), mock.finishedAt),
              y: .value(Text("Score", tableName: "Exam", comment: "Chart axis"), mock.percent)
            )
            .foregroundStyle(.success)
          }
          .chartYScale(domain: min(0, progress.mocks.map(\.percent).min() ?? 0)...100)
          .chartYAxis {
            AxisMarks(values: [0, 50, 100]) { value in
              AxisGridLine()
              AxisValueLabel {
                if let percent = value.as(Int.self) {
                  Text((Double(percent) / 100).formatted(.percent))
                }
              }
            }
          }
          .frame(minHeight: 160)
          .accessibilityElement(children: .ignore)
          .accessibilityLabel(
            Text(
              "Your mock exam scores, from \(first.percent)% to \(latest.percent)%",
              tableName: "Exam", comment: "The mock score chart"))
        }

        let trends = progress.subjects.contains { $0.change != nil }
        ForEach(progress.subjects) { subject in
          LabeledContent {
            HStack(spacing: 12) {
              Text((Double(subject.percents.last ?? 0) / 100).formatted(.percent))
              if trends {
                Text(subject.change.map { $0 > 0 ? "+\($0)" : "\($0)" } ?? "–")
                  .foregroundStyle(subject.change == nil ? .secondary : .primary)
                  .accessibilityLabel(
                    subject.change.map {
                      Text("Since the first mock: \($0)", tableName: "Exam", comment: "A change")
                    } ?? Text(""))
              }
            }
            .monospacedDigit()
          } label: {
            Text(subject.name)
          }
        }
      } header: {
        HStack {
          Text("How your mocks went", tableName: "Exam", comment: "Mock progress section")
          if exam.mocksRequirePlus {
            Spacer()
            PlusMark()
          }
        }
      } footer: {
        Text(progressLine(progress))
      }
    }
  }

  /// A subject's own mock leads only when there's no other.
  private func latestMock(_ progress: ExamView.Progress) -> ExamView.Progress.Point? {
    progress.mocks.last { $0.shape?.kind != .area } ?? progress.mocks.last
  }

  private func latestDetail(_ progress: ExamView.Progress, latest: ExamView.Progress.Point)
    -> String
  {
    let name = [
      MockLabels.title(number: latest.number),
      latest.shape?.kind == .area ? latest.shape?.area : nil,
    ].compactMap { $0 }.joined(separator: " · ")

    let score =
      exam.scoring.method == .net
      ? String(localized: "Net score in \(name)", table: "Exam", comment: "The latest net score")
      : String(
        localized: "Right answers in \(name)", table: "Exam", comment: "The latest right answers")

    guard progress.mocks.count > 1, let first = progress.mocks.first else { return score }
    let change = latest.percent - first.percent
    let since = String(
      localized: "\(change > 0 ? "+\(change)" : "\(change)") since the first", table: "Exam",
      comment: "The change since the first mock")
    return "\(score)\n\(since)"
  }

  /// None with one subject or a tie at the top.
  private func bestArea(_ progress: ExamView.Progress) -> (name: String, percent: Int)? {
    let latest = progress.subjects.compactMap { subject in
      subject.percents.last.map { (name: subject.name, percent: $0) }
    }
    .sorted { $0.percent > $1.percent }

    guard latest.count > 1, latest[0].percent != latest[1].percent else { return nil }
    return latest[0]
  }

  private func progressLine(_ progress: ExamView.Progress) -> String {
    guard progress.mocks.count > 1 else {
      return String(
        localized: "Take another mock exam to see how your score changes.", table: "Exam",
        comment: "After the first mock")
    }

    let improved = progress.improved.formatted(.list(type: .and))
    let needsWork = progress.needsWork.formatted(.list(type: .and))

    switch (progress.improved.isEmpty, progress.needsWork.isEmpty) {
    case (false, false):
      return String(
        localized: "Better in \(improved). Still needs work: \(needsWork).", table: "Exam",
        comment: "Mock trends")
    case (false, true):
      return String(localized: "Better in \(improved).", table: "Exam", comment: "Mock trends")
    case (true, false):
      return String(
        localized: "Still needs work: \(needsWork).", table: "Exam", comment: "Mock trends")
    case (true, true):
      return progress.subjects.contains { $0.change != nil }
        ? String(
          localized: "No subject has changed much yet.", table: "Exam", comment: "Mock trends")
        : String(
          localized: "Trends by subject show once your mocks ask enough new questions of each one.",
          table: "Exam", comment: "Mock trends need more mocks")
    }
  }
}

private struct ExamFormatSection: View {
  let exam: ExamView

  var body: some View {
    Section {
      ForEach(exam.format, id: \.day) { day in
        VStack(alignment: .leading, spacing: 4) {
          HStack {
            if exam.format.count > 1 {
              Text("Day \(day.day)", tableName: "Exam", comment: "An exam day").font(.headline)
            }
            Spacer()
            if let minutes = day.minutes {
              Text(MockLabels.duration(minutes: minutes))
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
            }
          }
          ForEach(day.parts, id: \.name) { part in
            LabeledContent {
              if let questions = part.questions, !part.written {
                Text("\(questions) questions", tableName: "Exam", comment: "A part's questions")
                  .monospacedDigit()
              }
            } label: {
              Text(part.name)
            }
          }
        }
      }
    } header: {
      switch exam.format.count {
      case 1: Text("The exam day", tableName: "Exam", comment: "A one-day exam's format")
      case 2: Text("The two days", tableName: "Exam", comment: "A two-day exam's format")
      default:
        Text("The \(exam.format.count) days", tableName: "Exam", comment: "An exam's days")
      }
    }
  }
}

private struct ExamMapSection: View {
  let map: ExamView.Map

  var body: some View {
    Section {
      ForEach(map.subjects) { subject in
        DisclosureGroup {
          ForEach(subject.topics, id: \.name) { topic in
            LabeledContent {
              if let appearances = topic.appearances {
                Text("\(appearances) times", tableName: "Exam", comment: "Times a topic was asked")
                  .monospacedDigit()
              }
            } label: {
              Text(topic.name)
            }
          }
        } label: {
          LabeledContent {
            if let share = subject.share {
              Text(
                "\(share.formatted(.percent.precision(.fractionLength(0)))) of the exam",
                tableName: "Exam", comment: "A subject's weight")
            } else if let questions = subject.questions {
              Text("\(questions) questions", tableName: "Exam", comment: "A subject's questions")
            }
          } label: {
            Text(subject.name)
          }
          .monospacedDigit()
        }
      }
    } header: {
      Text("What's on the exam", tableName: "Exam", comment: "The exam's subjects")
    } footer: {
      if map.hasFrequency {
        Text("From past exams", tableName: "Exam", comment: "Where topic counts come from")
      }
    }
  }
}

private struct ExamSpeakingSection: View {
  @Environment(LearnerSummaryStore.self) private var learner
  let exam: ExamView
  let callStart: CallStart

  var body: some View {
    if let mock = exam.speakingMock {
      SpeakingMockSection(
        goalId: exam.goalId, mock: mock, paused: exam.speakingMockPaused, start: callStart)
    } else if learner.summary.value?.places.speaking == true {
      Section {
        NavigationLink(value: AppRoute.speaking) {
          Label {
            Text("Speaking practice", tableName: "Exam", comment: "Opens the speaking paper")
          } icon: {
            Image(systemName: "mic")
          }
        }
      }
    }
  }
}

/// Start opens its call; a learner's tap writes it if it isn't written yet.
private struct SpeakingMockSection: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(AppRouter.self) private var router
  let goalId: String
  let mock: ExamView.SpeakingMock
  let paused: Bool
  let start: CallStart

  var body: some View {
    Section {
      Label {
        VStack(alignment: .leading, spacing: 4) {
          Group {
            switch mock {
            case .ielts:
              Text("IELTS speaking mock", tableName: "Exam", comment: "A speaking mock's name")
            case .toefl:
              Text("TOEFL speaking mock", tableName: "Exam", comment: "A speaking mock's name")
            }
          }
          .font(.headline)
          Group {
            switch mock {
            case .ielts:
              Text(
                "A short speaking test with an examiner. After it, an estimated band for each criterion.",
                tableName: "Exam", comment: "What the IELTS speaking mock is")
            case .toefl:
              Text(
                "Repeat sentences, then a short interview with an examiner. After it, an estimated band from 1 to 6 for each criterion.",
                tableName: "Exam", comment: "What the TOEFL speaking mock is")
            }
          }
          .foregroundStyle(.secondary)
        }
      } icon: {
        KindDot(kind: .conversation)
      }

      if paused {
        Label {
          VStack(alignment: .leading, spacing: 2) {
            Text("Calls are paused", tableName: "Exam", comment: "Live calls are paused")
            Text(
              "It's the same for everyone right now. Try again later.", tableName: "Exam",
              comment: "Why calls are paused"
            )
            .foregroundStyle(.secondary)
          }
        } icon: {
          Image(systemName: "phone.down")
        }
      } else {
        Button {
          start.start(
            .case3(.init(goalId: goalId, kind: .speakingMock)), voice: voice, router: router)
        } label: {
          if start.isStarting {
            Text("Starting…", tableName: "Exam", comment: "The speaking mock is starting")
          } else {
            Text("Start the mock", tableName: "Exam", comment: "Starts the speaking mock")
          }
        }
        .disabled(start.isStarting)

        switch start.refusal {
        case .limit(let limit):
          Group {
            if limit.period == .month {
              Text(
                "Not enough call time this month for this mock", tableName: "Exam",
                comment: "The call time left this month can't fit the mock")
            } else {
              Text(
                "Not enough call time today for this mock", tableName: "Exam",
                comment: "The call time left today can't fit the mock")
            }
          }
          .foregroundStyle(.destructive)
        case nil:
          EmptyView()
        case .some:
          Text(
            "The mock didn't start. Try again in a moment.", tableName: "Exam",
            comment: "Starting the speaking mock failed"
          )
          .foregroundStyle(.destructive)
        }
      }
    }
  }
}

private struct ExamScoringSection: View {
  let exam: ExamView

  var body: some View {
    let rule = scoringRule

    if rule != nil || exam.scoring.noticeScale != nil || exam.passMarks != nil {
      Section {
        if let rule {
          Label {
            VStack(alignment: .leading, spacing: 4) {
              Text(rule.title).font(.headline)
              Text(rule.rule).foregroundStyle(.secondary)
              if let calibration = exam.calibration,
                calibration.sure.answered + calibration.unsure.answered > 0
              {
                Text(
                  "In your mock exams: sure, \(calibration.sure.right) of \(calibration.sure.answered) right. Unsure, \(calibration.unsure.right) of \(calibration.unsure.answered) right.",
                  tableName: "Exam", comment: "Sure against unsure answers in mocks")
                if calibration.advice == .blankUnsure {
                  Text(
                    "Your unsure answers cost more than they earn: leave those blank.",
                    tableName: "Exam", comment: "Advice")
                } else if calibration.advice == .keepAnswering {
                  Text(
                    "Your unsure answers still earn points: keep answering them.",
                    tableName: "Exam", comment: "Advice")
                }
              }
            }
          } icon: {
            Image(systemName: "scalemass")
          }
        }

        if let scale = exam.scoring.noticeScale {
          Label {
            VStack(alignment: .leading, spacing: 4) {
              Group {
                if let name = scale.name {
                  Text("Scored on the \(name) scale", tableName: "Exam", comment: "Notice scale")
                } else {
                  Text("Scored on its own scale", tableName: "Exam", comment: "Notice scale")
                }
              }
              .font(.headline)
              Text(
                "From \(MockLabels.number(scale.min)) to \(MockLabels.number(scale.max)).",
                tableName: "Exam", comment: "The scale's range"
              )
              .foregroundStyle(.secondary)
              if let pass = scale.passScore {
                Text(
                  "To pass: \(MockLabels.number(pass)) or more.", tableName: "Exam",
                  comment: "The pass score"
                )
                .foregroundStyle(.secondary)
              }
            }
          } icon: {
            Image(systemName: "gauge.with.dots.needle.33percent")
          }
        }

        if let passMarks = exam.passMarks {
          Label {
            VStack(alignment: .leading, spacing: 4) {
              Text("To pass", tableName: "Exam", comment: "What it takes to pass").font(.headline)
              ForEach(passMarks.texts, id: \.self) { text in
                Text(text).foregroundStyle(.secondary)
              }
            }
          } icon: {
            Image(systemName: "flag")
          }
        }
      } header: {
        Text("How the score works", tableName: "Exam", comment: "The exam's scoring")
      }
    }
  }

  private var scoringRule: (title: String, rule: String)? {
    let penalty = exam.scoring.wrongPenalty

    switch exam.scoring.rule {
    case .net:
      let breakEven = penalty / (1 + penalty)
      return (
        penalty == 1
          ? String(
            localized: "A wrong answer cancels a right one", table: "Exam", comment: "Net scoring")
          : String(
            localized:
              "A wrong answer costs \(penalty.formatted(.percent.precision(.fractionLength(0...1)))) of a right one",
            table: "Exam", comment: "Net scoring with a partial penalty"),
        String(
          localized:
            "Answer only when you're more than \(breakEven.formatted(.percent.precision(.fractionLength(0)))) sure.",
          table: "Exam", comment: "When answering pays")
      )
    case .irt:
      return (
        String(
          localized: "Getting the easy ones right counts more", table: "Exam",
          comment: "IRT scoring"),
        String(
          localized:
            "Missing an easy question costs more than missing a hard one, so solve the easy ones first.",
          table: "Exam", comment: "IRT advice")
      )
    case .raw:
      return (
        String(
          localized: "Each right answer counts one point", table: "Exam", comment: "Raw scoring"),
        String(localized: "Answer every question.", table: "Exam", comment: "Raw advice")
      )
    case nil:
      return nil
    }
  }
}
