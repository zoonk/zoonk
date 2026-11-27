import SwiftUI

/// Main's `TimeAnswer`, shared by the time question and the plan editor: one line under the picker.
/// For a goal with a date it says the time the plan suggests, so it stays put as times are picked,
/// with a button to use that time while a shorter one is picked; for one without, when the time
/// picked finishes it.
struct TimeAnswer: View {
  struct GoalDate: Equatable {
    let isoDate: String
    let namedMonth: Bool
    /// An exam's likely day, until its notice confirms it.
    var estimated = false
  }

  let date: GoalDate?
  let exam: Bool
  let line: ScheduleTime.Line
  let minutes: Int?
  var split: DaySplit?
  /// The last answer, still in place while the new one is worked out.
  var updating = false
  /// A language goal's aim above the learner's level, which its finish is when they reach.
  var aim: String?
  var subjectsTakenOut = false
  let onRetry: () -> Void
  let onUseOffer: (Int) -> Void

  var body: some View {
    let failed = line == .askFailed || line == .findFailed
    let offer = ScheduleTime.offer(line: line, minutes: minutes)

    VStack(alignment: .leading, spacing: 8) {
      if let lineWords {
        Text(lineWords)
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
          Text(
            "Use \(Self.duration(offer))", tableName: "Onboarding",
            comment:
              "A button that sets the daily study time to the one we suggest. {time} is like \"2 h\"."
          )
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

  /// The picker's times, the suggestion marked.
  static func choiceLabel(_ minutes: Int, suggested: Int?) -> String {
    let time = duration(minutes)

    return minutes == suggested
      ? String(
        localized: "\(time) (suggested)", table: "Onboarding",
        comment: "The time a day the plan suggests, among the times to pick")
      : time
  }

  private static func duration(_ minutes: Int) -> String {
    planDurationText(minutes: Double(minutes))
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
    let shown = date.map {
      PlanDate.goalText($0.isoDate, month: $0.namedMonth, estimated: $0.estimated)
    }
    let month = date?.namedMonth == true

    switch line {
    case .suggests(let suggested):
      return shown.map {
        Self.suggestionWords(
          suggested, exam: exam, date: $0, subjectsTakenOut: subjectsTakenOut)
      }
    case .quiet:
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
      return String(
        localized: "Working out when you'd finish…", table: "Onboarding",
        comment: "While the plan works out when a goal without a date finishes")
    case .askFailed:
      return String(
        localized: "We couldn't work out when you'd finish.", table: "Onboarding",
        comment: "When a goal without a date finishes couldn't be worked out")
    }
  }

  /// Main's suggestion line: the time that gets the learner ready by their date, or, when that's
  /// more than a day can hold, the time the plan starts on with what matters most. `date` is a day,
  /// or the month the learner named.
  static func suggestionWords(
    _ suggested: TimeToCover.Suggested, exam: Bool, date: String, subjectsTakenOut: Bool
  ) -> String {
    let time = duration(suggested.minutes)

    return switch (suggested.kind, exam) {
    case (.everything, _) where subjectsTakenOut:
      String(
        localized: "We suggest \(time) a day to cover everything in your plan by \(date).",
        table: "Onboarding",
        comment:
          "When the learner took a subject out of their plan. In the month form, {date} is a month, like \"May 2027\"; otherwise a day, like \"May 5\". {time} is a daily study time, like \"2 h\"."
      )
    case (.everything, true):
      String(
        localized: "We suggest \(time) a day to be ready for your exam by \(date).",
        table: "Onboarding",
        comment:
          "In the month form, {date} is a month, like \"May 2027\"; otherwise a day, like \"May 5\". {time} is a daily study time, like \"2 h\"."
      )
    case (.everything, false):
      String(
        localized: "We suggest \(time) a day to reach your goal by \(date).",
        table: "Onboarding",
        comment:
          "In the month form, {date} is a month, like \"May 2027\"; otherwise a day, like \"May 5\". {time} is a daily study time, like \"2 h\"."
      )
    case (.focus, true):
      String(
        localized:
          "We suggest \(time) a day. Your plan starts with what matters most for your exam.",
        table: "Onboarding",
        comment:
          "When studying everything by the exam would take more than most people keep up: {time} is the most we suggest a day, and the plan studies what the exam asks most first."
      )
    case (.focus, false):
      String(
        localized:
          "We suggest \(time) a day. Your plan starts with what matters most for your goal.",
        table: "Onboarding",
        comment:
          "When studying everything by the goal's date would take more than most people keep up: {time} is the most we suggest a day, and the plan studies what matters most first."
      )
    }
  }
}
