import Foundation
import Observation

/// How a question block reaches the server: grading one answer, and finishing the block.
protocol QuestionBlockClient: Sendable {
  func answer(itemId: String, answer: PracticeAnswer, durationMs: Int) async throws
    -> StudyAnswerOutcome
  func finish() async throws -> Components.Schemas.StudyBlockCompletion
}

/// The live client for one block of one session, with the bearer that opened it.
struct LiveQuestionBlockClient: QuestionBlockClient {
  let api: PracticeAPI
  let token: String
  let sessionId: String
  let blockId: String

  func answer(itemId: String, answer: PracticeAnswer, durationMs: Int) async throws
    -> StudyAnswerOutcome
  {
    try await api.answerStudy(
      token: token, sessionId: sessionId, blockId: blockId, itemId: itemId, answer: answer,
      durationMs: durationMs)
  }

  func finish() async throws -> Components.Schemas.StudyBlockCompletion {
    try await api.finishStudyBlock(token: token, sessionId: sessionId, blockId: blockId)
  }
}

/// Runs a question block: one question at a time, graded on the server, resuming where the
/// learner left it, played the way a saved mistake's drill calls for, and finished with its
/// completion moment once every question is answered. Failures read as failed with a retry,
/// never as stuck.
@MainActor
@Observable
final class QuestionBlockRun {
  private(set) var state: QuestionBlockState
  let detail: QuestionBlockDetail
  /// The answer Check would send for the question in view; nil until complete.
  var draft: PracticeAnswer?
  private(set) var drillStage: DrillStage = .open
  /// A timed drill's clock ran out: its "I don't know yet" is the clock's, not the learner's.
  private(set) var timedOut = false
  /// Set when the block isn't active anymore (finished or skipped elsewhere): the host reads where
  /// the session stands.
  private(set) var needsRefresh = false
  /// Set when the bearer expired mid-block.
  private(set) var isUnauthorized = false

  private let client: any QuestionBlockClient
  private let now: () -> Date
  private var shownAt: Date

  init(
    detail: QuestionBlockDetail, client: any QuestionBlockClient,
    now: @escaping () -> Date = Date.init
  ) {
    self.detail = detail
    self.client = client
    self.now = now
    state = QuestionBlockState(questions: detail.questions)
    shownAt = now()
    drillStage = openingStage()
  }

  var question: PracticeQuestion? { state.question }

  /// The question's saved mistake drill, when it belongs to one.
  var drill: PracticeDrill? { question?.drill }

  /// The first question of its drill: a gap's idea and the drill's rule show above it.
  var isFirstOfDrill: Bool {
    guard let question, question.drill != nil else { return false }
    let previous =
      state.questions.indices.contains(state.index - 1) ? state.questions[state.index - 1] : nil
    return previous?.mistakeId != question.mistakeId
  }

  /// `minDurationMs` is a timed drill's whole time box when it ran out, however the clock ticked.
  func submit(_ answer: PracticeAnswer, minDurationMs: Int = 0) async {
    guard let question, state.phase.acceptsAnswer else { return }

    state.check()
    let durationMs = max(minDurationMs, Int(now().timeIntervalSince(shownAt) * 1000))

    do {
      switch try await client.answer(
        itemId: question.itemId, answer: answer, durationMs: durationMs)
      {
      case .answered(let feedback):
        state.answered(answer, feedback: feedback, itemId: question.itemId)
      case .alreadyAnswered:
        state.alreadyAnswered()
      case .blockNotActive:
        needsRefresh = true
      }
    } catch PracticeAPIError.unauthorized {
      isUnauthorized = true
      state.answerFailed()
    } catch {
      state.answerFailed()
    }
  }

  /// Sends the answer on screen again, as Check does, after a save that didn't go through.
  func retryAnswer() async {
    guard let draft else { return }
    await submit(draft)
  }

  func next() async {
    state.next()
    draft = nil
    timedOut = false
    shownAt = now()
    drillStage = openingStage()

    if state.phase == .finishing {
      await finish()
    }
  }

  /// Finishes the block: after the last answer, or on Finish for a block opened fully answered.
  func finish() async {
    state.finish()

    do {
      state.finished(try await client.finish())
    } catch PracticeAPIError.unauthorized {
      isUnauthorized = true
      state.finishFailed()
    } catch {
      state.finishFailed()
    }
  }

  // MARK: Drills

  /// A gap's idea screen's Start.
  func startDrill() {
    shownAt = now()
    drillStage = DrillStage.afterIdea(drill: drill)
  }

  /// A misread's "Show the answers": reading counts toward the answer's time.
  func revealAnswers() {
    drillStage = .open
  }

  /// A timed drill's clock ran out: it counts as a miss, sent as "I don't know yet".
  func timeUp() async {
    timedOut = true
    await submit(.dontKnow, minDurationMs: (drill?.timeLimitSeconds ?? 0) * 1000)
  }

  private func openingStage() -> DrillStage {
    DrillStage.opening(drill: drill, isFirstOfDrill: isFirstOfDrill)
  }
}
