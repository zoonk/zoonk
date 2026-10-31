import SwiftUI

/// A single choice moves on as soon as it's picked; boxes wait for Continue, and optional ones can be
/// skipped.
struct QuestionStep: View {
  let step: Components.Schemas.OnboardingStep
  let view: GoalOnboarding
  let subject: String
  let isSaving: Bool
  let failed: Bool
  let onAnswer: ([String: Any]) -> Void

  var body: some View {
    QuestionForm(isSaving: isSaving, failed: failed) {
      content
    }
  }

  @ViewBuilder
  private var content: some View {
    switch step {
    case .purpose:
      PurposeQuestion(subject: subject, onAnswer: onAnswer)
    case .role:
      RoleQuestion(
        subject: subject, isCareerChange: detail("purpose") == "careerChange", onAnswer: onAnswer)
    case .reason:
      TextQuestion(kind: .reason, subject: subject, onAnswer: onAnswer)
    case .target:
      TextQuestion(
        kind: TextQuestion.Kind(examTarget: detail("examTarget")), subject: subject,
        onAnswer: onAnswer)
    case .targetDate:
      DateQuestion(
        subject: subject, examDays: view.examDays, initialDate: view.goal.targetDate,
        problem: DateProblem(view.dateProblem),
        today: GoalDate.today(now: .now, timeZone: view.goal.timezone), onAnswer: onAnswer)
    case .followUps:
      FollowUpsQuestion(questions: view.followUps, onAnswer: onAnswer)
    case .examChoice:
      ExamChoiceQuestion(subject: subject, choices: view.examChoices, onAnswer: onAnswer)
    case .level:
      if view.examSubjects.count > 1 {
        SubjectsLevelQuestion(subject: subject, subjects: view.examSubjects, onAnswer: onAnswer)
      } else {
        LevelQuestion(subject: subject, testMinutes: view.quickTestMinutes, onAnswer: onAnswer)
      }
    case .buddy:
      BuddyQuestion(onAnswer: onAnswer)
    case .schedule, .placement, .plan:
      EmptyView()
    }
  }

  private func detail(_ key: String) -> String? {
    (try? PracticeJSON.recode(view.goal.details, as: [String: OnboardingDetail].self))?[key]?.text
  }
}

private struct OnboardingDetail: Decodable {
  let text: String?

  init(from decoder: Decoder) throws {
    text = try? decoder.singleValueContainer().decode(String.self)
  }
}

/// While an answer saves, the question can't change and its Continue says so.
struct QuestionForm<Content: View>: View {
  let isSaving: Bool
  let failed: Bool
  /// Says why a save failed, when the answer itself was refused.
  var failure: Text?
  @ViewBuilder let content: Content

  var body: some View {
    Form {
      content

      if failed {
        Section {
          (failure
            ?? Text(
              "That didn't save. Try again.", tableName: "Onboarding",
              comment: "A change couldn't be saved"))
            .foregroundStyle(.destructive)
        }
      }
    }
    .disabled(isSaving)
    .environment(\.isSavingAnswer, isSaving)
  }
}

extension EnvironmentValues {
  @Entry var isSavingAnswer = false
}

struct StepHeader: View {
  var subject: String?
  let title: Text
  let description: Text?

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 6) {
        if let subject {
          Text(subject)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        title
          .font(.title2.bold())
          .accessibilityAddTraits(.isHeader)

        if let description {
          description
            .foregroundStyle(.secondary)
        }
      }
      .listRowBackground(Color.clear)
    }
  }
}

struct StepButtons: View {
  var canContinue = true
  var canSkip = true
  var continueLabel: Text?
  var skipLabel: Text?
  var note: Text?
  let onContinue: () -> Void
  var onSkip: (() -> Void)?

  @Environment(\.isSavingAnswer) private var isSaving

  var body: some View {
    Section {
      VStack(spacing: 12) {
        Button(action: onContinue) {
          HStack(spacing: 8) {
            if isSaving {
              ProgressView()
            }

            continueLabel
              ?? Text("Continue", tableName: "Onboarding", comment: "Saves an onboarding answer")
          }
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .disabled(!canContinue)

        if let onSkip {
          Button(action: onSkip) {
            (skipLabel
              ?? Text(
                "Skip", tableName: "Onboarding", comment: "Skips an optional onboarding question"))
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .disabled(!canSkip)
        }
      }
      .controlSize(.large)
      .keepsOffFold()
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)
    } footer: {
      if let note {
        note
          .frame(maxWidth: .infinity)
          .multilineTextAlignment(.center)
      }
    }
  }
}

struct ChoiceRows<Value: Hashable>: View {
  struct Choice {
    let value: Value
    let label: Text
    var detail: Text?
  }

  let choices: [Choice]
  var picked: Value?
  var header: Text?
  var footer: Text?
  let onPick: (Value) -> Void

  var body: some View {
    Section {
      ForEach(choices, id: \.value) { choice in
        Button {
          onPick(choice.value)
        } label: {
          HStack {
            VStack(alignment: .leading, spacing: 2) {
              choice.label
                .foregroundStyle(.primary)
              if let detail = choice.detail {
                detail
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
              }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if picked == choice.value {
              Image(systemName: "checkmark")
                .fontWeight(.semibold)
                .foregroundStyle(.tint)
            }
          }
          .contentShape(.rect)
        }
        .accessibilityAddTraits(picked == choice.value ? .isSelected : [])
      }
    } header: {
      header
    } footer: {
      footer
    }
  }
}

private struct PurposeQuestion: View {
  let subject: String
  let onAnswer: ([String: Any]) -> Void

  var body: some View {
    StepHeader(
      subject: subject,
      title: Text(
        "What do you want from it?", tableName: "Onboarding",
        comment: "Onboarding question: what the learner hopes to get from learning it"),
      description: Text(
        "Pick what motivates you most.", tableName: "Onboarding",
        comment: "Under the purpose question"))

    ChoiceRows(
      choices: [
        .init(
          value: "overview",
          label: Text("Get an overview", tableName: "Onboarding", comment: "Purpose choice"),
          detail: Text(
            "The big ideas, no formulas", tableName: "Onboarding", comment: "Purpose choice detail")
        ),
        .init(
          value: "deep",
          label: Text("Understand it in depth", tableName: "Onboarding", comment: "Purpose choice"),
          detail: Text(
            "From the basics to advanced", tableName: "Onboarding", comment: "Purpose choice detail"
          )),
        .init(
          value: "work",
          label: Text("Use it at work", tableName: "Onboarding", comment: "Purpose choice"),
          detail: Text(
            "Apply it to real projects", tableName: "Onboarding", comment: "Purpose choice detail")),
        .init(
          value: "careerChange",
          label: Text("Change careers", tableName: "Onboarding", comment: "Purpose choice"),
          detail: Text(
            "Get ready for a new role", tableName: "Onboarding", comment: "Purpose choice detail")),
        .init(
          value: "refresh",
          label: Text("Refresh what I studied", tableName: "Onboarding", comment: "Purpose choice"),
          detail: Text(
            "Pick up what you left behind", tableName: "Onboarding",
            comment: "Purpose choice detail")),
        .init(
          value: "other",
          label: Text("Something else", tableName: "Onboarding", comment: "Purpose choice"),
          detail: Text(
            "Tell us later, in your own words", tableName: "Onboarding",
            comment: "Purpose choice detail")),
      ]
    ) { purpose in
      onAnswer(["purpose": purpose, "question": "purpose"])
    }
  }
}

private struct RoleQuestion: View {
  let subject: String
  let isCareerChange: Bool
  let onAnswer: ([String: Any]) -> Void

  @State private var role = ""
  @State private var second = ""

  var body: some View {
    StepHeader(
      subject: subject,
      title: isCareerChange
        ? Text(
          "Where are you headed?", tableName: "Onboarding",
          comment: "Onboarding question for a career change")
        : Text("What do you do at work?", tableName: "Onboarding", comment: "Onboarding question"),
      description: isCareerChange
        ? Text(
          "The plan covers what that role needs on day one.", tableName: "Onboarding",
          comment: "Under the career change question")
        : Text(
          "We'll use cases from your work.", tableName: "Onboarding",
          comment: "Under the work role question"))

    Section {
      if isCareerChange {
        LabeledField(
          label: Text(
            "The role you want", tableName: "Onboarding",
            comment: "Box for the role a career change aims for"),
          prompt: Text(
            "E.g., data analyst, nurse", tableName: "Onboarding",
            comment: "Example roles a career change aims for"),
          text: $second)
        LabeledField(
          label: Text(
            "What you do now", tableName: "Onboarding",
            comment: "Box for the learner's work before a career change"),
          prompt: Text(
            "E.g., teacher, student", tableName: "Onboarding", comment: "Example current roles"),
          text: $role)
      } else {
        LabeledField(
          label: Text(
            "Your role", tableName: "Onboarding", comment: "Box for the learner's role at work"),
          prompt: Text(
            "E.g., nurse, teacher", tableName: "Onboarding", comment: "Example roles at work"),
          text: $role)
        LabeledField(
          label: Text(
            "What you'll use it for", tableName: "Onboarding",
            comment: "Box for what the learner uses the subject for at work"),
          prompt: Text(
            "E.g., reports, A/B tests", tableName: "Onboarding", comment: "Example uses at work"),
          text: $second)
      }
    }

    StepButtons(canContinue: !trimmed(isCareerChange ? second : role).isEmpty) {
      var input: [String: Any] = ["question": "role", "role": value(role)]
      input[isCareerChange ? "targetPosition" : "tasks"] = value(second)
      onAnswer(input)
    } onSkip: {
      onAnswer(["question": "role", "role": NSNull()])
    }
  }
}

struct LabeledField: View {
  let label: Text
  let prompt: Text?
  @Binding var text: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      label
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .accessibilityHidden(true)
      // Without a prompt, the field would repeat its label, already shown above, as its placeholder.
      MultilineTextField(text: $text, prompt: prompt ?? Text(verbatim: ""), label: label)
    }
  }
}

private func trimmed(_ value: String) -> String {
  value.trimmingCharacters(in: .whitespacesAndNewlines)
}

/// A box's answer as the API takes it: its words, or null when left empty.
private func value(_ text: String) -> Any {
  trimmed(text).isEmpty ? NSNull() : trimmed(text)
}

private struct TextQuestion: View {
  enum Kind {
    case admission, position, score, reason

    init(examTarget: String?) {
      self =
        switch examTarget {
        case "position": .position
        case "score": .score
        default: .admission
        }
    }
  }

  let kind: Kind
  let subject: String
  let onAnswer: ([String: Any]) -> Void

  @State private var text = ""

  var body: some View {
    StepHeader(subject: subject, title: title, description: description)

    Section {
      LabeledField(label: label, prompt: prompt, text: $text)
    }

    StepButtons(canContinue: !trimmed(text).isEmpty) {
      onAnswer(answer(trimmed(text)))
    } onSkip: {
      onAnswer(answer(nil))
    }
  }

  private func answer(_ value: String?) -> [String: Any] {
    kind == .reason
      ? ["question": "reason", "reason": value ?? NSNull()]
      : ["question": "target", "target": value ?? NSNull()]
  }

  private var title: Text {
    switch kind {
    case .admission:
      Text(
        "Which course and score are you aiming for?", tableName: "Onboarding",
        comment: "Onboarding question for an admission exam")
    case .position:
      Text(
        "Which position are you applying for?", tableName: "Onboarding",
        comment: "Onboarding question for a civil service exam")
    case .reason:
      Text(
        "Why are you learning it?", tableName: "Onboarding",
        comment: "Onboarding question for a language goal")
    case .score:
      Text(
        "What score do you need?", tableName: "Onboarding",
        comment: "Onboarding question for an exam goal")
    }
  }

  private var description: Text {
    switch kind {
    case .admission, .score:
      Text(
        "It helps your plan focus on what counts most.", tableName: "Onboarding",
        comment: "Under the exam target question")
    case .position:
      Text(
        "The notice can have a different exam for each position.", tableName: "Onboarding",
        comment: "Under the position question")
    case .reason:
      Text(
        "The situations you care about shape every lesson.", tableName: "Onboarding",
        comment: "Under the language reason question")
    }
  }

  private var label: Text {
    switch kind {
    case .admission, .score:
      Text(
        "Your target", tableName: "Onboarding",
        comment: "Box for the course and score the learner aims for on the exam")
    case .position:
      Text("Position", tableName: "Onboarding", comment: "Box for the position an exam is for")
    case .reason:
      Text("Why", tableName: "Onboarding", comment: "Box for why the learner studies a language")
    }
  }

  /// No example fits every exam's positions, so the position box has none.
  private var prompt: Text? {
    switch kind {
    case .admission:
      Text(
        "E.g., medicine, 750 points", tableName: "Onboarding", comment: "Example admission targets")
    case .position:
      nil
    case .reason:
      Text(
        "E.g., a job interview, travel", tableName: "Onboarding",
        comment: "Example reasons to learn a language")
    case .score:
      Text("E.g., band 7, 100 points", tableName: "Onboarding", comment: "Example score targets")
    }
  }
}

/// A deadline is optional: without one, the learner studies everything at their own pace. Like
/// main, there's no date until the learner chooses one.
private struct DateQuestion: View {
  let subject: String
  let examDays: Components.Schemas.Onboarding.ExamDaysPayload?
  let initialDate: String?
  let problem: DateProblem?
  /// The goal's today, `YYYY-MM-DD`.
  let today: String
  let onAnswer: ([String: Any]) -> Void

  @State private var picksOtherDate = false
  @State private var date: Date?

  init(
    subject: String,
    examDays: Components.Schemas.Onboarding.ExamDaysPayload?,
    initialDate: String?,
    problem: DateProblem?,
    today: String,
    onAnswer: @escaping ([String: Any]) -> Void
  ) {
    self.subject = subject
    self.examDays = examDays
    self.initialDate = initialDate
    self.problem = problem
    self.today = today
    self.onAnswer = onAnswer
    let kept = GoalDate.kept(initialDate, problem: problem)
    let firstDay = examDays?.days.first
    _picksOtherDate = State(initialValue: examDays == nil || (kept != nil && kept != firstDay))
    _date = State(initialValue: kept.flatMap(UnderstoodRows.day))
  }

  var body: some View {
    if let examDays, let first = examDays.days.first, let firstDay = UnderstoodRows.day(first),
      !picksOtherDate
    {
      examDate(examDays, first: first, firstDay: firstDay)
    } else {
      let withoutDate = String(
        localized: LocalizedStringResource(
          "Without a date, you study everything at your own pace, and we show when you reach each milestone.",
          table: "Onboarding", comment: "Under the date question"))

      StepHeader(
        subject: subject,
        title: Text(
          "Is there a date you're aiming for?", tableName: "Onboarding",
          comment: "Onboarding question"),
        description: Text([passedNote, withoutDate].compactMap { $0 }.joined(separator: " ")))

      Section {
        if let date {
          DatePicker(
            selection: Binding {
              date
            } set: {
              self.date = $0
            }, in: range,
            displayedComponents: .date
          ) {
            Text("Date", tableName: "Onboarding", comment: "Label of the goal's date picker")
          }

          noSittingRows(for: date)
        } else {
          Button {
            date = Calendar.isoLocal.date(byAdding: .month, value: 3, to: .now)
          } label: {
            LabeledContent {
              Text(
                "Choose a date", tableName: "Onboarding", comment: "Shows the goal's date picker")
            } label: {
              Text("Date", tableName: "Onboarding", comment: "Label of the goal's date picker")
                .foregroundStyle(.primary)
            }
          }
        }
      }

      StepButtons(
        canContinue: date != nil,
        skipLabel: Text(
          "No date, study everything", tableName: "Onboarding", comment: "Skips the goal's date")
      ) {
        if let date {
          onAnswer(["question": "targetDate", "targetDate": isoDay(date)])
        }
      } onSkip: {
        onAnswer(["question": "targetDate", "targetDate": NSNull()])
      }
    }
  }

  /// Why the date shown before can't be planned; the screen then starts without it.
  private var passedNote: String? {
    guard let initialDate, let day = studyDate(initialDate) else {
      return nil
    }

    switch problem {
    case .passed:
      return String(
        localized: LocalizedStringResource(
          "Your date, \(day.formatted(.studyDay.day().month(.wide).year())), has passed.",
          table: "Onboarding", comment: "Above the date question when the goal's date has passed"))
    case .today:
      return String(
        localized: LocalizedStringResource(
          "Your date is today, so there are no days left to plan.", table: "Onboarding",
          comment: "Above the date question when the goal's date is today"))
    case .noSitting, nil:
      return nil
    }
  }

  /// The exam isn't held in the picked month: each closest sitting, one tap away.
  @ViewBuilder
  private func noSittingRows(for date: Date) -> some View {
    if case .noSitting(let month, let closest) = problem,
      isoDay(date).prefix(7) == month.prefix(7), let monthDay = studyDate(month)
    {
      Text(
        "No exam date in \(monthDay.formatted(.studyDay.month(.wide)))", tableName: "Exam",
        comment: "An exam with no sitting in the learner's month")

      ForEach(closest, id: \.self) { sitting in
        if let day = studyDate(sitting) {
          Button {
            onAnswer(["question": "targetDate", "targetDate": sitting])
          } label: {
            Text(
              "Use \(day.formatted(.studyDay.month(.wide).day().year()))", tableName: "Exam",
              comment: "Moves the plan to one of the closest sittings")
          }
        }
      }
    }
  }

  @ViewBuilder
  private func examDate(
    _ examDays: Components.Schemas.Onboarding.ExamDaysPayload,
    first: String,
    firstDay: Date
  ) -> some View {
    let second = examDays.days.dropFirst().first.flatMap(UnderstoodRows.day)
    let date = firstDay.formatted(.dateTime.day().month(.wide).year())
    let ready =
      second == nil
      ? String(
        localized: LocalizedStringResource(
          "Your plan gets you ready by then.", table: "Onboarding", comment: "Under the exam's date"
        ))
      : String(
        localized: LocalizedStringResource(
          "Your plan gets you ready by the first day.", table: "Onboarding",
          comment: "Under an exam's dates over several days"))
    let estimated =
      examDays.estimated
      ? String(
        localized: LocalizedStringResource(
          "This is the expected date until the notice confirms it.", table: "Onboarding",
          comment: "Under an exam date estimated from past years"))
      : nil

    StepHeader(
      subject: subject,
      title: second.map {
        Text(
          "Your exam is on \(date) (and \($0.formatted(.dateTime.day().month(.wide))))",
          tableName: "Onboarding",
          comment: "An exam held over two days")
      } ?? Text("Your exam is on \(date)", tableName: "Onboarding", comment: "An exam's date"),
      description: Text([passedNote, ready, estimated].compactMap { $0 }.joined(separator: " ")))

    StepButtons(
      skipLabel: Text(
        "Another date", tableName: "Onboarding", comment: "Picks another date than the exam's")
    ) {
      onAnswer(["question": "targetDate", "targetDate": first])
    } onSkip: {
      picksOtherDate = true
    }
  }

  /// After the goal's today, and no later than a plan reaches (3,650 days).
  private var range: ClosedRange<Date> {
    let calendar = Calendar.isoLocal
    let goalToday = UnderstoodRows.day(today) ?? calendar.startOfDay(for: .now)
    let tomorrow = calendar.date(byAdding: .day, value: 1, to: goalToday) ?? goalToday
    return tomorrow...(calendar.date(byAdding: .day, value: 3650, to: goalToday) ?? goalToday)
  }
}

/// Why the goal's date can't be planned as it stands, as core says.
enum DateProblem: Equatable {
  case passed
  case today
  /// The exam isn't held in `month`; `closest` are the nearest sittings still open.
  case noSitting(month: String, closest: [String])

  init?(_ payload: Components.Schemas.Onboarding.DateProblemPayload?) {
    switch payload {
    case .case1:
      self = .passed
    case .case2:
      self = .today
    case .case3(let noSitting):
      self = .noSitting(month: noSitting.month, closest: noSitting.closest)
    case nil:
      return nil
    }
  }
}

enum GoalDate {
  /// A date that passed or is today can't be planned, so the date screen starts without it.
  static func kept(_ date: String?, problem: DateProblem?) -> String? {
    switch problem {
    case .passed, .today:
      nil
    case .noSitting, nil:
      date
    }
  }

  /// Core counts the goal's days in its zone, UTC without one, so the date screen does too.
  static func today(now: Date, timeZone: String?) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone.flatMap(TimeZone.init(identifier:)) ?? .gmt
    let parts = calendar.dateComponents([.year, .month, .day], from: now)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }
}

extension Calendar {
  /// ISO dates are Gregorian whatever calendar the learner reads dates in, with days in their zone.
  static var isoLocal: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .current
    return calendar
  }
}

func isoDay(_ date: Date) -> String {
  let parts = Calendar.isoLocal.dateComponents([.year, .month, .day], from: date)
  return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
}

private struct FollowUpsQuestion: View {
  let questions: [String]
  let onAnswer: ([String: Any]) -> Void

  @State private var answers: [String]

  init(questions: [String], onAnswer: @escaping ([String: Any]) -> Void) {
    self.questions = questions
    self.onAnswer = onAnswer
    _answers = State(initialValue: questions.map { _ in "" })
  }

  var body: some View {
    StepHeader(
      title: Text(
        "Tell us a bit more", tableName: "Onboarding",
        comment: "Onboarding question about an unusual goal"),
      description: Text(
        "A couple of details make your plan fit better.", tableName: "Onboarding",
        comment: "Under the follow-up questions"))

    ForEach(questions.indices, id: \.self) { index in
      Section {
        LabeledField(
          label: Text(questions[index]),
          prompt: Text(
            "Your answer", tableName: "Onboarding", comment: "Box answering a follow-up question"),
          text: $answers[index])
      }
    }

    StepButtons {
      onAnswer(["answers": answers.map(value), "question": "followUps"])
    } onSkip: {
      onAnswer(["answers": questions.map { _ in NSNull() }, "question": "followUps"])
    }
  }
}

private struct ExamChoiceQuestion: View {
  let subject: String
  let choices: [Components.Schemas.ExamChoice]
  let onAnswer: ([String: Any]) -> Void

  @State private var picks: [String: String]

  init(
    subject: String, choices: [Components.Schemas.ExamChoice],
    onAnswer: @escaping ([String: Any]) -> Void
  ) {
    self.subject = subject
    self.choices = choices
    self.onAnswer = onAnswer
    _picks = State(
      initialValue: Dictionary(
        choices.compactMap { choice in choice.subject.map { (choice.group, $0) } },
        uniquingKeysWith: { first, _ in first }))
  }

  var body: some View {
    StepHeader(
      subject: subject,
      title: choices.count == 1
        ? Text(
          "Which one will you take?", tableName: "Onboarding",
          comment: "Asks which of an exam's optional subjects the learner takes")
        : Text(
          "Which ones will you take?", tableName: "Onboarding",
          comment:
            "Asks which of an exam's optional subjects the learner takes, for several choices"),
      description: Text(
        "The plan and the mocks follow your pick. You can change it in your plan.",
        tableName: "Onboarding",
        comment: "Under the exam choice question"))

    ForEach(choices, id: \.group) { choice in
      ChoiceRows(
        choices: choice.options.map { option in
          .init(
            value: option.name,
            label: Text(option.shortName ?? option.name),
            detail: option.shortName.flatMap { $0 == option.name ? nil : Text(option.name) })
        },
        picked: picks[choice.group],
        header: Text(choice.group),
        footer: Text(
          ExamChoiceLeftOut(
            examPoints: choice.leftOut.examPoints, examQuestions: choice.leftOut.examQuestions,
            name: choice.leftOut.name, points: choice.leftOut.points,
            questions: choice.leftOut.questions
          ).line)
      ) { name in
        picks[choice.group] = name

        // One choice to make moves on once it's picked; several wait for Continue.
        if choices.count == 1 {
          submit()
        }
      }
    }

    StepButtons(
      canContinue: choices.allSatisfy { picks[$0.group] != nil },
      skipLabel: Text(
        "Decide later", tableName: "Onboarding", comment: "Leaves an exam's choice for later"),
      onContinue: submit
    ) {
      onAnswer(["choices": NSNull(), "question": "examChoice"])
    }
  }

  private func submit() {
    onAnswer([
      "choices": choices.compactMap { choice in
        picks[choice.group].map { ["group": choice.group, "subject": $0] }
      },
      "question": "examChoice",
      "timeZone": TimeZone.current.identifier,
    ])
  }
}

/// "Not sure" is still an answer: a quick test finds it.
private struct LevelQuestion: View {
  let subject: String
  let testMinutes: Int
  let onAnswer: ([String: Any]) -> Void

  var body: some View {
    StepHeader(
      subject: subject,
      title: Text(
        "How much do you already know?", tableName: "Onboarding", comment: "Onboarding question"),
      description: Text(
        "It only changes where your plan starts.", tableName: "Onboarding",
        comment: "Under the level question"))

    ChoiceRows(choices: LevelChoices.all(testMinutes: testMinutes)) { level in
      onAnswer(["level": LevelChoices.answer(level) ?? NSNull(), "question": "level"])
    }
  }
}

enum LevelChoices {
  /// "Not sure": placement finds the level instead.
  private static let quickTest = "quickTest"

  /// The quick test gives its length once it's known: a course start reads it with its course.
  static func all(testMinutes: Int?) -> [ChoiceRows<String>.Choice] {
    [
      .init(
        value: "none",
        label: Text("Nothing, I'm just starting", tableName: "Onboarding", comment: "Level choice"),
        detail: Text(
          "From scratch, with everyday examples", tableName: "Onboarding",
          comment: "Level choice detail")),
      .init(
        value: "basic",
        label: Text("The basics", tableName: "Onboarding", comment: "Level choice"),
        detail: Text("I know a few things", tableName: "Onboarding", comment: "Level choice detail")
      ),
      .init(
        value: "intermediate",
        label: Text("I studied it before", tableName: "Onboarding", comment: "Level choice"),
        detail: Text(
          "We'll skip what you already know", tableName: "Onboarding",
          comment: "Level choice detail")),
      .init(
        value: "advanced",
        label: Text("I know it well", tableName: "Onboarding", comment: "Level choice"),
        detail: Text(
          "Only what's new or hard", tableName: "Onboarding", comment: "Level choice detail")),
      .init(
        value: quickTest,
        label: Text(
          "Not sure, give me a quick test", tableName: "Onboarding", comment: "Level choice"),
        detail: testMinutes.map { minutes in
          Text(
            "Adapts to your answers, about \(Duration.seconds(minutes * 60), format: .units(allowed: [.minutes], width: .wide))",
            tableName: "Onboarding", comment: "Level choice detail; the time a quick test takes")
        }),
    ]
  }

  /// The level as the API takes it: nil for the quick test.
  static func answer(_ choice: String) -> String? {
    choice == quickTest ? nil : choice
  }
}

private struct SubjectsLevelQuestion: View {
  let subject: String
  let subjects: [Components.Schemas.Onboarding.ExamSubjectsPayloadPayload]
  let onAnswer: ([String: Any]) -> Void

  @State private var known: Set<String> = []

  var body: some View {
    StepHeader(
      subject: subject,
      title: Text(
        "Which subjects do you already know well?", tableName: "Onboarding",
        comment: "Onboarding question for an exam with several subjects"),
      description: Text(
        "Your plan starts past their basics. A quick test places you in the rest.",
        tableName: "Onboarding",
        comment:
          "Under the known subjects question: the plan skips the basics of the subjects picked, and a test finds the level in the others"
      ))

    Section {
      ForEach(subjects, id: \.name) { item in
        Toggle(
          isOn: Binding(
            get: { known.contains(item.name) },
            set: { isOn in
              if isOn {
                known.insert(item.name)
              } else {
                known.remove(item.name)
              }
            })
        ) {
          Text(item.shortName ?? item.name)
          if let short = item.shortName, short != item.name {
            Text(item.name)
          }
        }
      }
    }

    StepButtons(
      continueLabel: known.isEmpty
        ? Text(
          "None of them yet", tableName: "Onboarding",
          comment: "Continues without any of the listed subjects known well")
        : nil,
      skipLabel: Text(
        "I'm starting from scratch", tableName: "Onboarding",
        comment: "Says the learner knows none of the exam yet")
    ) {
      onAnswer([
        "knownSubjects": subjects.map(\.name).filter(known.contains), "level": NSNull(),
        "question": "level",
      ])
    } onSkip: {
      onAnswer(["level": "none", "question": "level"])
    }
  }
}

/// The buddy is offered once, in the learner's first onboarding.
private struct BuddyQuestion: View {
  let onAnswer: ([String: Any]) -> Void

  @State private var kind: BuddyKind = .zu
  @State private var name = ""

  var body: some View {
    StepHeader(
      title: Text("Choose your buddy", tableName: "Onboarding", comment: "Onboarding step"),
      description: Text(
        "Your buddy grows as you learn.", tableName: "Onboarding", comment: "Under the buddy step"))

    BuddyPickerSections(kind: $kind, name: $name)

    StepButtons {
      onAnswer(["buddy": ["kind": kind.rawValue, "name": value(name)], "question": "buddy"])
    }
  }
}
