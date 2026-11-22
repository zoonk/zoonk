import Foundation

// Mirrors main's `use-block-copy.ts`, `mission-copy.tsx` and `plan-status-label.tsx`.

/// What names a study block (main's `BlockCopyInput`), so Today's row and the block's own page
/// read one name.
protocol NamedBlock {
  var areas: [String] { get }
  var challenge: BlockChallenge? { get }
  var fullReview: Bool { get }
  /// A review's questions come in capsules, except the first week's warm-up, which is placement's
  /// questions only.
  var hasCapsules: Bool { get }
  var kind: StudyBlock.Kind { get }
  var mistakesOnly: Bool { get }
  var questions: Int { get }
  var title: String? { get }
  var topics: [String] { get }
}

struct BlockChallenge {
  let mock: Bool
  let rematch: Bool
  let weekly: Bool
}

extension NamedBlock {
  var practisesTopics: Bool {
    kind == .practice && !topics.isEmpty && !fullReview && !mistakesOnly
  }

  /// A language unit's challenge is a live call, with no questions.
  var isCall: Bool {
    guard let challenge else {
      return false
    }

    return !challenge.mock && !challenge.weekly && questions == 0
  }

  /// One name per block (main's `use-block-copy.ts`): "The Trickster", "Rematch", "Weekly
  /// challenge", "Mock exam", "Call", "Review", or a practice's topic.
  var displayTitle: String {
    if let challenge {
      if challenge.mock {
        return String(localized: "Mock exam", table: "Today", comment: "A mock exam block")
      }

      if challenge.weekly {
        return String(
          localized: "Weekly challenge", table: "Today", comment: "The week's challenge block")
      }

      if isCall {
        return String(
          localized: "Call", table: "Today", comment: "A language plan's challenge: a live call")
      }

      return challenge.rematch
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
      return practiceTitle
    }
  }

  /// Named after the topic most of its questions are on, so two practices on one subject in a day
  /// never share a name; after its subjects when it has no topics (main's `getPracticeFocus`).
  private var practiceTitle: String {
    if fullReview {
      return String(localized: "Review", table: "Today", comment: "A review block")
    }

    if mistakesOnly {
      return String(
        localized: "Practice mistakes", table: "Today", comment: "A block fixing mistakes")
    }

    if let topic = topics.first {
      return String(
        localized: "practiceTopic", defaultValue: "Practice: \(topic)", table: "Today",
        comment:
          "A block of the day's practice. {topic} names the topic most of its questions are on, like \"Calculating discounts\"."
      )
    }

    if !areas.isEmpty {
      let areas = areas.formatted(.list(type: .and))

      return String(
        localized: "Practice: \(areas)", table: "Today",
        comment:
          "A block of the day's practice, and the one or two subjects most of its questions are on, like \"Math and Languages\""
      )
    }

    return String(localized: "Mixed practice", table: "Today", comment: "A practice block")
  }
}

extension StudyBlock: NamedBlock {
  var challenge: BlockChallenge? {
    checkpoint.map { BlockChallenge(mock: $0.mock, rematch: $0.rematch, weekly: $0.isWeekly) }
  }

  var hasCapsules: Bool {
    kind == .review && !capsules.isEmpty
  }
}

extension StudyBlock {
  private func shortList(_ names: [String], named: Int) -> String {
    guard names.count > named else {
      return names.formatted(.list(type: .and))
    }

    let shown = names.prefix(named).joined(separator: ", ")

    return String(
      localized: "\(shown) and \(names.count - named) more", table: "Today",
      comment: "A short list of topics and how many more")
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

    // The title names a practice's first topic, so the line counts the others.
    if practisesTopics && topics.count > 1 {
      return String(localized: "\(topics.count - 1) more topics", table: "Today")
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
