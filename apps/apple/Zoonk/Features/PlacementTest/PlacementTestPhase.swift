import Foundation

/// A question of the open test.
struct PlacementTestQuestion: Equatable {
  let attempt: PlacementAttempt
  let question: PracticeQuestion
  let labels: PracticeTrueFalseLabels
}

/// A course's test that's over: where the learner starts and what it skipped.
struct PlacementTestEnd: Equatable {
  let lessonsSkipped: Int
  /// The finish its Undo gives back; nil when giving it back wouldn't restore what the screen
  /// counts.
  var changeId: String?
  var heldUntilTomorrow = false
  /// The chapter the learner starts in, the result's title.
  var chapter: String?
  /// The course as the result draws it; nil when the result came before the plan.
  var course: PlacementCourse?
  var nextLesson: PlacementTestResult.NextLesson?
  var attemptId: String?
  /// The plan's last result, opened from its row: Done goes back, since its next lesson is where
  /// the plan stood then, and a new test is taken from it.
  var revisited = false
}

/// What a course's test shows, from a read of it or from its finish. Main's `toPlacementTestPhase`.
enum PlacementTestPhase: Equatable {
  case loading
  /// No test is open: the learner picks one. Only the plan offers; onboarding's offer comes first.
  case offer
  /// The test's questions, or the course a test was asked for, are still being written.
  case waiting
  /// The test's questions couldn't be written: "Try again" starts it again. With no attempt, the
  /// course the test was asked for couldn't be built, or its start failed once its questions came,
  /// and "Try again" asks again.
  case preparationFailed(PlacementAttempt?)
  /// The wait stopped hearing back: "Try again" reads again.
  case connectionLost
  /// No question can be written and none is being written: the first days place the learner.
  case unavailable
  case question(PlacementTestQuestion)
  /// The test asks nothing more and isn't finished yet: finishing it is the next save.
  case over(PlacementAttempt)
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

  /// An open test goes on at its next question. With nothing open, the result shows when it's the
  /// test the learner was just in (`attemptID`), in onboarding, or on the plan, where it's the
  /// row's last result whether or not a new test could start; otherwise the test is offered, or
  /// waited for when the learner already `asked` for it.
  init(
    _ placement: GoalPlacement, onboarding: Bool, asked: Bool = false, attemptID: String? = nil
  ) {
    self.init(
      attempt: placement.activeTestAttempt, result: placement.savedTestResult,
      status: placement.status,
      next: placement.next.flatMap { try? PracticeJSON.recode($0, as: PracticeQuestion.self) },
      labels: placement.trueFalseLabels == .rightWrong ? .rightWrong : .trueFalse,
      onboarding: onboarding, asked: asked, attemptID: attemptID)
  }

  init(
    attempt: PlacementAttempt?, result: PlacementTestResult?,
    status: Components.Schemas.PlacementStatus, next: PracticeQuestion?,
    labels: PracticeTrueFalseLabels, onboarding: Bool, asked: Bool = false,
    attemptID: String? = nil
  ) {
    guard let attempt else {
      if let result, let id = result.attemptId, onboarding || id == attemptID {
        self = .result(PlacementTestEnd(read: result))
      } else if let result, !asked {
        var end = PlacementTestEnd(read: result)
        end.revisited = true
        self = .result(end)
      } else if asked {
        self = Self(unopened: status)
      } else {
        self = .offer
      }
      return
    }

    switch status {
    case .preparing, .waitingForQuestions:
      self = .waiting
    case .failed:
      self = .preparationFailed(attempt)
    case .unavailable, .unrecognized:
      self = .unavailable
    case .asking, .done:
      if let next {
        self = .question(PlacementTestQuestion(attempt: attempt, question: next, labels: labels))
      } else {
        self = .over(attempt)
      }
    }
  }

  /// Where a read leaves a question whose answer core refused: nil while the test still asks it,
  /// so the answer just didn't save. Otherwise the test moved on without it, as when another device
  /// stopped it, and the read decides, with this test's result when it's there.
  init?(
    refused asked: PlacementTestQuestion, attempt: PlacementAttempt?,
    result: PlacementTestResult?, status: Components.Schemas.PlacementStatus,
    next: PracticeQuestion?, labels: PracticeTrueFalseLabels, onboarding: Bool
  ) {
    if attempt?.id == asked.attempt.id, next?.itemId == asked.question.itemId {
      return nil
    }

    self.init(
      attempt: attempt, result: result, status: status, next: next, labels: labels,
      onboarding: onboarding, asked: true, attemptID: asked.attempt.id)
  }

  init?(refused asked: PlacementTestQuestion, _ placement: GoalPlacement, onboarding: Bool) {
    self.init(
      refused: asked, attempt: placement.activeTestAttempt, result: placement.savedTestResult,
      status: placement.status,
      next: placement.next.flatMap { try? PracticeJSON.recode($0, as: PracticeQuestion.self) },
      labels: placement.trueFalseLabels == .rightWrong ? .rightWrong : .trueFalse,
      onboarding: onboarding)
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
    case .unavailable, .unrecognized, .asking, .done:
      self = .unavailable
    }
  }
}

extension PlacementTestEnd {
  /// A test the learner comes back to.
  init(read result: PlacementTestResult) {
    self.init(
      lessonsSkipped: result.lessonsSkipped, changeId: result.changeId,
      heldUntilTomorrow: result.heldUntilTomorrow == true, chapter: result.chapter,
      course: result.course, nextLesson: result.nextLesson, attemptId: result.attemptId)
  }

  /// A finish: Undo only when it restores every lesson the screen counts.
  init(finished: PlacementFinish, attemptId: String) {
    let result = finished.result
    let lessonsSkipped = result?.lessonsSkipped ?? finished.lessonsSkipped

    self.init(
      lessonsSkipped: lessonsSkipped,
      changeId: finished.lessonsSkipped == lessonsSkipped ? finished.changeId : nil,
      heldUntilTomorrow: result?.heldUntilTomorrow ?? finished.heldUntilTomorrow,
      chapter: result?.chapter, course: result?.course, nextLesson: result?.nextLesson,
      attemptId: attemptId)
  }

  /// The lessons Undo gives back.
  var undoLessons: Int { changeId == nil ? 0 : lessonsSkipped }

  /// The plan's stop the learner starts in: its name, or the plan's own name for a stop with none
  /// ("Phase 2", by its place among the course's stops).
  var startName: String? {
    if let chapter { return chapter }
    return course?.chapters.firstIndex(where: \.start).map(PlanPhase.placeName(at:))
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
