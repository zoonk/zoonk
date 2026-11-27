import Foundation

/// A question of the open test, with the part it counts in.
struct PlacementTestQuestion: Equatable {
  let attempt: PlacementAttempt
  let question: PracticeQuestion
  let labels: PracticeTrueFalseLabels
}

/// A part that closed with work left in the test: the full test's checkpoint, or where a part the
/// learner stopped midway goes on.
struct PlacementPartStop: Equatable {
  let attempt: PlacementAttempt
  /// What the part skipped, every close of it together.
  let partLessonsSkipped: Int
  /// The close its Undo gives back; nil with nothing to give back.
  var changeId: String?
  var undoLessons = 0
  var heldUntilTomorrow = false
}

/// A course's test that's over, or a quick test with the rest of the course still to test.
struct PlacementTestEnd: Equatable {
  /// Every part's skips.
  let lessonsSkipped: Int
  /// The last close, when giving it back restores what the title counts.
  var changeId: String?
  var undoLessons = 0
  var heldUntilTomorrow = false
  var nextLesson: PlacementTestResult.NextLesson?
  var attemptId: String?
  /// A quick test's attempt while the rest of the course is left to test.
  var rest: PlacementAttempt?
}

/// What a course's test shows, from a read of it or from a part that closed. Main's
/// `toPlacementTestPhase`.
enum PlacementTestPhase: Equatable {
  case loading
  /// No test is open: the learner picks one. Only the plan offers; onboarding's offer comes first.
  case offer
  /// The way back into a full test with parts left, or a part stopped midway.
  case continueTest(PlacementAttempt)
  /// The open part's questions, or the course a test was asked for, are still being written.
  case waiting
  /// The open part's questions couldn't be written: "Try again" starts the same part again. With
  /// no attempt, the course the test was asked for couldn't be built, and "Try again" asks again.
  case preparationFailed(PlacementAttempt?)
  /// The wait stopped hearing back: "Try again" reads again.
  case connectionLost
  /// No question can be written and none is being written: the first days place the learner.
  case unavailable
  case question(PlacementTestQuestion)
  /// This part asks nothing more and isn't closed yet: closing it is the next save.
  case partOver(PlacementAttempt)
  case checkpoint(PlacementPartStop)
  case stopped(PlacementPartStop)
  case result(PlacementTestEnd)

  var isWaiting: Bool { waitFailure != nil || self == .waiting }

  /// What the wait says went wrong, with its "Try again".
  var waitFailure: GenerationFailure? {
    switch self {
    case .preparationFailed: .generation
    case .connectionLost: .connection
    default: nil
    }
  }

  /// An open test goes on where it stopped: a sitting at its next question, a quick test that ended
  /// on its result, a full test with parts left on "Continue your test". With nothing open,
  /// onboarding shows the result of the test it ran; otherwise the test is offered, or waited for
  /// when the learner already `asked` for it.
  init(_ placement: GoalPlacement, onboarding: Bool, asked: Bool = false) {
    self.init(
      attempt: placement.activeTestAttempt, result: placement.savedTestResult,
      status: placement.status,
      next: placement.next.flatMap { try? PracticeJSON.recode($0, as: PracticeQuestion.self) },
      labels: placement.trueFalseLabels == .rightWrong ? .rightWrong : .trueFalse,
      onboarding: onboarding, asked: asked)
  }

  init(
    attempt: PlacementAttempt?, result: PlacementTestResult?,
    status: Components.Schemas.PlacementStatus, next: PracticeQuestion?,
    labels: PracticeTrueFalseLabels, onboarding: Bool, asked: Bool = false
  ) {
    guard let attempt else {
      if onboarding, let result, result.attemptId != nil {
        self = .result(PlacementTestEnd(read: result, rest: nil))
      } else if asked {
        self = Self(unopened: status)
      } else {
        self = .offer
      }
      return
    }

    if attempt.partComplete || attempt.resume != nil {
      if attempt.length == .quick, let result {
        self = .result(PlacementTestEnd(read: result, rest: attempt))
      } else {
        self = .continueTest(attempt)
      }
      return
    }

    switch status {
    case .preparing, .waitingForQuestions:
      self = .waiting
    case .failed:
      self = .preparationFailed(attempt)
    case .unavailable:
      self = .unavailable
    case .asking, .done:
      if let next {
        self = .question(PlacementTestQuestion(attempt: attempt, question: next, labels: labels))
      } else {
        self = .partOver(attempt)
      }
    }
  }

  /// No test opened after the learner asked for one: it waits while the course and its questions
  /// are written; otherwise there's nothing to test. Questions that came while it waited open the
  /// start the learner asked for (`PlacementTestFlow`).
  private init(unopened status: Components.Schemas.PlacementStatus) {
    switch status {
    case .preparing, .waitingForQuestions:
      self = .waiting
    case .failed:
      self = .preparationFailed(nil)
    case .unavailable, .asking, .done:
      self = .unavailable
    }
  }

  /// A closed part: the test's result once nothing is left or the quick test ended, else the full
  /// test's checkpoint, or where a part stopped midway goes on.
  init(finished: PlacementPartEnd, attemptId: String) {
    let undo = finished.changeId == nil ? 0 : finished.lessonsSkipped

    guard let attempt = finished.attempt, attempt.length == .wholeCourse else {
      let total = finished.result?.lessonsSkipped ?? finished.lessonsSkipped
      self = .result(
        PlacementTestEnd(
          lessonsSkipped: total,
          changeId: undo == total ? finished.changeId : nil, undoLessons: undo,
          heldUntilTomorrow: finished.result?.heldUntilTomorrow ?? finished.heldUntilTomorrow,
          nextLesson: finished.result?.nextLesson, attemptId: attemptId,
          rest: finished.attempt))
      return
    }

    let stop = PlacementPartStop(
      attempt: attempt, partLessonsSkipped: finished.partLessonsSkipped,
      changeId: finished.changeId, undoLessons: undo,
      heldUntilTomorrow: finished.heldUntilTomorrow)
    self = attempt.resume == nil ? .checkpoint(stop) : .stopped(stop)
  }
}

extension PlacementTestEnd {
  /// A test the learner comes back to: its Undo only when the last close skipped every lesson the
  /// title counts.
  init(read result: PlacementTestResult?, rest: PlacementAttempt?) {
    let total = result?.lessonsSkipped ?? 0
    let part = result?.partLessonsSkipped ?? total

    self.init(
      lessonsSkipped: total, changeId: part == total ? result?.changeId : nil, undoLessons: part,
      heldUntilTomorrow: result?.heldUntilTomorrow == true, nextLesson: result?.nextLesson,
      attemptId: result?.attemptId ?? rest?.id, rest: (rest?.partsLeft ?? 0) > 0 ? rest : nil)
  }
}

extension GoalPlacement {
  var activeTestAttempt: PlacementAttempt? {
    attempt.flatMap { try? PracticeJSON.recode($0, as: PlacementAttempt.self) }
  }

  var savedTestResult: PlacementTestResult? {
    result.flatMap { try? PracticeJSON.recode($0, as: PlacementTestResult.self) }
  }
}
