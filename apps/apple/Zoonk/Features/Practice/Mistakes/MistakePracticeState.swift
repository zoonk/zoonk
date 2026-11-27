import Foundation

/// Which open mistakes a run asks: the notebook's, one skill's, a day block's, or a finished mock's.
enum MistakePracticeScope: Hashable, Sendable {
  case notebook
  case skill(String)
  case block(String)
  case mock(String)

  init(skillId: String?, blockId: String?, mockId: String?) {
    if let skillId {
      self = .skill(skillId)
    } else if let blockId {
      self = .block(blockId)
    } else if let mockId {
      self = .mock(mockId)
    } else {
      self = .notebook
    }
  }

  var skillId: String? {
    if case .skill(let id) = self { id } else { nil }
  }

  var blockId: String? {
    if case .block(let id) = self { id } else { nil }
  }

  var mockId: String? {
    if case .mock(let id) = self { id } else { nil }
  }

  /// The goal the run names: a mock's run takes it from the finished sitting, so it still works
  /// after the learner switched goals.
  func goal(_ activeGoalId: String?) -> String? {
    mockId == nil ? activeGoalId : nil
  }
}

struct MistakePracticeStep: Equatable {
  let entry: MistakePracticeEntry
  let isFirstOfEntry: Bool
  let question: PracticeQuestion?
}

enum MistakePracticePhase: Equatable {
  case answerFailed(SentAnswer)
  case answering
  case checking(SentAnswer)
  case ended(Components.Schemas.MistakePracticeCompletion?)
  case ending
  case feedback(answer: PracticeAnswer, grade: MistakePracticeGrade, sender: AnswerSender)
  case idea
  case lessonChecking
  case lessonFeedback

  var failed: SentAnswer? {
    if case .answerFailed(let sent) = self { sent } else { nil }
  }
}

/// The run keeps the questions it started with: a fixed mistake leaves the server's practice, not the
/// run in progress.
struct MistakePracticeState: Equatable {
  private(set) var saveFailures = 0
  private(set) var answerIds: [String] = []
  private(set) var fixedIds: [String] = []
  private(set) var index = 0
  private(set) var phase: MistakePracticePhase
  private(set) var reached = PracticeReached.nothing
  let steps: [MistakePracticeStep]
  private(set) var verdicts: [TaskSegment] = []

  init(entries: [MistakePracticeEntry]) {
    steps = entries.flatMap { entry in
      if entry.lesson != nil {
        return [MistakePracticeStep(entry: entry, isFirstOfEntry: true, question: nil)]
      }
      return entry.questions.enumerated().map { position, question in
        MistakePracticeStep(entry: entry, isFirstOfEntry: position == 0, question: question)
      }
    }
    phase = steps.isEmpty ? .ended(nil) : Self.opening(steps.first)
  }

  var step: MistakePracticeStep? { steps.indices.contains(index) ? steps[index] : nil }

  /// Again after a save that didn't go through too.
  var acceptsAnswer: Bool {
    switch phase {
    case .answering, .answerFailed: true
    default: false
    }
  }

  var isOver: Bool {
    switch phase {
    case .ending, .ended: true
    default: false
    }
  }

  /// A content gap's first question waits behind its idea.
  private static func opening(_ step: MistakePracticeStep?) -> MistakePracticePhase {
    guard let step else { return .ending }
    if step.isFirstOfEntry, step.entry.drill.isIdeaFirst { return .idea }
    return .answering
  }

  mutating func start() {
    phase = .answering
  }

  mutating func check(_ sent: SentAnswer) {
    phase = .checking(sent)
  }

  mutating func answerFailed() {
    guard case .checking(let sent) = phase else { return }
    saveFailures += 1
    phase = .answerFailed(sent)
  }

  mutating func answered(_ grade: MistakePracticeGrade, mistakeId: String) {
    guard case .checking(let sent) = phase else { return }
    let (answer, sender) = (sent.answer, sent.sender)

    record(
      grade, mistakeId: mistakeId,
      verdict: sender != .timer && answer.isDontKnow ? .read : (grade.isCorrect ? .right : .wrong))
    phase = .feedback(answer: answer, grade: grade, sender: sender)
  }

  mutating func checkingLesson() { phase = .lessonChecking }

  mutating func lessonFailed() { phase = .answering }

  mutating func answeredLesson(_ grade: MistakePracticeGrade, mistakeId: String) {
    record(
      grade, mistakeId: mistakeId,
      verdict: grade.notSure || grade.lessonResult?.checked == false
        ? .read : (grade.isCorrect ? .right : .wrong))
    phase = .lessonFeedback
  }

  private mutating func record(
    _ grade: MistakePracticeGrade, mistakeId: String, verdict: TaskSegment
  ) {
    saveFailures = 0
    if let answerId = grade.answerId { answerIds.append(answerId) }

    var fixed = fixedIds
    for id in grade.fixedMistakeIds where !fixed.contains(id) { fixed.append(id) }
    if grade.isStillOpen {
      fixed.removeAll { $0 == mistakeId }
    } else if grade.fixed, !fixed.contains(mistakeId) {
      fixed.append(mistakeId)
    }
    fixedIds = fixed

    reached = reached.merged(with: grade.reached)
    verdicts.append(verdict)
  }

  mutating func next() {
    index += 1
    phase = Self.opening(step)
  }

  mutating func end() {
    phase = .ending
  }

  mutating func ended(_ summary: Components.Schemas.MistakePracticeCompletion?) {
    if let summary, let level = summary.reached.level {
      reached = reached.merged(
        with: PracticeReached(
          energy: summary.reached.energy,
          level: .init(color: level.color.rawValue, level: level.level)))
    } else if let energy = summary?.reached.energy {
      reached = reached.merged(with: PracticeReached(energy: energy, level: nil))
    }
    phase = .ended(summary)
  }

  /// "Practice again" follows a run played to its end (one left early ends there) while an entry it
  /// asked is still open or the server has more. A day's block never offers it: the day goes on
  /// from Today.
  func offersAgain(scope: MistakePracticeScope, hasMorePractice: Bool) -> Bool {
    let leftUnfixed = steps.contains { !fixedIds.contains($0.entry.mistakeId) }
    return scope.blockId == nil && index >= steps.count && (leftUnfixed || hasMorePractice)
  }

  var segments: [TaskSegment] {
    steps.indices.map { position in
      if verdicts.indices.contains(position) { return verdicts[position] }
      return position == index ? .current : .ahead
    }
  }
}
