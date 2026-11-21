import SwiftUI

/// Main's `TimeAnswer`, shared by the time question and the plan editor: one line that says what the
/// time shown gets the learner, and what covering everything takes when the suggestion doesn't. It
/// never says a time covers everything unless it does, and offers another time only when the
/// suggestion covers everything.
struct TimeAnswer: View {
  struct GoalDate: Equatable {
    let isoDate: String
    let namedMonth: Bool
  }

  let date: GoalDate?
  let exam: Bool
  /// The plan's answer for the days shown, nil while it's asked for.
  let found: TimeToCover?
  let line: ScheduleTime.Line
  let minutes: Int?
  var split: DaySplit?
  /// The last answer, still in place while the new one is worked out.
  var updating = false
  /// A language goal's aim above the learner's level, which its finish is when they reach.
  var aim: String?
  let onRetry: () -> Void
  let onUseOffer: (Int) -> Void

  @Environment(\.legibilityWeight) private var legibility

  var body: some View {
    let failed = line == .askFailed || line == .findFailed
    let offer = failed ? nil : ScheduleTime.offer(found: found, line: line, minutes: minutes)

    VStack(alignment: .leading, spacing: 8) {
      if let lineWords {
        Text(Self.sharedOut(lineWords, line: line), strong: .semibold, legibility: legibility)
          .foregroundStyle(.mutedForeground)
      }

      if line != .unmeasured, !line.coversEverything,
        let everything = ScheduleTime.everythingTakes(found)
      {
        Text(Self.everythingTakes(everything))
          .foregroundStyle(.mutedForeground)
      }

      if failed {
        Button {
          onRetry()
        } label: {
          Text("Try again", tableName: "Onboarding", comment: "Asks again what a time covers")
        }
      } else if let offer {
        Button {
          onUseOffer(offer)
        } label: {
          Self.offerLabel(offer)
            .multilineTextAlignment(.leading)
        }
      }
    }
    .typeStyle(.body)
    .buttonStyle(.outline)
    .controlSize(.small)
    .opacity(updating ? 0.5 : 1)
    .announcesStatus(line.isBusy || updating ? nil : lineWords)
  }

  /// The picker's times: the suggestion marked, and beside a focus the time that covers everything.
  static func choiceLabel(_ minutes: Int, marked: (full: Int?, suggested: Int?)) -> String {
    let time = duration(minutes)

    if minutes == marked.suggested {
      return String(
        localized: "\(time) (suggested)", table: "Onboarding",
        comment: "The time a day the plan suggests, among the times to pick")
    }

    return minutes == marked.full
      ? String(
        localized: "\(time) (covers everything)", table: "Onboarding",
        comment:
          "A daily study time in a list of times: the one that covers the learner's whole goal by its date. {time} is like \"10 h\"."
      )
      : time
  }

  static func offerLabel(_ minutes: Int) -> Text {
    Text(
      "Use \(duration(minutes)) to cover everything", tableName: "Onboarding",
      comment:
        "Picks the time a day that covers the whole goal by its date; the argument is a time like '45 min'. Say \"cover everything\", not \"study everything\": studying after an exam is a different choice."
    )
  }

  /// What covering everything takes, under a sentence that already names the date.
  static func everythingTakes(_ everything: ScheduleTime.Everything) -> String {
    switch everything {
    case .takes(let full) where full.everything:
      planEverythingTakesText(minutes: full.minutes)
    case .takes(let full):
      planMostTimeText(minutes: full.minutes)
    case .neverFits:
      String(
        localized: "There isn't enough time to cover everything.", table: "Plan",
        comment:
          "Under a sentence that already names the goal's date: the same words as \"There isn't enough time to cover everything by {date}.\" without the date."
      )
    }
  }

  private static func duration(_ minutes: Int) -> String {
    planDurationText(minutes: Double(minutes))
  }

  /// Main's share line: the share stands out in its sentence.
  private static func sharedOut(_ words: String, line: ScheduleTime.Line) -> AttributedString {
    var text = AttributedString(words)

    switch line {
    case .share(let share) where share < 1:
      if let range = text.range(of: percent(share)) {
        text[range].inlinePresentationIntent = .stronglyEmphasized
      }
    default:
      break
    }

    return text
  }

  nonisolated private static func percent(_ share: Double) -> String {
    share.formatted(.percent.precision(.fractionLength(0)))
  }

  private var lineWords: String? {
    let joined = [statusWords, split.map(Self.splitWords)].compactMap { $0 }.joinedSentences()
    return joined.isEmpty ? nil : joined
  }

  private static func splitWords(_ split: DaySplit) -> String {
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

  private var statusWords: String? {
    let time = Self.duration(minutes ?? 0)
    let shown = date.map { PlanDate.longText($0.isoDate, month: $0.namedMonth) }
    let month = date?.namedMonth == true

    switch line {
    case .everything:
      return shown.map { Self.everythingWords(exam: exam, month: month, date: $0) }
    case .everythingKept:
      return shown.map { date in
        month
          ? String(
            localized: "Covers everything in your plan by the start of \(date).",
            table: "Onboarding",
            comment:
              "In the month form, {date} is a month, like \"May 2027\"; otherwise a day, like \"May 5\"."
          )
          : String(
            localized: "Covers everything in your plan by \(date).", table: "Onboarding",
            comment:
              "In the month form, {date} is a month, like \"May 2027\"; otherwise a day, like \"May 5\"."
          )
      }
    case .share(let share):
      return shown.map { Self.shareWords(share, exam: exam, month: month, date: $0) }
    case .unmeasured:
      return nil
    case .pastDate:
      return shown.map { date in
        month
          ? String(
            localized:
              "Your date, the start of \(date), has passed.",
            table: "Onboarding",
            comment:
              "The goal's date has passed; the argument is the month the learner named, like 'May 2027'"
          )
          : String(
            localized:
              "Your date, \(date), has passed.",
            table: "Onboarding",
            comment: "The goal's date has passed; the argument is a date like 'May 5, 2027'")
      }
    case .finish(let endDate) where aim != nil && minutes != nil:
      return String(
        localized:
          "At \(planDurationText(minutes: Double(minutes ?? 0))) a day, you reach \(aim ?? "") around \(PlanDate.longText(endDate, month: true)).",
        table: "Onboarding",
        comment:
          "When a language goal reaches its aim at the time picked; the arguments are a duration like '30 min', a level like 'B1' and a month like 'May 2027'"
      )
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
          "We can't estimate an end date. Try more time or more study days.",
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
      return shown == nil
        ? String(
          localized: "Working out when you'd finish…", table: "Onboarding",
          comment: "While the plan works out when a goal without a date finishes")
        : String(
          localized: "Working out what \(time) a day covers…", table: "Onboarding",
          comment: "While the plan works out what a time a day covers")
    case .askFailed:
      return shown == nil
        ? String(
          localized: "We couldn't work out when you'd finish.", table: "Onboarding",
          comment: "When a goal without a date finishes couldn't be worked out")
        : String(
          localized: "We couldn't work out what \(time) a day covers.", table: "Onboarding",
          comment: "What a time a day covers couldn't be read")
    }
  }

  private static func everythingWords(exam: Bool, month: Bool, date: String) -> String {
    switch (exam, month) {
    case (true, false):
      String(
        localized: "Covers all your exam topics by \(date).", table: "Onboarding",
        comment:
          "The time a day shown covers a whole exam; the argument is a date like 'May 5, 2027'")
    case (true, true):
      String(
        localized: "Covers all your exam topics by the start of \(date).", table: "Onboarding",
        comment:
          "The time a day shown covers a whole exam; the argument is the month the learner named, like 'May 2027'"
      )
    case (false, false):
      String(
        localized: "Covers your whole goal by \(date).", table: "Onboarding",
        comment:
          "The time a day shown covers a whole goal; the argument is a date like 'May 5, 2027'")
    case (false, true):
      String(
        localized: "Covers your whole goal by the start of \(date).", table: "Onboarding",
        comment:
          "The time a day shown covers a whole goal; the argument is the month the learner named, like 'May 2027'"
      )
    }
  }

  /// What the time reaches by the date: the first lessons of every topic, or of a share that stands
  /// out.
  nonisolated static func shareWords(_ share: Double, exam: Bool, month: Bool, date: String)
    -> String
  {
    guard share < 1 else {
      return everyTopicWords(exam: exam, month: month, date: date)
    }

    let percent = Self.percent(share)

    return switch (exam, month) {
    case (true, false):
      String(
        localized:
          "Covers the first lessons of about \(percent) of your exam by \(date).",
        table: "Onboarding",
        comment:
          "The share of an exam whose topics get their first lessons at a time a day, by its date; the second argument is a date like 'May 5, 2027'. The share is of the whole exam, by how much it asks, not a share of its topics."
      )
    case (true, true):
      String(
        localized:
          "Covers the first lessons of about \(percent) of your exam by the start of \(date).",
        table: "Onboarding",
        comment:
          "The share of an exam whose topics get their first lessons at a time a day, by its date; the second argument is the month the learner named, like 'May 2027'. The share is of the whole exam, by how much it asks, not a share of its topics."
      )
    case (false, false):
      String(
        localized:
          "Covers the first lessons of about \(percent) of your goal by \(date).",
        table: "Onboarding",
        comment:
          "The share of a goal whose parts get their first lessons at a time a day, by its date; the second argument is a date like 'May 5, 2027'"
      )
    case (false, true):
      String(
        localized:
          "Covers the first lessons of about \(percent) of your goal by the start of \(date).",
        table: "Onboarding",
        comment:
          "The share of a goal whose parts get their first lessons at a time a day, by its date; the second argument is the month the learner named, like 'May 2027'"
      )
    }
  }

  /// Every topic is in, though not everything: no topic is said to get more than its first lessons.
  nonisolated private static func everyTopicWords(exam: Bool, month: Bool, date: String) -> String {
    switch (exam, month) {
    case (true, false):
      String(
        localized: "Covers the first lessons of every exam topic by \(date).", table: "Onboarding",
        comment:
          "A time a day reaches every exam topic, not all of each; the argument is a date like 'May 5, 2027'"
      )
    case (true, true):
      String(
        localized: "Covers the first lessons of every exam topic by the start of \(date).",
        table: "Onboarding",
        comment:
          "A time a day reaches every exam topic, not all of each; the argument is the month the learner named, like 'May 2027'"
      )
    case (false, false):
      String(
        localized: "Covers the first lessons of every part of your goal by \(date).",
        table: "Onboarding",
        comment:
          "A time a day reaches every part of a goal, not all of each; the argument is a date like 'May 5, 2027'"
      )
    case (false, true):
      String(
        localized: "Covers the first lessons of every part of your goal by the start of \(date).",
        table: "Onboarding",
        comment:
          "A time a day reaches every part of a goal, not all of each; the argument is the month the learner named, like 'May 2027'"
      )
    }
  }
}
