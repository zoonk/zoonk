import Foundation

// Mirrors main's `use-block-copy.ts`, `mission-copy.tsx` and `plan-status-label.tsx`.

extension StudyBlock {
  /// A review's questions come in capsules, except the first week's warm-up, which is placement's
  /// questions only.
  private var hasCapsules: Bool {
    kind == .review && !capsules.isEmpty
  }

  private var practisesTopics: Bool {
    kind == .practice && !topics.isEmpty && !fullReview && !mistakesOnly
  }

  private func shortList(_ names: [String], named: Int) -> String {
    guard names.count > named else {
      return names.formatted(.list(type: .and))
    }

    let shown = names.prefix(named).joined(separator: ", ")

    return String(
      localized: "\(shown) and \(names.count - named) more", table: "Today",
      comment: "A short list of topics and how many more")
  }

  /// A language unit's challenge is a live call, with no questions.
  private var isCall: Bool {
    guard let checkpoint else {
      return false
    }

    return !checkpoint.mock && !checkpoint.isWeekly && questions == 0
  }

  /// One name per row (main's `use-block-copy.ts`): "The Trickster", "Rematch", "Weekly
  /// challenge", "Mock exam", "Call", "Review".
  var displayTitle: String {
    if let checkpoint {
      if checkpoint.mock {
        return String(localized: "Mock exam", table: "Today", comment: "A mock exam block")
      }

      if checkpoint.isWeekly {
        return String(
          localized: "Weekly challenge", table: "Today", comment: "The week's challenge block")
      }

      if isCall {
        return String(
          localized: "Call", table: "Today", comment: "A language plan's challenge: a live call")
      }

      return checkpoint.rematch
        ? String(
          localized: "Rematch", table: "Today",
          comment: "A second go at the Trickster, the character a phase's challenge is against")
        : String(
          localized: "The Trickster", table: "Today",
          comment: "A phase's challenge, named by the character it's against")
    }

    switch kind {
    case .review where !hasCapsules:
      return String(
        localized: "What you already know", table: "Today",
        comment: "The first week's warm-up block of placement questions")
    case .review:
      return String(localized: "Review", table: "Today", comment: "A review block")
    case .learn:
      return title
        ?? String(
          localized: "New lesson", table: "Today", comment: "A lesson block without a title")
    case .produce:
      return title
        ?? String(localized: "Writing practice", table: "Today", comment: "A writing block")
    case .practice, .checkpoint:
      if fullReview {
        return String(localized: "Review", table: "Today", comment: "A review block")
      }

      if mistakesOnly {
        return String(
          localized: "Practice mistakes", table: "Today", comment: "A block fixing mistakes")
      }

      if !areas.isEmpty {
        let areas = areas.formatted(.list(type: .and))

        return extra
          ? String(
            localized: "Bonus practice: \(areas)", table: "Today",
            comment:
              "Extra practice the learner added, and the one or two subjects most of its questions are on, like \"Math and Languages\""
          )
          : String(
            localized: "Practice: \(areas)", table: "Today",
            comment:
              "A block of the day's practice, and the one or two subjects most of its questions are on, like \"Math and Languages\""
          )
      }

      return extra
        ? String(localized: "Bonus practice", table: "Today", comment: "An extra practice block")
        : String(localized: "Mixed practice", table: "Today", comment: "A practice block")
    }
  }

  /// The row's line where the block is told on its own, as "Up next" does.
  var detail: String? {
    if hasCapsules && weakest {
      return String(
        localized: "\(questions) questions on what's been hardest for you", table: "Today",
        comment: "A review of the weakest topics, on a day with nothing due to review")
    }

    if hasCapsules {
      return String(
        localized:
          "\(questions) questions\u{00A0}· \(shortList(capsules.compactMap(\.title), named: 2))",
        table: "Today", comment: "A review's questions and its topics")
    }

    if kind == .learn {
      return reinforcement
        ? String(
          localized: "Short lesson before the rematch", table: "Today",
          comment: "A lesson before a challenge's rematch")
        : canDo
    }

    if isCall {
      return nil
    }

    if kind == .produce {
      return canDo
    }

    if fullReview {
      return String(
        localized: "\(questions) questions on every topic", table: "Today",
        comment: "A review of every topic: the count is its questions")
    }

    if practisesTopics {
      return String(
        localized: "\(questions) questions\u{00A0}· \(shortList(topics, named: 2))", table: "Today",
        comment: "A review's questions and its topics")
    }

    return String(
      localized: "\(questions) questions", table: "Today", comment: "A practice block's questions")
  }

  /// The row's one short line on Today's list: the subject, or what a challenge or review is.
  var label: String? {
    if waitReason != nil {
      return String(
        localized: "After today's lessons", table: "Today",
        comment: "A challenge that opens once the lessons before it are done")
    }

    if practisesTopics {
      return shortList(topics, named: 1)
    }

    if fullReview {
      return String(
        localized: "Every topic", table: "Today", comment: "A review that covers every topic")
    }

    if checkpoint != nil {
      return isCall
        ? nil
        : String(
          localized: "\(questions) questions", table: "Today",
          comment: "A practice block's questions")
    }

    return subject
  }
}

func studyDuration(minutes: Int) -> String {
  progressLearningTime(minutes * 60)
}

func studyDuration(minutes: Double) -> String {
  progressLearningTime(Int((minutes * 60).rounded()))
}

/// Midnight in UTC, to format with a UTC calendar so it never shifts a day.
func studyDate(_ localDate: String) -> Date? {
  try? Date(localDate, strategy: .iso8601.year().month().day())
}

extension FormatStyle where Self == Date.FormatStyle {
  static var studyDay: Date.FormatStyle {
    var style = Date.FormatStyle(timeZone: TimeZone(identifier: "UTC") ?? .gmt)
    style.calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
    return style
  }
}
