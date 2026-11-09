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
      ReasonQuestion(
        subject: subject, reasons: view.languageAimView?.reasons ?? [], onAnswer: onAnswer)
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

/// While an answer saves, its fields lock (`locksWhileSaving`) and only the button that sent it
/// spins. The list itself stays enabled, so that button keeps its focus.
struct QuestionForm<Content: View>: View {
  let isSaving: Bool
  let failed: Bool
  /// Says why a save failed, when the answer itself was refused.
  var failure: String?
  @ViewBuilder let content: Content

  var body: some View {
    ZoonkList {
      content

      if failed {
        Section {
          FailureLine(
            message: failure
              ?? String(
                localized: "That didn't save. Try again.", table: "Onboarding",
                comment: "A change couldn't be saved"))
        }
      }
    }
    .environment(\.isSavingAnswer, isSaving)
  }
}

extension EnvironmentValues {
  @Entry var isSavingAnswer = false
}

extension View {
  /// The answer being saved can't change.
  func locksWhileSaving() -> some View {
    modifier(LocksWhileSaving())
  }
}

private struct LocksWhileSaving: ViewModifier {
  @Environment(\.isSavingAnswer) private var isSaving

  func body(content: Content) -> some View {
    content.disabled(isSaving)
  }
}

/// Which of a step's buttons sent the answer that's saving: only it spins, and the other waits.
struct StepSender {
  enum Button {
    case proceed
    case skip
  }

  private var pressed: Button?

  mutating func press(_ button: Button) {
    pressed = button
  }

  /// Forgets the sender once its save ends, so a save started elsewhere, such as by a picked row,
  /// spins neither button.
  mutating func saveEnded() {
    pressed = nil
  }

  func sent(_ button: Button, isSaving: Bool) -> Bool {
    isSaving && pressed == button
  }
}

struct StepHeader: View {
  var subject: String?
  let title: Text
  let description: Text?

  var body: some View {
    Section {
      PageHeader(title, eyebrow: subject.map { Text(verbatim: $0) }, supporting: description)
        .listRowBackground(Color.clear)
    }
  }
}

/// A step's Continue, with an optional Skip under it. A label passed in takes its own icon, or none
/// where no idea fits it; the defaults are Continue's forward arrow and Skip's. Either one's request
/// is `isSavingAnswer`; the one pressed spins.
struct StepButtons: View {
  var canContinue = true
  var canSkip = true
  var continueLabel: Text?
  var continueIcon: ActionIcon? = .forward
  var skipLabel: Text?
  var skipIcon: ActionIcon? = .skip
  var note: Text?
  let onContinue: () -> Void
  var onSkip: (() -> Void)?

  @Environment(\.isSavingAnswer) private var isSaving
  @State private var sender = StepSender()

  var body: some View {
    let proceeds = sender.sent(.proceed, isSaving: isSaving)
    let skips = sender.sent(.skip, isSaving: isSaving)

    Section {
      VStack(spacing: 12) {
        BusyButton(isBusy: proceeds, icon: continueIcon) {
          sender.press(.proceed)
          onContinue()
        } label: {
          continueLabel
            ?? Text("Continue", tableName: "Onboarding", comment: "Saves an onboarding answer")
        }
        .buttonStyle(.mainAction)
        .disabled((!canContinue || isSaving) && !proceeds)

        if let onSkip {
          BusyButton(isBusy: skips, icon: skipIcon) {
            sender.press(.skip)
            onSkip()
          } label: {
            skipLabel
              ?? Text(
                "Skip", tableName: "Onboarding", comment: "Skips an optional onboarding question")
          }
          .buttonStyle(.outline)
          .disabled((!canSkip || isSaving) && !skips)
        }
      }
      .buttonSizing(.flexible)
      .controlSize(.large)
      .keepsOffFold()
      .listRowInsets(.vertical, 0)
      .listRowBackground(Color.clear)
    } footer: {
      SectionFooter {
        if let note {
          note
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)
        }
      }
    }
    .onChange(of: isSaving) {
      if !isSaving {
        sender.saveEnded()
      }
    }
  }
}

struct ChoiceRows<Value: Hashable>: View {
  struct Choice {
    let value: Value
    let label: String
    var detail: Text?
  }

  let choices: [Choice]
  var picked: Value?
  var header: Text?
  var footer: Text?
  /// The next question replaces this one, so VoiceOver says what was picked as it goes.
  var movesOn = false
  let onPick: (Value) -> Void

  var body: some View {
    Section {
      ForEach(choices, id: \.value) { choice in
        Button {
          onPick(choice.value)

          if movesOn {
            announcePolitely(
              String(
                localized: "You picked \(choice.label)", table: "Onboarding",
                comment: "VoiceOver, as a one-answer question moves on: the answer picked"))
          }
        } label: {
          HStack {
            VStack(alignment: .leading, spacing: 2) {
              Text(choice.label)
                .foregroundStyle(.primary)
              if let detail = choice.detail {
                detail
                  .typeStyle(.note)
                  .foregroundStyle(.mutedForeground)
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
      if let header {
        SectionTitle(header)
      }
    } footer: {
      SectionFooter {
        footer
      }
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
        "It sets how deep your course goes, and so how long it is.", tableName: "Onboarding",
        comment: "Under the purpose question"))

    ChoiceRows(
      choices: [
        .init(
          value: "overview",
          label: String(
            localized: "Get an overview", table: "Onboarding", comment: "Purpose choice"),
          detail: Text(
            "A short course: the big ideas, no formulas", tableName: "Onboarding",
            comment: "Purpose choice detail")
        ),
        .init(
          value: "deep",
          label: String(
            localized: "Understand it in depth", table: "Onboarding", comment: "Purpose choice"),
          detail: Text(
            "The full path, from the basics to advanced", tableName: "Onboarding",
            comment: "Purpose choice detail")),
        .init(
          value: "work",
          label: String(
            localized: "Use it at work", table: "Onboarding", comment: "Purpose choice"),
          detail: Text(
            "Only what your work uses, in the order it needs", tableName: "Onboarding",
            comment: "Purpose choice detail")),
        .init(
          value: "careerChange",
          label: String(
            localized: "Change careers", table: "Onboarding", comment: "Purpose choice"),
          detail: Text(
            "What the new role needs, portfolio included", tableName: "Onboarding",
            comment: "Purpose choice detail")),
        .init(
          value: "refresh",
          label: String(
            localized: "Refresh what I studied", table: "Onboarding", comment: "Purpose choice"),
          detail: Text(
            "Back to the level you had, after a quick test", tableName: "Onboarding",
            comment: "Purpose choice detail")),
        .init(
          value: "other",
          label: String(
            localized: "Something else", table: "Onboarding", comment: "Purpose choice"),
          detail: Text(
            "Tell us later, in your own words", tableName: "Onboarding",
            comment: "Purpose choice detail")),
      ],
      movesOn: true
    ) { purpose in
      onAnswer(["purpose": purpose, "question": "purpose"])
    }
    .locksWhileSaving()
  }
}

/// Main's `ReasonStep`: each reason with the level it aims for and its hours from scratch. One with
/// a level moves on when it's picked; a certificate and Something else ask for words first.
private struct ReasonQuestion: View {
  let subject: String
  let reasons: [LanguageAimView.Reason]
  let onAnswer: ([String: Any]) -> Void

  @State private var picked: String?
  @State private var words = ""

  var body: some View {
    StepHeader(
      subject: subject,
      title: Text(
        "Why are you learning it?", tableName: "Onboarding",
        comment: "Onboarding question for a language goal"),
      description: Text(
        "Your answer sets how far your course goes.", tableName: "Onboarding",
        comment: "Under the language reason question"))

    Section {
      ForEach(reasons, id: \.reason) { reason in
        Button {
          pick(reason.reason)
        } label: {
          row(reason)
        }
        .pickedRow(picked == reason.reason)
        .accessibilityAddTraits(picked == reason.reason ? .isSelected : [])

        if picked == reason.reason, Self.asksWords(reason.reason) {
          wordsField(reason.reason)
        }
      }
    } footer: {
      SectionFooter {
        Text(
          "Hours of study from scratch, practice included. Less if you already know some.",
          tableName: "Onboarding",
          comment: "Under the reasons to learn a language, with their hours")
      }
    }
    .locksWhileSaving()

    if let picked, Self.asksWords(picked) {
      StepButtons(
        canContinue: picked != "certificate" || !trimmed(words).isEmpty, canSkip: false
      ) {
        answer(picked)
      }
    }
  }

  private static func asksWords(_ reason: String) -> Bool {
    reason == "certificate" || reason == "other"
  }

  private func pick(_ reason: String) {
    picked = reason

    if !Self.asksWords(reason) {
      announcePolitely(
        String(
          localized: "You picked \(Self.copy(reason, aim: nil).label)", table: "Onboarding",
          comment: "VoiceOver, as a one-answer question moves on: the answer picked"))
      answer(reason)
    }
  }

  private func answer(_ reason: String) {
    var input: [String: Any] = ["question": "reason", "reason": reason]

    if Self.asksWords(reason) {
      input["words"] = trimmed(words).isEmpty ? NSNull() : trimmed(words)
    }

    onAnswer(input)
  }

  private func row(_ reason: LanguageAimView.Reason) -> some View {
    let copy = Self.copy(reason.reason, aim: reason.aim)

    return HStack(spacing: 12) {
      VStack(alignment: .leading, spacing: 2) {
        Text(copy.label)
          .foregroundStyle(.primary)

        Text(copy.description)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      VStack(alignment: .trailing, spacing: 2) {
        if let aim = reason.aim {
          Text(verbatim: aim)
            .foregroundStyle(Color(.foreground))

          if let hours = reason.hours {
            Text(
              "\(hours.formatted()) h", tableName: "Onboarding",
              comment: "Hours of study, as a short figure like '190 h'"
            )
            .foregroundStyle(.mutedForeground)
          }
        } else {
          Text(
            "Exam", tableName: "Onboarding",
            comment: "Beside a language goal's reason: a certificate's plan follows its exam"
          )
          .foregroundStyle(Color(.foreground))
        }
      }
      .typeStyle(.data)
    }
    .contentShape(.rect)
  }

  @ViewBuilder
  private func wordsField(_ reason: String) -> some View {
    if reason == "certificate" {
      VStack(alignment: .leading, spacing: 8) {
        LabeledField(
          label: Text(
            "Which one?", tableName: "Onboarding",
            comment: "Box for the certificate a language learner wants to pass"),
          prompt: nil, text: $words)

        Text(
          "Your plan follows that exam's papers and score.", tableName: "Onboarding",
          comment: "Under the certificate a language learner wants to pass"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }
    } else {
      LabeledField(
        label: Text(
          "In your own words", tableName: "Onboarding",
          comment: "Box for a language learner's own reason"),
        prompt: nil, text: $words)
    }
  }

  /// Main's `useReasonCopy`.
  private static func copy(_ reason: String, aim: String?) -> (label: String, description: String) {
    let description =
      switch reason {
      case "travel":
        String(
          localized: "Get by on trips: order, ask the way, small talk", table: "Onboarding",
          comment: "Under the Travel reason")
      case "talk":
        String(
          localized: "Everyday conversations, at home or abroad", table: "Onboarding",
          comment: "Under the Talk with people reason")
      case "work":
        String(
          localized: "Meetings, interviews and classes", table: "Onboarding",
          comment: "Under the Work or study in it reason")
      case "fluent":
        String(
          localized: "Talk about almost anything with ease", table: "Onboarding",
          comment: "Under the Speak it fluently reason")
      case "certificate":
        String(
          localized: "IELTS, DELE, CELI and others", table: "Onboarding",
          comment: "Under the Pass a certificate reason")
      default:
        String(
          localized: "In your own words. Aims for \(aim ?? "")", table: "Onboarding",
          comment: "Under the Something else reason; the argument is a language level like B1")
      }

    return (languageReasonLabel(reason) ?? reason, description)
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
    .locksWhileSaving()

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
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
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
    case admission, position, score

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
    .locksWhileSaving()

    StepButtons(canContinue: !trimmed(text).isEmpty) {
      onAnswer(answer(trimmed(text)))
    } onSkip: {
      onAnswer(answer(nil))
    }
  }

  private func answer(_ value: String?) -> [String: Any] {
    ["question": "target", "target": value ?? NSNull()]
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
        description: Text([passedNote, withoutDate].compactMap { $0 }.joinedSentences()))

      Section {
        if let date {
          DatePicker(
            selection: Binding {
              date
            } set: {
              self.date = $0
            }, in: GoalDate.range(today: today),
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
      .locksWhileSaving()

      StepButtons(
        canContinue: date != nil,
        skipLabel: Text(
          "No date, study everything", tableName: "Onboarding", comment: "Skips the goal's date"),
        skipIcon: nil
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
          "Your plan paces your lessons to end by then.", table: "Onboarding",
          comment: "Under the exam's date"
        ))
      : String(
        localized: LocalizedStringResource(
          "Your plan paces your lessons to end by the first day.", table: "Onboarding",
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
      description: Text([passedNote, ready, estimated].compactMap { $0 }.joinedSentences()))

    StepButtons(
      skipLabel: Text(
        "Another date", tableName: "Onboarding", comment: "Picks another date than the exam's"),
      skipIcon: nil
    ) {
      onAnswer(["question": "targetDate", "targetDate": first])
    } onSkip: {
      picksOtherDate = true
    }
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

  /// Core counts a goal's or draft's days in its zone, UTC without one, so date pickers do too.
  static func today(now: Date, timeZone: String?) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone.flatMap(TimeZone.init(identifier:)) ?? .gmt
    let parts = calendar.dateComponents([.year, .month, .day], from: now)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }

  /// The deadlines core accepts: after `today`, and no later than a plan reaches (3,650 days).
  static func range(today: String) -> ClosedRange<Date> {
    let calendar = Calendar.isoLocal
    let goalToday = UnderstoodRows.day(today) ?? calendar.startOfDay(for: .now)
    let tomorrow = calendar.date(byAdding: .day, value: 1, to: goalToday) ?? goalToday
    return tomorrow...(calendar.date(byAdding: .day, value: 3650, to: goalToday) ?? goalToday)
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
    .locksWhileSaving()

    StepButtons {
      onAnswer(["answers": answers.map(value), "question": "followUps"])
    } onSkip: {
      onAnswer(["answers": questions.map { _ in NSNull() }, "question": "followUps"])
    }
  }
}

func examChoiceQuestionDescription(_ choices: [Components.Schemas.ExamChoice]) -> String {
  if choices.count == 1, let choice = choices.first, choice.take > 1 {
    return String(
      localized:
        "The exam offers \(choice.options.count) options for \(choice.group), and each candidate takes \(choice.take) of them. Your plan and mocks follow the ones you pick, and you can change them in your plan.",
      table: "Onboarding",
      comment:
        "Under the exam choice question. The second argument is the notice's name for the choice, such as the modules a course takes, in the notice's own language; the third is how many of the options each candidate takes"
    )
  }

  if choices.count == 1, let choice = choices.first {
    return String(
      localized:
        "The exam offers \(choice.options.count) options for \(choice.group). Your plan and mocks follow the one you pick, and you can change it in your plan.",
      table: "Onboarding",
      comment:
        "Under the exam choice question. The second argument is the notice's name for the choice, such as a specialty or the foreign language, in the notice's own language"
    )
  }

  return String(
    localized:
      "The exam has \(choices.count) choices to make. Your plan and mocks follow your picks, and you can change them in your plan.",
    table: "Onboarding", comment: "Under the exam choice question, for several choices")
}

private struct ExamChoiceQuestion: View {
  let subject: String
  let choices: [Components.Schemas.ExamChoice]
  let onAnswer: ([String: Any]) -> Void

  @State private var picks: [String: [String]]

  init(
    subject: String, choices: [Components.Schemas.ExamChoice],
    onAnswer: @escaping ([String: Any]) -> Void
  ) {
    self.subject = subject
    self.choices = choices
    self.onAnswer = onAnswer
    _picks = State(
      initialValue: Dictionary(
        choices.map { ($0.group, $0.subjects) }, uniquingKeysWith: { first, _ in first }))
  }

  var body: some View {
    let takes = choices.map(\.take).reduce(0, +)

    StepHeader(
      subject: subject,
      title: takes == 1
        ? Text(
          "Which one will you take?", tableName: "Onboarding",
          comment: "Asks which of an exam's optional subjects the learner takes")
        : Text(
          "Which ones will you take?", tableName: "Onboarding",
          comment:
            "Asks which of an exam's optional subjects the learner takes, for several choices"),
      description: Text(examChoiceQuestionDescription(choices)))

    ForEach(choices, id: \.group) { choice in
      let options = choice.options.map {
        GoalPlan.ExamChoice.Option(name: $0.name, shortName: $0.shortName)
      }
      let leftOut = Text(
        ExamChoiceLeftOut(
          examPoints: choice.leftOut.examPoints, examQuestions: choice.leftOut.examQuestions,
          name: choice.leftOut.name, points: choice.leftOut.points,
          questions: choice.leftOut.questions
        ).line)

      if choice.take > 1 {
        Section {
          Text.examPickLimit(choice.take)
            .typeStyle(.body)
            .foregroundStyle(.mutedForeground)
            .listRowSeparator(.hidden)

          ExamOptionToggles(
            options: options, take: choice.take,
            picked: Binding(
              get: { picks[choice.group] ?? [] },
              set: { picks[choice.group] = $0 }))
        } header: {
          SectionTitle(Text(choice.group))
        } footer: {
          SectionFooter {
            leftOut
          }
        }
      } else {
        ChoiceRows(
          choices: options.map { option in
            .init(
              value: option.name,
              label: option.shortName ?? option.name,
              detail: option.shortName.flatMap { $0 == option.name ? nil : Text(option.name) })
          },
          picked: picks[choice.group]?.first,
          header: Text(choice.group),
          footer: leftOut,
          movesOn: takes == 1
        ) { name in
          picks[choice.group] = [name]

          // One option to pick moves on once it's picked; more wait for Continue.
          if takes == 1 {
            submit()
          }
        }
      }
    }
    .locksWhileSaving()

    StepButtons(
      canContinue: choices.allSatisfy { !(picks[$0.group] ?? []).isEmpty },
      skipLabel: Text(
        "Decide later", tableName: "Onboarding", comment: "Leaves an exam's choice for later"),
      onContinue: submit
    ) {
      onAnswer(["choices": NSNull(), "question": "examChoice"])
    }
  }

  private func submit() {
    onAnswer([
      "choices": choices.compactMap { choice -> [String: Any]? in
        let subjects = choice.options.map(\.name).filter((picks[choice.group] ?? []).contains)
        return subjects.isEmpty ? nil : ["group": choice.group, "subjects": subjects]
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

    ChoiceRows(choices: LevelChoices.all(testMinutes: testMinutes), movesOn: true) { level in
      onAnswer(["level": LevelChoices.answer(level) ?? NSNull(), "question": "level"])
    }
    .locksWhileSaving()
  }
}

/// Main's `OnboardingOwnLevel`: the level a learner says they have.
enum OwnLevel: String {
  case none, basic, intermediate, advanced

  var label: LocalizedStringResource {
    switch self {
    case .none:
      LocalizedStringResource(
        "Nothing, I'm just starting", table: "Onboarding", comment: "Level choice")
    case .basic:
      LocalizedStringResource("The basics", table: "Onboarding", comment: "Level choice")
    case .intermediate:
      LocalizedStringResource("I studied it before", table: "Onboarding", comment: "Level choice")
    case .advanced:
      LocalizedStringResource("I know it well", table: "Onboarding", comment: "Level choice")
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
        value: OwnLevel.none.rawValue,
        label: String(localized: OwnLevel.none.label),
        detail: Text(
          "From scratch, with everyday examples", tableName: "Onboarding",
          comment: "Level choice detail")),
      .init(
        value: OwnLevel.basic.rawValue,
        label: String(localized: OwnLevel.basic.label),
        detail: Text("I know a few things", tableName: "Onboarding", comment: "Level choice detail")
      ),
      .init(
        value: OwnLevel.intermediate.rawValue,
        label: String(localized: OwnLevel.intermediate.label),
        detail: Text(
          "We'll skip what you already know", tableName: "Onboarding",
          comment: "Level choice detail")),
      .init(
        value: OwnLevel.advanced.rawValue,
        label: String(localized: OwnLevel.advanced.label),
        detail: Text(
          "Only what's new or hard", tableName: "Onboarding", comment: "Level choice detail")),
      .init(
        value: quickTest,
        label: String(
          localized: "Not sure, give me a quick test", table: "Onboarding",
          comment: "Level choice"),
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
    .locksWhileSaving()

    StepButtons(
      continueLabel: known.isEmpty
        ? Text(
          "None of them yet", tableName: "Onboarding",
          comment: "Continues without any of the listed subjects known well")
        : nil,
      skipLabel: Text(
        "I'm starting from scratch", tableName: "Onboarding",
        comment: "Says the learner knows none of the exam yet"),
      skipIcon: nil
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
      .locksWhileSaving()

    StepButtons {
      onAnswer(["buddy": ["kind": kind.rawValue, "name": value(name)], "question": "buddy"])
    }
  }
}
