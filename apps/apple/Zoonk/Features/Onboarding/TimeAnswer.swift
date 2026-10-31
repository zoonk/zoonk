import SwiftUI

/// Main's `TimeAnswer`, shared by the time question and the plan editor: what everything takes, what
/// the time shown covers, and the other time to pick. It never says a time covers everything unless
/// it does.
struct TimeAnswer: View {
  struct GoalDate: Equatable {
    let isoDate: String
    let namedMonth: Bool
  }

  enum NoteStatus {
    case finding
    case failed
  }

  let date: GoalDate?
  let exam: Bool
  let line: ScheduleTime.Line
  let minutes: Int?
  let note: ScheduleTime.FullTimeNote?
  var noteStatus: NoteStatus?
  let offer: ScheduleTime.Offer?
  var split: DaySplit?
  /// The last answer, still in place while the new one is worked out.
  var updating = false
  let onRetry: () -> Void
  let onUseOffer: (Int) -> Void

  var body: some View {
    let failed = line == .askFailed || line == .findFailed || noteStatus == .failed

    VStack(alignment: .leading, spacing: 8) {
      if let noteWords {
        Text(noteWords)
          .foregroundStyle(.secondary)
      }

      if let lineWords {
        Text(lineWords)
          .foregroundStyle(.secondary)
      }

      if failed {
        Button {
          onRetry()
        } label: {
          Text("Try again", tableName: "Onboarding", comment: "Asks again what a time covers")
        }
        .font(.subheadline.weight(.semibold))
      } else if let offer {
        Button {
          onUseOffer(offer.minutes)
        } label: {
          Self.offerLabel(offer)
        }
        .font(.subheadline.weight(.semibold))
      }
    }
    .font(.subheadline)
    .buttonStyle(.borderless)
    .opacity(updating ? 0.5 : 1)
    .onChange(of: line.isBusy || updating ? nil : announcement) { _, words in
      if let words {
        AccessibilityNotification.Announcement(words).post()
      }
    }
  }

  private var announcement: String {
    [noteWords, lineWords].compactMap { $0 }.joined(separator: " ")
  }

  static func choiceLabel(_ minutes: Int, full: Int?, suggested: Int?) -> String {
    let time = duration(minutes)

    if minutes == suggested {
      return String(
        localized: "\(time) (suggested)", table: "Onboarding",
        comment: "The time a day the plan suggests, among the times to pick")
    }

    return minutes == full
      ? String(
        localized: "\(time) (covers everything)", table: "Onboarding",
        comment:
          "The time a day that covers the whole goal by its date, among the times to pick. Say \"cover everything\", not \"study everything\": the \"Study everything, even after the exam\" switch beside it does something else."
      )
      : time
  }

  static func offerLabel(_ offer: ScheduleTime.Offer) -> Text {
    let time = duration(offer.minutes)

    return switch offer.kind {
    case .everything:
      Text(
        "Use \(time) a day to cover everything", tableName: "Onboarding",
        comment:
          "Picks the time a day that covers the whole goal by its date. Say \"cover everything\", not \"study everything\": the \"Study everything, even after the exam\" switch beside it does something else."
      )
    case .focus:
      Text(
        "Use the suggested \(time) a day", tableName: "Onboarding",
        comment:
          "Picks the time a day the plan suggests, at most 4 hours, which covers what's worth most first"
      )
    case .full:
      Text(
        "Use \(time) a day", tableName: "Onboarding",
        comment:
          "Picks the longer time a day just described, which covers everything or as much as any time can"
      )
    }
  }

  private static func duration(_ minutes: Int) -> String {
    planDurationText(minutes: Double(minutes))
  }

  private static func percent(_ share: Double) -> String {
    share.formatted(.percent.precision(.fractionLength(0)))
  }

  private var noteWords: String? {
    switch noteStatus {
    case .finding:
      return String(
        localized: "Working out the time your goal needs…", table: "Onboarding",
        comment: "While the plan works out the time a day a goal needs")
    case .failed:
      return String(
        localized: "We couldn't work out the time your goal needs.", table: "Onboarding",
        comment: "The time a day a goal needs couldn't be worked out")
    case nil:
      break
    }

    guard let date, case .takes(let full, let moreDays) = note else {
      return nil
    }

    let takes = Self.everythingTakes(full, date: date)

    guard moreDays else {
      return takes
    }

    let more = String(
      localized: "More study days would help.", table: "Onboarding",
      comment: "After what covering a goal takes, while the learner doesn't study every day")

    return "\(takes) \(more)"
  }

  private var lineWords: String? {
    var words = [statusWords]

    if note == .tooLong {
      words.append(
        String(
          localized: "That's more than most people can keep up.", table: "Onboarding",
          comment: "After a time a day that covers everything but is longer than people keep up"))
    }

    if let split {
      words.append(Self.splitWords(split))
    }

    let joined = words.compactMap { $0 }.joined(separator: " ")
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

  /// What covering everything takes beside a suggestion people keep up, or as much as any time covers
  /// when part never fits.
  private static func everythingTakes(_ full: ScheduleTime.FullTime?, date goalDate: GoalDate)
    -> String
  {
    let date = PlanDate.longText(goalDate.isoDate, month: goalDate.namedMonth)
    let month = goalDate.namedMonth

    guard let full else {
      return month
        ? String(
          localized: "Not even a whole day covers everything in depth by the start of \(date).",
          table: "Onboarding",
          comment: "No time a day covers the whole goal; the argument is a month like 'May 2027'")
        : String(
          localized: "Not even a whole day covers everything in depth by \(date).",
          table: "Onboarding",
          comment: "No time a day covers the whole goal; the argument is a date like 'May 5, 2027'")
    }

    let time = duration(full.minutes)

    guard !full.everything else {
      return month
        ? String(
          localized:
            "Covering everything in depth by the start of \(date) takes about \(time) a day, more than most people can keep up.",
          table: "Onboarding",
          comment:
            "What covering the whole goal takes; the first argument is a month like 'May 2027', the second a time like '13 h 30 min'"
        )
        : String(
          localized:
            "Covering everything in depth by \(date) takes about \(time) a day, more than most people can keep up.",
          table: "Onboarding",
          comment:
            "What covering the whole goal takes; the first argument is a date like 'May 5, 2027', the second a time like '13 h 30 min'"
        )
    }

    let share = Self.percent(full.coveredShare)

    return month
      ? String(
        localized:
          "Covering as much as any daily time can by the start of \(date), about \(share) in depth, takes about \(time) a day, more than most people can keep up.",
        table: "Onboarding",
        comment:
          "Part of the goal never fits whatever the time, so this is the most any time a day covers; the arguments are a month like 'May 2027', a percentage like '99%' and a time like '8 h'"
      )
      : String(
        localized:
          "Covering as much as any daily time can by \(date), about \(share) in depth, takes about \(time) a day, more than most people can keep up.",
        table: "Onboarding",
        comment:
          "Part of the goal never fits whatever the time, so this is the most any time a day covers; the arguments are a date like 'May 5, 2027', a percentage like '99%' and a time like '8 h'"
      )
  }

  private var statusWords: String? {
    let time = Self.duration(minutes ?? 0)
    let shown = date.map { PlanDate.longText($0.isoDate, month: $0.namedMonth) }
    let month = date?.namedMonth == true

    switch line {
    case .everything(let suggested):
      return shown.map {
        Self.everythingWords(suggested: suggested, exam: exam, month: month, date: $0)
      }
    case .focus(let coveredShare, let everyTopic):
      let suggest = String(
        localized: "We suggest \(time) a day.", table: "Onboarding",
        comment: "Before what the suggested time a day covers; the argument is a time like '4 h'")

      return
        "\(suggest) \(Self.focusWords(share: coveredShare, everyTopic: everyTopic, exam: exam))"
    case .share(let share):
      return shown.map { Self.shareWords(share, exam: exam, month: month, date: $0) }
    case .pastDate:
      return shown.map { date in
        month
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

  private static func everythingWords(suggested: Bool, exam: Bool, month: Bool, date: String)
    -> String
  {
    switch (suggested, exam, month) {
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

  private static func shareWords(_ share: Double, exam: Bool, month: Bool, date: String) -> String {
    let percent = Self.percent(share)

    return switch (exam, month) {
    case (true, false):
      String(
        localized:
          "Covers about \(percent) of your exam topics in depth by \(date), starting with what comes up most.",
        table: "Onboarding",
        comment:
          "The share of an exam a time a day covers by its date; the second argument is a date like 'May 5, 2027'"
      )
    case (true, true):
      String(
        localized:
          "Covers about \(percent) of your exam topics in depth by the start of \(date), starting with what comes up most.",
        table: "Onboarding",
        comment:
          "The share of an exam a time a day covers by its date; the second argument is the month the learner named, like 'May 2027'"
      )
    case (false, false):
      String(
        localized:
          "Covers about \(percent) of your goal in depth by \(date), starting with what matters most.",
        table: "Onboarding",
        comment:
          "The share of a goal a time a day covers by its date; the second argument is a date like 'May 5, 2027'"
      )
    case (false, true):
      String(
        localized:
          "Covers about \(percent) of your goal in depth by the start of \(date), starting with what matters most.",
        table: "Onboarding",
        comment:
          "The share of a goal a time a day covers by its date; the second argument is the month the learner named, like 'May 2027'"
      )
    }
  }

  private static func focusWords(share: Double, everyTopic: Bool, exam: Bool) -> String {
    let share = Self.percent(share)

    return switch (exam, everyTopic) {
    case (true, true):
      String(
        localized:
          "Your plan then covers every exam topic, the ones asked most in more depth. That's about \(share) of the exam studied in depth.",
        table: "Onboarding",
        comment:
          "What the suggested time a day studies of an exam; the argument is a percentage like '32%' of everything studied in depth, not of the topics reached"
      )
    case (true, false):
      String(
        localized:
          "Your plan then starts with what the exam asks most, about \(share) of it studied in depth. Topics it asks least may not fit.",
        table: "Onboarding",
        comment:
          "What the suggested time a day studies of an exam; the argument is a percentage like '32%' of everything studied in depth, not of the topics reached"
      )
    case (false, true):
      String(
        localized:
          "Your plan then covers every part of your goal, what matters most in more depth. That's about \(share) of it studied in depth.",
        table: "Onboarding",
        comment:
          "What the suggested time a day studies of a goal; the argument is a percentage like '32%' of everything studied in depth, not of the parts reached"
      )
    case (false, false):
      String(
        localized:
          "Your plan then starts with what matters most, about \(share) of your goal studied in depth. The rest may not fit.",
        table: "Onboarding",
        comment:
          "What the suggested time a day studies of a goal; the argument is a percentage like '32%' of everything studied in depth, not of the parts reached"
      )
    }
  }
}
