import Foundation

/// A question of the open test, with the part it counts in.
struct PlacementTestQuestion: Equatable {
  let attempt: PlacementAttempt
  let answered: Int
  let question: PracticeQuestion
  let labels: PracticeTrueFalseLabels
  /// From 0 to 1, of this part.
  let progress: Double
}

/// What the test taken from the plan shows, from a read of it. Main's `toPlacementTestPhase`.
enum PlacementTestPhase: Equatable {
  case loading
  /// No test is open: the learner chooses how much to check.
  case choose
  /// The open test's questions are still being written.
  case waiting
  case question(PlacementTestQuestion)
  /// This part asks nothing more and isn't closed yet: closing it is the next save.
  case partOver(PlacementAttempt)
  /// A whole-course test between two parts. `lessonsSkipped` is the part that just closed, or nil
  /// when the learner came back to a test whose part closed earlier.
  case between(PlacementAttempt, lessonsSkipped: Int?)
  case result(length: PlacementLength, lessonsSkipped: Int)

  var isWaiting: Bool { self == .waiting }

  /// With no test open, the learner chooses how much to check; an open one goes on where it
  /// stopped, after its questions are written.
  init(_ placement: GoalPlacement) {
    self.init(
      attempt: placement.attempt.flatMap {
        try? PracticeJSON.recode($0, as: PlacementAttempt.self)
      },
      status: placement.status,
      next: placement.next.flatMap { try? PracticeJSON.recode($0, as: PracticeQuestion.self) },
      labels: placement.trueFalseLabels == .rightWrong ? .rightWrong : .trueFalse,
      answered: placement.answered, progress: placement.dayBudgetSpent)
  }

  init(
    attempt: PlacementAttempt?, status: Components.Schemas.PlacementStatus,
    next: PracticeQuestion?, labels: PracticeTrueFalseLabels, answered: Int, progress: Double
  ) {
    guard let attempt else {
      self = .choose
      return
    }

    if attempt.partComplete {
      self = .between(attempt, lessonsSkipped: nil)
      return
    }

    guard status == .asking || status == .done else {
      self = status == .preparing || status == .waitingForQuestions ? .waiting : .partOver(attempt)
      return
    }

    guard let next else {
      self = .partOver(attempt)
      return
    }

    self = .question(
      PlacementTestQuestion(
        attempt: attempt, answered: answered, question: next, labels: labels, progress: progress))
  }

  /// A closed part goes on to the next one when the test has more; otherwise it's the result.
  init(finished: PlacementPartEnd, length: PlacementLength) {
    if let attempt = finished.attempt {
      self = .between(attempt, lessonsSkipped: finished.lessonsSkipped)
    } else {
      self = .result(
        length: length, lessonsSkipped: finished.result?.lessonsSkipped ?? finished.lessonsSkipped)
    }
  }
}
