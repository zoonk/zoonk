import SwiftUI

/// Main's `TimeAnswer`, shared by the time question and the plan editor: one line under the picker
/// that says what the time shown gets the learner, and at most one link that names another time. It
/// never says a time covers everything unless it does.
struct TimeAnswer: View {
  struct GoalDate: Equatable {
    let isoDate: String
    let namedMonth: Bool
  }

  let date: GoalDate?
  let exam: Bool
  let line: ScheduleTime.Line
  let minutes: Int?
  let offer: ScheduleTime.Offer?
  var split: DaySplit?
  /// The last answer, still in place while the new one is worked out.
  var updating = false
  /// A language goal's aim above the learner's level, which its finish is when they reach.
  var aim: String?
  let onRetry: () -> Void
  let onUseOffer: (Int) -> Void

  var body: some View {
    let failed = line == .askFailed || line == .findFailed

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
        .typeStyle(.body.weight(.semibold))
      } else if let offer {
        Button {
          onUseOffer(offer.minutes)
        } label: {
          Self.offerLabel(offer)
            .multilineTextAlignment(.leading)
        }
        .typeStyle(.body.weight(.semibold))
      }
    }
    .typeStyle(.body)
    .buttonStyle(.borderless)
    .opacity(updating ? 0.5 : 1)
    .announcesStatus(line.isBusy || updating ? nil : lineWords)
  }

  static func choiceLabel(_ minutes: Int, suggested: Int?) -> String {
    let time = duration(minutes)

    return minutes == suggested
      ? String(
        localized: "\(time) (suggested)", table: "Onboarding",
        comment: "The time a day the plan suggests, among the times to pick")
      : time
  }

  static func offerLabel(_ offer: ScheduleTime.Offer) -> Text {
    let time = duration(offer.minutes)

    return switch offer.kind {
    case .everything:
      Text(
        "Use \(time) to cover everything", tableName: "Onboarding",
        comment:
          "Picks the time a day that covers the whole goal by its date; the argument is a time like '45 min'. Say \"cover everything\", not \"study everything\": studying after an exam is a different choice."
      )
    case .suggested:
      Text(
        "Use the suggested \(time)", tableName: "Onboarding",
        comment:
          "Picks the time a day the plan suggests, at most 4 hours; the argument is a time like '4 h'"
      )
    case .more:
      Text(
        "Use \(time) to cover more", tableName: "Onboarding",
        comment:
          "Picks the longer time a day that covers as much of the goal as any time can, when part of it never fits; the argument is a time like '8 h'"
      )
    }
  }

  private static func duration(_ minutes: Int) -> String {
    planDurationText(minutes: Double(minutes))
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
    case .focus(let share), .share(let share):
      return shown.map { Self.shareWords(share, exam: exam, month: month, date: $0) }
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

  nonisolated static func shareWords(_ share: Double, exam: Bool, month: Bool, date: String)
    -> String
  {
    let percent = Self.percent(share)

    return switch (exam, month) {
    case (true, false):
      String(
        localized:
          "Covers about \(percent) of your exam topics by \(date).",
        table: "Onboarding",
        comment:
          "The share of an exam a time a day covers by its date; the second argument is a date like 'May 5, 2027'"
      )
    case (true, true):
      String(
        localized:
          "Covers about \(percent) of your exam topics by the start of \(date).",
        table: "Onboarding",
        comment:
          "The share of an exam a time a day covers by its date; the second argument is the month the learner named, like 'May 2027'"
      )
    case (false, false):
      String(
        localized:
          "Covers about \(percent) of your goal by \(date).",
        table: "Onboarding",
        comment:
          "The share of a goal a time a day covers by its date; the second argument is a date like 'May 5, 2027'"
      )
    case (false, true):
      String(
        localized:
          "Covers about \(percent) of your goal by the start of \(date).",
        table: "Onboarding",
        comment:
          "The share of a goal a time a day covers by its date; the second argument is the month the learner named, like 'May 2027'"
      )
    }
  }
}
