import Foundation

/// How a boss's duel was decided: his shield broke, or it can't break anymore.
enum DuelDecision: Equatable {
  case lost
  case won

  /// A boss's duel is over once decided and the questions left are never asked: won once its
  /// right answers reach the pass mark, lost once its misses leave too few questions to reach it.
  /// A weekly challenge asks every question; a pass mark of 0 (a language call) is never decided.
  /// Core's `getDuelDecision` is the same rule.
  static func decide(
    answered: Int, correct: Int, kind: Components.Schemas.Checkpoint.KindPayload, passMark: Int,
    questions: Int
  ) -> DuelDecision? {
    if kind == .weekly || passMark <= 0 { return nil }
    if correct >= passMark { return .won }
    let missed = answered - correct
    return missed > 0 && questions - missed < passMark ? .lost : nil
  }
}

/// A started checkpoint on screen: the duel one question at a time (right or wrong shows, never
/// the answer or why), then the result, which is when the answers and traps are explained.
struct CheckpointDuelState: Equatable {
  enum Failure: Equatable { case answer, finish }

  struct Feedback: Equatable {
    let answer: PracticeAnswer
    let isCorrect: Bool
    let itemId: String
  }

  private(set) var completion: Components.Schemas.StudyBlockCompletion?
  private(set) var failure: Failure?
  /// The last answer and its verdict, shown until the learner moves on.
  private(set) var feedback: Feedback?
  /// The answers given in this visit, so the review marks the learner's own pick.
  private(set) var given: [String: PracticeAnswer] = [:]
  private(set) var isPending = false
  private(set) var isResult: Bool
  private(set) var reinforcementLessons: Int
  /// A recording's transcript by its set, from the answer that finished its questions.
  private(set) var transcripts: [String: [PracticeTranscriptLine]] = [:]
  /// Each answered question's verdict, by item.
  private(set) var verdicts: [String: Bool]
  let kind: Components.Schemas.Checkpoint.KindPayload
  let passMark: Int
  let questions: [PracticeQuestion]

  /// A finished checkpoint opens on its result, a started one where the learner left it.
  init(load: CheckpointLoad) {
    let checkpoint = load.checkpoint
    var verdicts: [String: Bool] = [:]

    for answer in checkpoint.answeredQuestions ?? [] { verdicts[answer.itemId] = answer.isCorrect }
    for question in load.questions {
      if let answered = question.answered { verdicts[question.itemId] = answered.isCorrect }
    }

    self.verdicts = verdicts
    kind = checkpoint.kind
    passMark = checkpoint.passMark
    questions = load.questions
    reinforcementLessons = checkpoint.reinforcementLessons
    isResult = checkpoint.status == .completed || checkpoint.endedWithoutQuestions == true
  }

  // MARK: Transitions

  mutating func confirm() {
    failure = nil
    isPending = true
  }

  mutating func failed(_ failure: Failure) {
    self.failure = failure
    isPending = false
  }

  mutating func answered(
    _ answer: PracticeAnswer, isCorrect: Bool, itemId: String, reinforcementLessons: Int?,
    transcript: [PracticeTranscriptLine]?, setId: String?
  ) {
    feedback = Feedback(answer: answer, isCorrect: isCorrect, itemId: itemId)
    given[itemId] = answer
    isPending = false
    verdicts[itemId] = isCorrect
    self.reinforcementLessons = reinforcementLessons ?? self.reinforcementLessons

    if let transcript, let setId {
      transcripts[setId] = transcript
    }
  }

  mutating func next() {
    feedback = nil
  }

  mutating func finishing() {
    failure = nil
    isPending = true
  }

  mutating func finished(_ completion: Components.Schemas.StudyBlockCompletion) {
    self.completion = completion
    feedback = nil
    isPending = false
    isResult = true
  }

  // MARK: Derived

  var questionCount: Int { Set(questions.map(\.itemId)).union(verdicts.keys).count }

  var correct: Int { verdicts.values.filter(\.self).count }

  var decision: DuelDecision? {
    DuelDecision.decide(
      answered: verdicts.count, correct: correct, kind: kind, passMark: passMark,
      questions: questionCount)
  }

  /// Decided, or every question has its verdict.
  var isDone: Bool { decision != nil || verdicts.count == questionCount }

  /// The question whose verdict shows, else the first without one; none once the duel is decided.
  var currentQuestion: PracticeQuestion? {
    if let itemId = feedback?.itemId, let question = questions.first(where: { $0.itemId == itemId })
    {
      return question
    }

    if decision != nil { return nil }
    return questions.first { verdicts[$0.itemId] == nil }
  }

  var segments: [PracticeSegment] {
    let current = currentQuestion?.itemId

    return questions.map { question in
      if let verdict = verdicts[question.itemId] { return verdict ? .right : .wrong }
      return question.itemId == current ? .current : .ahead
    }
  }
}
