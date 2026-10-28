import Foundation

/// The verdict on one screen as the learner sees it.
struct LessonStepResult: Hashable, Sendable {
  struct Correction: Hashable, Sendable {
    let wrong: String
    let right: String
  }

  struct KeyPoint: Hashable, Sendable {
    let text: String
    let met: Bool
  }

  var isCorrect: Bool
  var answerText: String?
  var correctAnswer: String?
  var feedback: String?
  /// False for a typed answer the server recognized without grading it.
  var checked = true
  var corrections: [Correction] = []
  var keyPoints: [KeyPoint]?
  /// Partial credit from 0 to 1 (typed and spoken answers, challenges).
  var score: Double?
  /// A typed answer right apart from a typo: the right spelling.
  var spelling: String?
  /// A recording's words to say again.
  var wordsToPractice: [String] = []
  /// When the idea comes back, once the server recorded the answer.
  var nextReviewAt: Date?
  var savedMistake = false
  /// The id a device-graded answer is saved under, so a late server reply about an earlier
  /// answer to the same screen can't change this one.
  var attemptId: String?

  init(_ grade: LocalGrade, attemptId: String? = nil) {
    isCorrect = grade.isCorrect
    answerText = grade.answerText
    correctAnswer = grade.correctAnswer
    feedback = grade.feedback
    self.attemptId = attemptId
  }

  init(isCorrect: Bool, answerText: String?, correctAnswer: String?, feedback: String?) {
    self.isCorrect = isCorrect
    self.answerText = answerText
    self.correctAnswer = correctAnswer
    self.feedback = feedback
  }
}

/// An answer the server holds for an open run, oldest first.
struct LessonRunAnswer: Hashable, Sendable {
  let stepId: String
  let isCorrect: Bool
  let answeredAt: Date
}

/// Why a lesson can't start or continue right now.
enum LessonRunRefusal: Hashable, Sendable, Error {
  enum Tier: Hashable, Sendable {
    case guest, free, plus
  }

  enum Period: Hashable, Sendable {
    case day, month, total
  }

  case failed
  /// The plan's lessons are used up: a guest signs up, a free learner upgrades, Plus comes back later.
  case limitReached(tier: Tier, period: Period)
  case notFound
  /// A free exam plan past its first week opens this new lesson with Plus only.
  case plusRequired
  case slowDown(retryAfterSeconds: Int)
  case unauthorized
}

/// What a finished lesson earned, as the server counted it.
struct LessonCompletionSummary: Hashable, Sendable {
  let brainPower: Int
  let totalBrainPower: Double
  let correctCount: Int
  let incorrectCount: Int
  let energyDelta: Double
  let seconds: Int
  let isFirstCompletion: Bool
  let nextReviewAt: Date?
  /// The belt level this lesson took the learner to, to celebrate.
  let reachedLevel: Int?
}

/// The lesson in play. Every screen kind runs through it: the views read this state and report
/// the learner's actions; network work happens outside and reports back through its methods.
struct LessonPlayerState: Hashable, Sendable {
  enum Phase: Hashable, Sendable {
    /// The screen takes an answer or a tap on Continue.
    case playing
    /// A typed or spoken answer is with the server.
    case checking
    /// The screen shows its verdict.
    case feedback
    /// The last screen is done: the lesson is saving or saved.
    case completed
  }

  enum Run: Hashable, Sendable {
    case idle
    case started(runId: String)
    case refused(LessonRunRefusal)
  }

  enum Notice: Hashable, Sendable {
    /// A wrong language answer the learner built stays for one more try.
    case selfCorrect
    /// An answer never reached the server, so the lesson came back to its screen.
    case answerNotSaved
  }

  struct Completion: Hashable, Sendable {
    enum Status: Hashable, Sendable {
      /// Every screen was answered in an earlier sitting: Finish saves it.
      case ready
      case saving
      case saved
      case failed
    }

    var status: Status
    var summary: LessonCompletionSummary?
  }

  let lessonId: String
  let steps: [String: LessonStep]
  private let lessonOrder: [String]
  private(set) var support: LessonSupport?
  private(set) var queue: [String]
  private(set) var position = 0
  private(set) var phase: Phase
  private(set) var run = Run.idle
  private(set) var answers: [String: LessonAnswer] = [:]
  private(set) var results: [String: LessonStepResult] = [:]
  /// The first verdict on each answerable screen, which is what the lesson counts.
  private(set) var firstVerdicts: [String: Bool] = [:]
  /// Questions already sent to the end of the lesson once.
  private(set) var retried: Set<String> = []
  /// Language answers that already had their one chance to self-correct.
  private(set) var selfCorrected: Set<String> = []
  /// How many parts of a worked example, or decisions of a challenge, are shown.
  private(set) var revealed: [String: Int] = [:]
  /// Screens that can't be played after all (a question about a picture that never came).
  private(set) var unavailableStepIds: [String] = []
  private(set) var notice: Notice?
  /// The server couldn't grade the last typed or spoken answer; the learner can try again.
  private(set) var checkFailed = false
  /// Back on an answered screen with Previous: it shows its result again.
  private(set) var reviewing = false
  private(set) var completion: Completion?
  private(set) var stepStartedAt: Date

  enum LessonSupport: String, Hashable, Sendable {
    case explanationFirst, questionFirst
  }

  init(
    lessonId: String, steps lessonSteps: [LessonStep], support: LessonSupport? = nil,
    now: Date = .now
  ) {
    self.lessonId = lessonId
    steps = Dictionary(lessonSteps.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    lessonOrder = lessonSteps.map(\.id)
    self.support = support
    queue = Self.orderOpening(lessonOrder, steps: steps, support: support)
    phase = lessonOrder.isEmpty ? .completed : .playing
    completion = lessonOrder.isEmpty ? Completion(status: .ready) : nil
    stepStartedAt = now
  }

  // MARK: - Reading

  var currentStep: LessonStep? {
    position < queue.count ? steps[queue[position]] : nil
  }

  var currentAnswer: LessonAnswer? {
    currentStep.flatMap { answers[$0.id] }
  }

  var currentResult: LessonStepResult? {
    currentStep.flatMap { results[$0.id] }
  }

  var runId: String? {
    if case .started(let runId) = run {
      return runId
    }

    return nil
  }

  /// Previous is on every screen after the first while it's being played.
  var canGoBack: Bool {
    guard phase == .playing, position > 0 else {
      return false
    }

    if case .refused = run {
      return false
    }

    return true
  }

  /// How far the learner is, from 0 to 1, for the progress bar.
  var progress: Double {
    guard !queue.isEmpty else {
      return 1
    }

    let done = phase == .completed ? queue.count : position + (phase == .feedback ? 1 : 0)
    return Double(done) / Double(queue.count)
  }

  var correctCount: Int { firstVerdicts.values.filter { $0 }.count }
  var answeredCount: Int { firstVerdicts.count }

  // MARK: - The learner's actions

  mutating func select(_ answer: LessonAnswer?, for stepId: String) {
    guard phase == .playing else {
      return
    }

    answers[stepId] = answer
  }

  /// Continue: past a verdict, through a worked example or a challenge, or past a read screen.
  mutating func continueLesson(now: Date = .now) {
    if phase == .feedback {
      advance(now: now)
      return
    }

    guard phase == .playing, let step = currentStep else {
      return
    }

    if case .challenge(let content) = step.content {
      continueChallenge(step.id, content: content)
    } else if step.isRead {
      continueReading(step, now: now)
    }
  }

  /// Previous: one screen back. An answered screen shows its result again; Continue goes on.
  mutating func goBack(now: Date = .now) {
    guard canGoBack else {
      return
    }

    let previousId = queue[position - 1]
    answers[queue[position]] = nil
    checkFailed = false
    notice = nil
    reviewing = results[previousId] != nil
    phase = reviewing ? .feedback : .playing
    position -= 1
    stepStartedAt = now
  }

  // MARK: - Checking

  /// A server-graded answer is on its way: the screen waits for the verdict.
  mutating func startChecking() {
    guard phase == .playing else {
      return
    }

    checkFailed = false
    phase = .checking
  }

  /// The server didn't grade the answer: the learner can try again.
  mutating func failChecking() {
    guard phase == .checking else {
      return
    }

    checkFailed = true
    phase = .playing
  }

  /// Records a verdict. The first one on a screen is what counts. A missed check or activity comes
  /// back once at the end of the lesson; a missed language answer the learner built gets one chance
  /// to self-correct first. A hook's guess and the like (`counts: false`) only show their reveal.
  mutating func resolve(
    _ stepId: String, result: LessonStepResult, counts: Bool = true, now: Date = .now
  ) {
    guard phase != .completed, let step = steps[stepId] else {
      return
    }

    let isFirst = counts && firstVerdicts[stepId] == nil
    let isMiss = counts && !result.isCorrect

    if isMiss, step.canSelfCorrect, !selfCorrected.contains(stepId) {
      if isFirst {
        firstVerdicts[stepId] = false
      }

      checkFailed = false
      notice = .selfCorrect
      phase = .playing
      selfCorrected.insert(stepId)
      return
    }

    let willRetry =
      isMiss && step.isRetried && !retried.contains(stepId)
      && !unavailableStepIds.contains(stepId)

    if isFirst {
      firstVerdicts[stepId] = result.isCorrect
    }

    checkFailed = false
    notice = notice == .selfCorrect ? nil : notice
    phase = .feedback
    results[stepId] = result

    if willRetry {
      queue.append(stepId)
      retried.insert(stepId)
    }

    // Matching pairs gives feedback pair by pair, so its check moves on without a second tap.
    if step.kind == .matchColumns {
      advance(now: now)
    }
  }

  /// The server recorded a device-graded answer: when its idea comes back, and whether it went to
  /// the mistakes notebook. A reply about an earlier answer to the screen changes nothing.
  mutating func confirm(
    _ stepId: String, attemptId: String, nextReviewAt: Date?, savedMistake: Bool
  ) {
    guard var result = results[stepId], result.attemptId == attemptId else {
      return
    }

    result.nextReviewAt = nextReviewAt
    result.savedMistake = savedMistake
    results[stepId] = result
  }

  // MARK: - The run

  /// The run started. When it already holds answers the screen doesn't show (the learner came
  /// back to an open run), the lesson continues from them. Once the learner answered anything
  /// here, their screen leads.
  mutating func startRun(
    runId: String,
    answers runAnswers: [LessonRunAnswer],
    optionalStepIds: [String] = [],
    support: LessonSupport? = nil
  ) {
    let isUntouched = results.isEmpty

    if isUntouched, support != self.support {
      self.support = support
      queue = Self.orderOpening(queue, steps: steps, support: support)
    }

    run = .started(runId: runId)
    skipSteps(optionalStepIds)

    let known = runAnswers.filter { steps[$0.stepId] != nil }

    guard isUntouched, Self.verdicts(known) != firstVerdicts else {
      return
    }

    resume(from: known)
  }

  mutating func refuseRun(_ refusal: LessonRunRefusal) {
    run = .refused(refusal)
  }

  /// The server couldn't finish the lesson because an answer the screens show never reached it:
  /// the lesson goes back to the first screen it's missing.
  mutating func resync(answers runAnswers: [LessonRunAnswer], optionalStepIds: [String] = []) {
    guard phase == .completed else {
      return
    }

    skipSteps(optionalStepIds)
    var resumed = self
    resumed.resetForResume()
    resumed.resume(from: runAnswers.filter { steps[$0.stepId] != nil })

    if resumed.phase == .completed {
      completion?.status = .failed
    } else {
      self = resumed
      notice = .answerNotSaved
    }
  }

  /// Leaves out screens that can't be played after all: the rest goes on from where the learner is.
  mutating func skipSteps(_ stepIds: [String], now: Date = .now) {
    let added = stepIds.filter { steps[$0] != nil && !unavailableStepIds.contains($0) }

    guard !added.isEmpty else {
      return
    }

    unavailableStepIds.append(contentsOf: Set(added))

    guard phase != .completed else {
      return
    }

    // A busy current question keeps its verdict; only screens after it are removed.
    let start = position + (phase == .playing ? 0 : 1)
    let ahead = queue[min(start, queue.count)...].filter { !unavailableStepIds.contains($0) }
    let current = position < queue.count ? queue[position] : nil
    queue = Array(queue.prefix(start)) + ahead

    if position < queue.count, queue[position] == current {
      return
    }

    if position >= queue.count {
      complete(status: .ready)
    } else {
      enter(position, now: now)
    }
  }

  // MARK: - Completion

  mutating func completionSaving() {
    completion?.status = .saving
  }

  mutating func completionSaved(_ summary: LessonCompletionSummary) {
    completion = Completion(status: .saved, summary: summary)
  }

  mutating func completionFailed() {
    completion?.status = .failed
  }

  // MARK: - Flow

  private mutating func enter(_ newPosition: Int, now: Date) {
    let id = newPosition < queue.count ? queue[newPosition] : ""
    answers[id] = nil
    results[id] = nil
    checkFailed = false
    phase = .playing
    position = newPosition
    reviewing = false
    stepStartedAt = now
  }

  private mutating func complete(status: Completion.Status) {
    completion = Completion(status: status)
    phase = .completed
  }

  /// Moves past the current screen: to the next one, or to the end.
  private mutating func advance(now: Date) {
    queue = queue.enumerated().filter { index, id in
      index <= position || !unavailableStepIds.contains(id)
    }.map(\.element)

    guard position + 1 < queue.count else {
      complete(status: .saving)
      return
    }

    notice = nil
    enter(position + 1, now: now)
  }

  /// Continue on a worked example reveals one part at a time, then moves on.
  private mutating func continueReading(_ step: LessonStep, now: Date) {
    guard case .workedExample(let content) = step.content else {
      advance(now: now)
      return
    }

    let shown = revealed[step.id] ?? 1

    if shown >= content.steps.count {
      advance(now: now)
    } else {
      revealed[step.id] = shown + 1
    }
  }

  /// Continue in a challenge starts the case from its intro, then confirms the pick for the
  /// decision on screen. The finished case is checked instead.
  private mutating func continueChallenge(_ stepId: String, content: ChallengeContent) {
    let shown = revealed[stepId] ?? 0
    let progress = ChallengeProgress(content: content, picks: challengePicks(stepId), shown: shown)

    switch progress {
    case .intro:
      revealed[stepId] = shown + 1
    case .deciding(_, _, _, let pending) where pending != nil:
      revealed[stepId] = shown + 1
    default:
      break
    }
  }

  func challengePicks(_ stepId: String) -> [String] {
    if case .challenge(let choiceIds) = answers[stepId] {
      return choiceIds
    }

    return []
  }

  // MARK: - Resuming

  private static func verdicts(_ answers: [LessonRunAnswer]) -> [String: Bool] {
    var verdicts: [String: Bool] = [:]

    for answer in answers where verdicts[answer.stepId] == nil {
      verdicts[answer.stepId] = answer.isCorrect
    }

    return verdicts
  }

  /// The lesson from the top, before replaying a run's answers on it.
  private mutating func resetForResume() {
    queue = Self.orderOpening(lessonOrder, steps: steps, support: support).filter {
      !unavailableStepIds.contains($0)
    }
    position = 0
    phase = queue.isEmpty ? .completed : .playing
    answers = [:]
    results = [:]
    firstVerdicts = [:]
    retried = []
    selfCorrected = []
    revealed = [:]
    notice = nil
    completion = nil
    reviewing = false
  }

  /// A lesson the learner comes back to continues where they left off: the screens they answered
  /// count with their first answer, a check they missed once comes back at the end, and the
  /// lesson opens at the first screen still to answer, after the reading that leads to it.
  private mutating func resume(from known: [LessonRunAnswer]) {
    guard !known.isEmpty else {
      return
    }

    let missedOnce = queue.filter { id in
      let tries = known.filter { $0.stepId == id }
      return steps[id]?.isRetried == true && tries.count == 1 && tries.first?.isCorrect == false
    }

    let ids = known.map(\.stepId)
    let answeredMoreThanOnce = Set(
      ids.enumerated().filter { index, id in ids.firstIndex(of: id) != index }.map(\.element))
    let lessonLength = queue.count
    queue += missedOnce
    firstVerdicts = Self.verdicts(known)
    retried = answeredMoreThanOnce.union(missedOnce)

    let answered = Set(ids)
    let steps = steps
    let isAnswerable = { (id: String) in steps[id]?.isAnswerable == true }
    let open = queue.indices.first { index in
      isAnswerable(queue[index]) && (index >= lessonLength || !answered.contains(queue[index]))
    }

    guard let open else {
      position = max(queue.count - 1, 0)
      complete(status: .ready)
      return
    }

    let readingBefore = queue[..<open].lastIndex { isAnswerable($0) }
    position = readingBefore.map { $0 + 1 } ?? 0
  }

  /// A lesson that opens with explanations gets the check (or activity) that follows them first
  /// when the learner partly knows the skill (`questionFirst`): they try what they know, then read.
  private static func orderOpening(
    _ queue: [String], steps: [String: LessonStep], support: LessonSupport?
  )
    -> [String]
  {
    guard support == .questionFirst,
      let start = queue.firstIndex(where: { steps[$0]?.kind != .hook }),
      let opening = steps[queue[start]], opening.isExplaining,
      let questionIndex = queue.indices.first(where: {
        $0 > start && steps[queue[$0]]?.isExplaining == false
      }),
      let question = steps[queue[questionIndex]], question.isRetried,
      question.skillId == nil || opening.skillId == nil || question.skillId == opening.skillId
    else {
      return queue
    }

    var reordered = queue
    reordered.remove(at: questionIndex)
    reordered.insert(question.id, at: start)
    return reordered
  }
}

extension LessonStep {
  /// Screens the learner reads and moves past with Continue. A hook with a guess waits for a pick.
  var isRead: Bool {
    switch content {
    case .hook(let hook): hook.variant == .text
    case .explanation, .workedExample, .summary: true
    case .language(let exercise, _): exercise.kind == .alphabet || exercise.kind == .vocabulary
    default: false
    }
  }

  /// Screens that take an answer the run records (everything but reading and a hook).
  var isAnswerable: Bool {
    !isRead && kind != .hook
  }

  /// Missed checks and activities come back once at the end of the lesson.
  var isRetried: Bool {
    kind == .check || kind == .activity
  }

  /// The explanation of an idea, which a question about it may come before.
  var isExplaining: Bool {
    kind == .explanation || kind == .workedExample
  }

  /// A wrong language answer the learner built gets a prompt to fix it before the answer shows.
  var canSelfCorrect: Bool {
    guard case .language(let exercise, _) = content else {
      return false
    }

    return [.fillBlank, .listening, .reading].contains(exercise.kind)
  }

  /// Typed and spoken answers wait for the server's grade.
  func isServerGraded(_ answer: LessonAnswer) -> Bool {
    switch answer {
    case .typedAnswer, .spokenAnswer: true
    default: false
    }
  }
}
