import Foundation
import Observation

protocol QuestionBlockClient: Sendable {
  func answer(itemId: String, answer: PracticeAnswer, durationMs: Int) async throws
    -> StudyAnswerOutcome
  func finish() async throws -> Components.Schemas.StudyBlockCompletion
}

struct QuestionBlockWriteObsolete: Error {}

struct LiveQuestionBlockClient: QuestionBlockClient {
  let practice: PracticeStore
  let sessionId: String
  let blockId: String

  func answer(itemId: String, answer: PracticeAnswer, durationMs: Int) async throws
    -> StudyAnswerOutcome
  {
    let (practice, sessionId, blockId) = (practice, sessionId, blockId)
    return try Self.value(
      await practice.write(.answered) { identity in
        try await practice.api.answerStudy(
          token: identity.bearerToken, sessionId: sessionId, blockId: blockId, itemId: itemId,
          answer: answer, durationMs: durationMs)
      })
  }

  func finish() async throws -> Components.Schemas.StudyBlockCompletion {
    let (practice, sessionId, blockId) = (practice, sessionId, blockId)
    return try Self.value(
      await practice.write(.finished) { identity in
        try await practice.api.finishStudyBlock(
          token: identity.bearerToken, sessionId: sessionId, blockId: blockId)
      })
  }

  private static func value<Value>(_ write: PracticeWrite<Value>) throws -> Value {
    switch write {
    case .done(let value): return value
    case .refused(let refusal): throw refusal
    case .failed(let error): throw error
    case .obsolete: throw QuestionBlockWriteObsolete()
    }
  }
}

/// Failures read as failed with a retry, never as stuck.
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

  private let client: any QuestionBlockClient
  private let now: () -> Date
  /// When the question in view was shown, which its answer's time and a timed drill's clock count
  /// from.
  private(set) var shownAt: Date

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

  var drill: PracticeDrill? { question?.drill }

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
    } catch is QuestionBlockWriteObsolete {
      return
    } catch {
      state.answerFailed()
    }
  }

  func retryAnswer() async {
    guard let answer = draft?.complete else { return }
    await submit(answer)
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

  func finish() async {
    state.finish()

    do {
      state.finished(try await client.finish())
    } catch is QuestionBlockWriteObsolete {
      return
    } catch {
      state.finishFailed()
    }
  }

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
