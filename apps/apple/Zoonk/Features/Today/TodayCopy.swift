import Foundation

// Names and lines for the day's blocks and missions, as main says them (`use-block-copy.ts`,
// `mission-copy.tsx`, `plan-status-label.tsx`), shared by Today and the session screen.

extension StudyBlock {
  /// A review's questions come in capsules, except the first week's warm-up, which is placement's
  /// questions only.
  private var hasCapsules: Bool {
    kind == .review && !capsules.isEmpty
  }

  /// The phase a phase's challenge closes, by name; nil for other blocks and a weekly challenge.
  var challengePhase: String? {
    guard let checkpoint, !checkpoint.isWeekly else {
      return nil
    }

    return title
  }

  /// The block's name: the lesson's title for lessons, what the block is for the rest.
  var displayTitle: String {
    if let checkpoint {
      if checkpoint.isWeekly {
        return checkpoint.mock
          ? String(localized: "Mock exam", table: "Today", comment: "A weekly mock exam block")
          : String(
            localized: "Weekly challenge", table: "Today", comment: "The week's challenge block")
      }

      if checkpoint.kind == "finalBoss" {
        return String(
          localized: "Final challenge", table: "Today", comment: "The plan's final challenge block")
      }

      return checkpoint.rematch
        ? String(
          localized: "Challenge, second try", table: "Today",
          comment: "A phase challenge taken again")
        : String(localized: "Phase challenge", table: "Today", comment: "A phase's challenge block")
    }

    switch kind {
    case .review where !hasCapsules:
      return String(
        localized: "What you already know", table: "Today",
        comment: "The first week's warm-up block of placement questions")
    case .review:
      return estimatedMinutes > 5
        ? String(localized: "Reviews", table: "Today", comment: "A review block longer than 5 min")
        : String(localized: "Quick review", table: "Today", comment: "A short review block")
    case .learn:
      return title
        ?? String(
          localized: "New lesson", table: "Today", comment: "A lesson block without a title")
    case .produce:
      return title
        ?? String(localized: "Writing practice", table: "Today", comment: "A writing block")
    case .practice, .checkpoint:
      if fullReview {
        return String(localized: "Full review", table: "Today", comment: "A full review block")
      }

      if mistakesOnly {
        return String(
          localized: "Practice mistakes", table: "Today", comment: "A block fixing mistakes")
      }

      return extra
        ? String(localized: "Bonus practice", table: "Today", comment: "An extra practice block")
        : String(localized: "Mixed practice", table: "Today", comment: "A practice block")
    }
  }

  /// What's inside the block, in a few words; nil when its name says it.
  var detail: String? {
    if hasCapsules && weakest {
      return String(
        localized: "No reviews due today · \(questions) questions on your weakest topics",
        table: "Today", comment: "A review of the weakest topics when nothing was due")
    }

    if hasCapsules {
      let titles = capsules.compactMap(\.title)
      let shown = titles.prefix(2).formatted(.list(type: .and))
      let reviewed = capsules.reduce(0) { $0 + $1.questions }
      let topics =
        titles.count > 2
        ? String(
          localized: "\(shown) and \(titles.count - 2) more", table: "Today",
          comment: "A short list of topics and how many more")
        : shown

      return questions > reviewed
        ? String(
          localized: "\(questions) questions · \(topics), plus what you already know",
          table: "Today", comment: "A review's questions and its topics")
        : String(
          localized: "\(questions) questions · \(topics)", table: "Today",
          comment: "A review's questions and its topics")
    }

    if kind == .learn {
      return reinforcement
        ? String(
          localized: "Short lesson before the rematch", table: "Today",
          comment: "A lesson before a challenge's rematch")
        : canDo
    }

    if let phase = challengePhase {
      return String(
        localized: "\(phase) · \(questions) questions, no hints", table: "Today",
        comment: "A phase challenge's phase and questions")
    }

    if checkpoint != nil {
      return String(
        localized: "\(questions) questions, no hints", table: "Today",
        comment: "A challenge's questions")
    }

    if kind == .produce {
      return canDo
    }

    if fullReview {
      return String(
        localized: "\(questions) questions on every topic, your weakest first", table: "Today",
        comment: "A full review's questions")
    }

    return String(
      localized: "\(questions) questions", table: "Today", comment: "A practice block's questions")
  }

  /// What a row still to do says under its name: what it's part of, or what its challenge waits for.
  func label(isCatchingUp: Bool) -> String? {
    if let waitReason {
      let phase = challengePhase

      switch (waitReason, phase) {
      case (.lessons, let phase?):
        return String(
          localized: "\(phase) · after today's lessons", table: "Today",
          comment: "A phase challenge waiting for the day's lessons")
      case (.lessons, nil):
        return String(
          localized: "After today's lessons", table: "Today",
          comment: "A challenge waiting for the day's lessons")
      case (.challenge, let phase?):
        return String(
          localized: "\(phase) · after the challenge before it", table: "Today",
          comment: "A phase challenge waiting for the one before it")
      case (.challenge, nil):
        return String(
          localized: "After the challenge before it", table: "Today",
          comment: "A challenge waiting for the one before it")
      }
    }

    let part: String?

    if isCatchingUp {
      part =
        subject.map {
          String(
            localized: "Catching up · \($0)", table: "Today",
            comment: "A lesson left from earlier days, and its subject")
        }
        ?? String(localized: "Catching up", table: "Today", comment: "A lesson from earlier days")
    } else {
      part = subject ?? challengePhase
    }

    guard oftenTested else {
      return part
    }

    return part.map {
      String(
        localized: "\($0) · often tested", table: "Today", comment: "A topic the exam asks a lot")
    } ?? String(localized: "Often tested", table: "Today", comment: "A topic the exam asks a lot")
  }
}

extension TodayView.PlanStatus {
  /// Where the plan stands, in a few words ("Keeping pace", "2 days ahead").
  var text: String {
    switch kind {
    case "ahead":
      String(localized: "\(days ?? 0) days ahead", table: "Today", comment: "Plan status")
    case "behind":
      if let lessons {
        String(
          localized: "\(lessons) lessons to catch up", table: "Today", comment: "Plan status")
      } else {
        String(localized: "\(days ?? 0) days behind", table: "Today", comment: "Plan status")
      }
    case "challengesLeft":
      String(
        localized: "\(challenges ?? 0) challenges left", table: "Today", comment: "Plan status")
    case "finished":
      String(localized: "Plan finished", table: "Today", comment: "Plan status")
    case "needsAdjusting":
      String(localized: "Needs adjusting", table: "Today", comment: "Plan status")
    case "pastDate":
      String(localized: "Past your date", table: "Today", comment: "Plan status")
    default:
      String(localized: "Keeping pace", table: "Today", comment: "Plan status")
    }
  }
}

/// Minutes as main writes them: "6 min", "1 hr", "1 hr 43 min".
func studyDuration(minutes: Int) -> String {
  let style = Measurement<UnitDuration>.FormatStyle(width: .abbreviated)
  let hours = minutes / 60
  let rest = minutes % 60
  let minutePart = Measurement(value: Double(rest), unit: UnitDuration.minutes).formatted(style)

  guard hours > 0 else {
    return minutePart
  }

  let hourPart = Measurement(value: Double(hours), unit: UnitDuration.hours).formatted(style)
  return rest == 0 ? hourPart : "\(hourPart) \(minutePart)"
}

/// A learner-local calendar date (`YYYY-MM-DD`) as a date at its midnight in UTC, to format with a
/// UTC calendar so it never shifts a day.
func studyDate(_ localDate: String) -> Date? {
  try? Date(localDate, strategy: .iso8601.year().month().day())
}

extension FormatStyle where Self == Date.FormatStyle {
  /// A learner-local date's style: formatted in UTC, where `studyDate(_:)` puts it.
  static var studyDay: Date.FormatStyle {
    var style = Date.FormatStyle(timeZone: TimeZone(identifier: "UTC") ?? .gmt)
    style.calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
    return style
  }
}
