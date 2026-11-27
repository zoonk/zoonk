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
  /// A day's mistakes run or pattern drill, named by what it fixes; nil for anything else.
  var remedialTitle: String? { get }
  var questions: Int { get }
  var title: String? { get }
  var topics: [String] { get }
  /// A written block's drill or whole answer; nil for anything else.
  var writingUnit: WritingPrompt.Unit? { get }
  /// How a whole answer is named before its question is assigned; nil from older servers.
  var writingTask: WritingTaskName? { get }
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
    if let remedialTitle {
      return remedialTitle
    }

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
    // A drill and a whole answer never share a name; the notice's long sentence is never one.
    case .produce:
      return WritingLabels.taskTitle(unit: writingUnit, task: writingTask, fallback: title)
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
  var remedialTitle: String? {
    switch screen {
    case .mistakesPractice:
      String(
        localized: "Fix \(questions) mistakes", table: "Today", locale: .appLanguage,
        comment: "Mistakes to fix: a step of the day, or how many the notebook has ready")
    case .pattern:
      title.map {
        String(
          localized: "practicePattern", defaultValue: "Practice: \($0)", table: "Today",
          comment:
            "A study step that drills one rule the learner keeps getting wrong. {pattern} names the rule, like \"Adjective endings after der\"."
        )
      }
    case .challenge, .essay, .lesson, .session, .unknown:
      nil
    }
  }

  /// Why work the plan added for the learner's mistakes is in the day. It never counts: a count can
  /// be false by the time it's read.
  var remedialLine: String? {
    switch screen {
    case .mistakesPractice:
      return String(localized: "Questions you missed before", table: "Today")
    case .pattern:
      return String(localized: "A pattern in your mistakes", table: "Today")
    case .challenge, .essay, .lesson, .session, .unknown:
      break
    }

    switch returning {
    case .again:
      return String(
        localized: "Once more: this one's been tricky", table: "Today",
        comment: "Under a lesson the learner takes again because they keep missing its idea.")
    case .anotherWay:
      return String(
        localized: "Another way to see it", table: "Today",
        comment:
          "Under a short lesson that explains, in a new way, an idea the learner keeps missing.")
    case .missed:
      return String(
        localized: "This one's been tricky", table: "Today",
        comment: "Under a lesson written for an idea the learner keeps missing.")
    case nil:
      return nil
    }
  }

  var challenge: BlockChallenge? {
    checkpoint.map { BlockChallenge(mock: $0.mock, rematch: $0.rematch, weekly: $0.isWeekly) }
  }

  var hasCapsules: Bool {
    kind == .review && !capsules.isEmpty
  }
}

/// Main's `useShortList`: every name up to `named`, else the first `named` and how many more.
func shortList(_ names: [String], named: Int) -> String {
  guard names.count > named else {
    return names.formatted(.list(type: .and))
  }

  let shown = names.prefix(named).joined(separator: ", ")

  return String(
    localized: "\(shown) and \(names.count - named) more", table: "Today",
    locale: .appLanguage, comment: "A short list of topics and how many more")
}

extension StudyBlock {
  /// A writing block's line under its name: when the day's grading is used up, that its draft is
  /// kept, or what a drill is for, since its name is the same after every lesson.
  private var writingLine: String? {
    switch writingAvailability {
    case .tomorrow(let returnsOn):
      return WritingLabels.gradingReturns(returnsOn)
    case .needsChoice(let choiceGroups):
      return WritingLabels.choiceLine(choiceGroups)
    case .available, .continue, nil:
      break
    }

    if hasWritingDraft == true {
      return String(localized: "Your draft is saved", table: "Today")
    }

    return writingUnit == .drill
      ? String(
        localized: "To use what you just learned", table: "Today",
        comment: "Under a short writing exercise after a lesson: what it's for.")
      : nil
  }

  /// The row's line where the block is told on its own, as "Up next" does.
  var detail: String? {
    if let remedialLine {
      return remedialLine
    }

    if hasCapsules && weakest {
      return String(
        localized: "\(questions) questions on what's been hardest for you", table: "Today",
        locale: .appLanguage,
        comment: "A review of the weakest topics, on a day with nothing due to review")
    }

    if hasCapsules {
      return String(
        localized:
          "\(questions) questions\u{00A0}· \(shortList(capsules.compactMap(\.title), named: 2))",
        table: "Today", locale: .appLanguage, comment: "A review's questions and its topics")
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
      return writingLine ?? subject ?? canDo
    }

    if fullReview {
      return String(
        localized: "\(questions) questions on every topic", table: "Today",
        locale: .appLanguage, comment: "A review of every topic: the count is its questions")
    }

    if practisesTopics {
      return String(
        localized: "\(questions) questions\u{00A0}· \(shortList(topics, named: 2))", table: "Today",
        locale: .appLanguage, comment: "A review's questions and its topics")
    }

    return String(
      localized: "\(questions) questions", table: "Today", locale: .appLanguage,
      comment: "A practice block's questions")
  }

  /// Main's `useBlockSubject`: the subject a block belongs to, or that the exam doesn't test it.
  func subjectLine(document: ExamDocument) -> String? {
    subjectExtra.map { examExtraLabel(hasNotice: $0 == .notice, document: document) } ?? subject
  }

  /// Main's `useStepLabel`: the row's line under its subject on Today's list, what a challenge,
  /// practice or review is, or why remedial work is in the day.
  var label: String? {
    // A refused start is the one thing to know before tapping it, even while lessons come first.
    if case .tomorrow = writingAvailability {
      return writingLine
    }

    if waitReason != nil {
      return String(
        localized: "After today's lessons", table: "Today",
        comment: "A challenge that opens once the lessons before it are done")
    }

    if let remedialLine {
      return remedialLine
    }

    // The title names a practice's first topic, so the line counts the others.
    if practisesTopics && topics.count > 1 {
      return String(
        localized: "\(topics.count - 1) more topics", table: "Today", locale: .appLanguage)
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
          locale: .appLanguage, comment: "A practice block's questions")
    }

    return kind == .produce ? writingLine : nil
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
