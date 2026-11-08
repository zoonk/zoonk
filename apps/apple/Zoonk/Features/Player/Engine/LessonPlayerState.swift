import Foundation

/// Network work happens outside and reports back through its methods.
struct LessonPlayerState: Equatable, Sendable {
  enum Phase: Hashable, Sendable {
    case playing
    case checking
    case feedback
    /// Nothing is left to play: the lesson map shows before the lesson is saved.
    case map
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
    /// A question left out because its picture never came is back, since the picture came.
    case pictureReady
    /// "Can't write now" left the lesson's writing out; "Write again" puts it back.
    case writingSkipped
  }

  struct Completion: Equatable, Sendable {
    enum Status: Hashable, Sendable {
      /// Every screen was answered in an earlier sitting: Finish saves it.
      case ready
      case saving
      case saved
      case failed
    }

    var status: Status
    var summary: LessonCompletionSummary?
    /// "I already know this" passed every check and skipped the rest.
    var testedOut = false
  }

  struct QuickCheck: Hashable, Sendable {
    var missed = false
    let returnPosition: Int
    let returnQueue: [String]
  }

  struct Miss: Hashable, Sendable {
    let stepId: String
    let skillId: String?
  }

  struct WritingRestore: Hashable, Sendable {
    let position: Int
    let queue: [String]
    let skippedWritingStepIds: [String]
  }

  struct PendingCheck: Hashable, Sendable {
    let stepId: String
    let answer: LessonAnswer
    let attemptId: String
  }

  let lessonId: String
  private(set) var steps: [String: LessonStep]
  let lessonOrder: [String]
  let hasMap: Bool
  private(set) var queue: [String]
  private(set) var position = 0
  private(set) var phase: Phase
  private(set) var run = Run.idle
  private(set) var answers: [String: LessonAnswer] = [:]
  /// Moves on wherever a screen starts over (a checked attempt coming back, the lesson loading
  /// again), so what the learner did on its canvas (`ActivityWork`) lasts exactly as long as the
  /// answer; moving between screens never clears either.
  private(set) var rounds: [String: Int] = [:]
  private(set) var results: [String: LessonStepResult] = [:]
  /// The first verdict on each answerable screen, which is what the lesson counts.
  private(set) var firstVerdicts: [String: Bool] = [:]
  private var firstVerdictAttemptIds: [String: String] = [:]
  private(set) var answerOrder: [String] = []
  /// Questions already sent to the end of the lesson once.
  private(set) var retried: Set<String> = []
  /// Language answers that already had their one chance to self-correct.
  private(set) var selfCorrected: Set<String> = []
  /// How many parts of a worked example, or decisions of a challenge, are shown.
  private(set) var revealed: [String: Int] = [:]
  /// Screens that can't be played after all (a question about a picture that never came).
  private(set) var unavailableStepIds: [String] = []
  /// Writing left out of this run, without a verdict ("I don't know yet", "Can't write now").
  private(set) var skippedWritingStepIds: [String] = []
  private(set) var writingRestore: WritingRestore?
  /// Questions answered after "Explain first", so memory rates them as helped.
  private(set) var helped: Set<String> = []
  private(set) var misses: [Miss] = []
  private(set) var quickCheck: QuickCheck?
  /// Hyperdrive never carries over from another day.
  private(set) var hyperdriveStart = LessonHyperdriveStart.none
  private(set) var carriedStepIds: Set<String> = []
  private(set) var notice: Notice?
  /// After a finish the server refused: each screen it's missing, with why, until it's answered.
  /// Nil otherwise.
  private var recovery: [String: Notice]?
  /// A server-graded answer sent without a verdict keeps its attempt id while it's unchanged, so
  /// sending it again after a lost reply replays the saved verdict instead of grading it twice.
  private var pendingCheck: PendingCheck?
  private(set) var checkFailed = false
  /// Back on an answered screen with Previous: it shows its result again.
  private(set) var reviewing = false
  private(set) var completion: Completion?
  private(set) var stepStartedAt: Date

  init(
    lessonId: String, steps lessonSteps: [LessonStep], hasMap: Bool = false, now: Date = .now
  ) {
    self.lessonId = lessonId
    steps = Dictionary(lessonSteps.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    lessonOrder = lessonSteps.map(\.id)
    self.hasMap = hasMap
    queue = lessonOrder
    phase = lessonOrder.isEmpty ? .completed : .playing
    completion = lessonOrder.isEmpty ? Completion(status: .ready) : nil
    stepStartedAt = now
  }

  var currentStep: LessonStep? {
    position < queue.count ? steps[queue[position]] : nil
  }

  var currentAnswer: LessonAnswer? {
    currentStep.flatMap { answers[$0.id] }
  }

  var currentResult: LessonStepResult? {
    currentStep.flatMap { results[$0.id] }
  }

  /// Mirrors main's tutor context: a checked answer is what a question is about once its result
  /// shows. A hook's guess only reveals the answer.
  var answerInView: LessonAnswer? {
    guard phase == .feedback, currentResult != nil, let answer = currentAnswer else {
      return nil
    }

    if case .hookGuess = answer {
      return nil
    }

    return answer
  }

  var runId: String? {
    if case .started(let runId) = run {
      return runId
    }

    return nil
  }

  private var isRefused: Bool {
    if case .refused = run {
      return true
    }

    return false
  }

  /// Previous is on every screen after the first while it's being played, the map included, not
  /// during "I know this". It never returns to the earlier copy of a question that came back: the
  /// later copy holds its attempt, so the earlier one would ask for an answer again.
  var canGoBack: Bool {
    guard phase == .playing || phase == .map, position > 0, quickCheck == nil, !isRefused else {
      return false
    }

    let previous = queue[position - 1]
    return results[previous] != nil || !queue[position...].contains(previous)
  }

  /// A screen's verdict when it counts: a hook's guess is never wrong, and "I don't know yet" and an
  /// answer that wasn't checked have none.
  func countedVerdict(_ stepId: String) -> Bool? {
    guard let result = results[stepId], steps[stepId]?.kind != .hook, !result.isSampleAnswer,
      result.checked
    else {
      return nil
    }

    return result.isCorrect
  }

  /// The opening guess with nothing picked: its main button is "I don't know yet", which reveals the
  /// answer; a pick makes it "See the answer".
  var revealsWithoutGuess: Bool {
    guard phase == .playing, let step = currentStep, case .hook(let hook) = step.content,
      hook.asksGuess
    else {
      return false
    }

    return answers[step.id] == nil
  }

  /// "I already know this" ends on the result: a learner who passed every check skips the map.
  private var endsWithMap: Bool {
    hasMap && quickCheck == nil
  }

  /// The screen whose Continue ends the lesson.
  var isLastScreen: Bool {
    position == queue.count - 1 && !endsWithMap
  }

  var progress: Double {
    guard !queue.isEmpty else {
      return 1
    }

    let done = segments.filter { $0 != .ahead && $0 != .current }.count
    return Double(done) / Double(segments.count)
  }

  /// Main's `getSegments`: each screen shows what the run has, wherever the learner is: a first
  /// copy its first verdict, a later copy its own. The position only marks the screen in view.
  var segments: [TaskSegment] {
    let screens: [TaskSegment] = queue.indices.map { index in
      if index == position, phase == .playing || phase == .checking {
        return .current
      }

      if index > position, phase != .completed, !hasRunAnswer(index), continueStopsAt(index) {
        return .ahead
      }

      let id = queue[index]
      let verdict = queue.firstIndex(of: id) == index ? firstVerdicts[id] : results[id]?.isCorrect

      return switch verdict {
      case true?: .right
      case false?: .wrong
      case nil: .read
      }
    }

    return endsWithMap ? screens + [mapSegment] : screens
  }

  /// A retry or a quick check starts its screen over, so only a first copy keeps the run's answer.
  private func hasRunAnswer(_ index: Int) -> Bool {
    let id = queue[index]
    return quickCheck == nil && queue.firstIndex(of: id) == index
      && (results[id] != nil || firstVerdicts[id] != nil)
  }

  /// After a refused finish, Continue stops only at what the run still needs, except through
  /// "I know this", whose every check counts.
  private func continueStopsAt(_ index: Int) -> Bool {
    recovery == nil || quickCheck != nil || isStillNeeded(index)
  }

  /// An answerable screen without a result, or a question that came back.
  private func isStillNeeded(_ index: Int) -> Bool {
    let id = queue[index]
    return (steps[id]?.isAnswerable == true && results[id] == nil)
      || queue.firstIndex(of: id) != index
  }

  private var mapSegment: TaskSegment {
    switch phase {
    case .map: .current
    case .completed: .read
    default: .ahead
    }
  }

  var correctCount: Int { firstVerdicts.values.filter { $0 }.count }
  var answeredCount: Int { firstVerdicts.count }

  var quickCheckProgress: (current: Int, total: Int)? {
    quickCheck.map { _ in (position + 1, queue.count) }
  }

  /// "I already know this" on an explanation, while some check isn't answered right yet.
  var canKnowThis: Bool {
    phase == .playing && quickCheck == nil && !isRefused && currentStep?.kind == .explanation
      && !quickCheckQueue.isEmpty
  }

  /// "Explain first" on a question that comes before its explanation.
  var canExplainFirst: Bool {
    guard phase == .playing, quickCheck == nil, !isRefused, let step = currentStep,
      step.isQuestion, answers[step.id] == nil
    else {
      return false
    }

    return !explanationsAfterCurrent.isEmpty
  }

  /// By the rule the server scores with. Nil for a wrong answer, a repeat, a second try or a streak
  /// under three.
  func hyperdriveStreak(for stepId: String) -> Int? {
    guard queue.firstIndex(of: stepId) == position else {
      return nil
    }

    var streak = hyperdriveStart.streak

    for id in answerOrder where !carriedStepIds.contains(id) {
      guard let isCorrect = firstVerdicts[id] else {
        continue
      }

      let isRepeat = hyperdriveStart.knownStepIds.contains(id)
      streak = isCorrect ? streak + (isRepeat ? 0 : 1) : 0

      if id == stepId {
        return isCorrect && !isRepeat && streak >= 3 ? streak : nil
      }
    }

    return nil
  }

  /// The explanation to offer help with, right after the second answer in a row missed on the
  /// same idea. Never during "I know this", where a miss already brings the learner back.
  var struggleOffer: LessonStep? {
    guard phase == .feedback, quickCheck == nil, misses.count >= 2, let last = misses.last,
      currentStep?.id == last.stepId
    else {
      return nil
    }

    let first = misses[misses.count - 2]

    guard first.stepId == last.stepId || Self.isSameSkill(first.skillId, last.skillId) else {
      return nil
    }

    let ids = queue.reduce(into: [String]()) { ids, id in
      if !ids.contains(id) {
        ids.append(id)
      }
    }

    let questionIndex = ids.firstIndex(of: last.stepId) ?? 0
    let explanations = ids.enumerated().compactMap { index, id -> (Int, LessonStep)? in
      guard let step = steps[id], step.isExplaining, Self.isSameSkill(step.skillId, last.skillId)
      else {
        return nil
      }

      return (index, step)
    }

    let before = explanations.last { $0.0 < questionIndex }
    return (before ?? explanations.first { $0.0 > questionIndex })?.1
  }

  mutating func select(_ answer: LessonAnswer?, for stepId: String) {
    guard phase == .playing else {
      return
    }

    answers[stepId] = answer
  }

  mutating func continueLesson(now: Date = .now) {
    if phase == .feedback {
      advance(now: now)
      return
    }

    if phase == .map {
      complete(status: .saving)
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

  /// Previous: one screen back, keeping what the learner did on the screen they leave. An answered
  /// screen shows its result again; Continue goes on.
  mutating func goBack(now: Date = .now) {
    guard canGoBack else {
      return
    }

    let previousId = queue[position - 1]
    checkFailed = false
    notice = nil
    reviewing = results[previousId] != nil
    phase = reviewing ? .feedback : .playing
    position -= 1
    stepStartedAt = now
  }

  /// "Explain first": the explanation screens move in front of the question, and its answer
  /// counts as helped.
  mutating func explainFirst(now: Date = .now) {
    guard canExplainFirst, let step = currentStep else {
      return
    }

    let ids = explanationsAfterCurrent
    let rest = queue[position...].filter { !ids.contains($0) }
    queue = Array(queue[..<position]) + ids + rest
    helped.insert(step.id)
    stepStartedAt = now
  }

  /// "I already know this": ask every check not yet answered right; passing them all ends the
  /// lesson, a miss goes back to where the learner was.
  mutating func knowThis(now: Date = .now) {
    guard canKnowThis else {
      return
    }

    let checks = quickCheckQueue
    quickCheck = QuickCheck(returnPosition: position, returnQueue: queue)
    notice = nil
    queue = checks
    enter(0, now: now)
  }

  /// "I don't know yet" on a written screen: its good answer shows, counted neither way, and it
  /// doesn't come back at the end. On the opening guess it reveals the answer, counted neither way and,
  /// like a guess, never sent.
  mutating func dontKnow(_ stepId: String) {
    guard phase == .playing, let step = currentStep, step.id == stepId else {
      return
    }

    switch step.content {
    case .typedAnswer(let content):
      checkFailed = false
      notice = nil
      recovery?[stepId] = nil
      phase = .feedback
      results[stepId] = .sampleAnswer(content.sampleAnswer)
      addSkippedWriting([stepId])
    case .hook(let hook) where hook.asksGuess:
      guard let reveal = LessonGrading.revealHook(hook) else {
        return
      }

      resolve(stepId, result: LessonStepResult(reveal), counts: false)
    default:
      return
    }
  }

  /// Number questions are kept. A lesson left with nothing to do as it opens (`opening`) waits for
  /// Finish, since only a learner's action saves one.
  mutating func skipWriting(opening: Bool = false, now: Date = .now) {
    guard phase == .playing else {
      return
    }

    let ahead = queue[position...].filter { steps[$0]?.isWriting == true }

    guard !ahead.isEmpty else {
      return
    }

    let restore = WritingRestore(
      position: position, queue: queue, skippedWritingStepIds: skippedWritingStepIds)
    addSkippedWriting(Array(ahead))
    leaveOutAhead({ ahead.contains($0) }, completionStatus: opening ? .ready : .saving, now: now)

    if phase == .playing {
      notice = .writingSkipped
      writingRestore = restore
    }
  }

  mutating func restoreWriting(now: Date = .now) {
    guard let restore = writingRestore, notice == .writingSkipped, phase == .playing else {
      return
    }

    queue = restore.queue
    skippedWritingStepIds = restore.skippedWritingStepIds
    writingRestore = nil
    notice = nil
    enter(restore.position, now: now)
  }

  /// The attempt id to send the answer on screen under.
  mutating func startChecking(newAttemptId: String = UUID().uuidString.lowercased()) -> String? {
    guard phase == .playing, let step = currentStep, let answer = answers[step.id] else {
      return nil
    }

    if pendingCheck?.stepId != step.id || pendingCheck?.answer != answer {
      pendingCheck = PendingCheck(stepId: step.id, answer: answer, attemptId: newAttemptId)
    }

    checkFailed = false
    phase = .checking
    return pendingCheck?.attemptId
  }

  mutating func failChecking() {
    guard phase == .checking else {
      return
    }

    checkFailed = true
    phase = .playing
  }

  /// Records a verdict. The first one on a screen is what counts. A missed check or activity comes
  /// back once at the end of the lesson; a missed language answer the learner built gets one chance
  /// to self-correct first; during "I know this" a miss ends the quick check instead. A hook's
  /// guess (`counts: false`) only shows its reveal. A verdict only lands on the screen being
  /// answered: one that comes back after the learner left its screen changes nothing.
  mutating func resolve(
    _ stepId: String, result: LessonStepResult, counts: Bool = true, now: Date = .now
  ) {
    guard phase == .playing || phase == .checking, currentStep?.id == stepId,
      let step = steps[stepId]
    else {
      return
    }

    let isFirst = counts && firstVerdicts[stepId] == nil
    let isMiss = counts && !result.isCorrect
    let wasMissing = recovery?.removeValue(forKey: stepId) != nil

    if pendingCheck?.stepId == stepId {
      pendingCheck = nil
    }

    if isMiss, step.canSelfCorrect, quickCheck == nil, !selfCorrected.contains(stepId) {
      if isFirst {
        recordFirstVerdict(stepId, isCorrect: false, attemptId: result.attemptId)
      }

      checkFailed = false
      notice = .selfCorrect
      phase = .playing
      selfCorrected.insert(stepId)
      return
    }

    let willRetry =
      isMiss && quickCheck == nil && step.isRetried && !retried.contains(stepId)
      && !unavailableStepIds.contains(stepId)

    if isFirst {
      recordFirstVerdict(stepId, isCorrect: result.isCorrect, attemptId: result.attemptId)
    }

    if counts {
      misses = result.isCorrect ? [] : misses + [Miss(stepId: stepId, skillId: step.skillId)]
    }

    if isMiss, quickCheck != nil {
      quickCheck?.missed = true
    }

    checkFailed = false
    phase = .feedback
    results[stepId] = result

    if notice == .selfCorrect || wasMissing {
      notice = nil
    }

    if willRetry {
      queue.append(stepId)
      retried.insert(stepId)
    }

    // Matching pairs gives feedback pair by pair, so its check moves on without a second tap.
    if step.kind == .matchColumns {
      advance(now: now)
    }
  }

  /// The server recorded a device-graded answer: its verdict, when its idea comes back, and whether
  /// it went to the mistakes notebook. Where the device's verdict differs, the lesson's count and
  /// the screen's result take the server's; a screen already queued to come back still does.
  mutating func confirm(
    _ stepId: String, attemptId: String, answer: LessonAnswer, verdict: LessonStepResult
  ) {
    if firstVerdictAttemptIds[stepId] == attemptId {
      firstVerdicts[stepId] = verdict.isCorrect
    }

    // A first try sent back to self-correct was right after all, and its answer is still on screen.
    if verdict.isCorrect, notice == .selfCorrect, phase == .playing, currentStep?.id == stepId,
      answers[stepId] == answer
    {
      var result = verdict
      result.attemptId = attemptId
      notice = nil
      phase = .feedback
      results[stepId] = result
      return
    }

    guard var result = results[stepId], result.attemptId == attemptId else {
      return
    }

    result.nextReviewAt = verdict.nextReviewAt
    result.savedMistake = verdict.savedMistake

    if result.isCorrect != verdict.isCorrect {
      result.isCorrect = verdict.isCorrect
      result.correctAnswer =
        verdict.isCorrect ? verdict.correctAnswer : verdict.correctAnswer ?? result.correctAnswer
      result.feedback = verdict.feedback ?? result.feedback
    }

    results[stepId] = result
  }

  /// A question about a numbered picture that never came is left out, since nobody can tell which
  /// number is which (main's `getLostNumberedScreens`).
  mutating func leaveOutLostPictures(openedAt: Date, now: Date = .now) {
    for step in steps.values where step.imagePending {
      if !step.isWaitingForPicture(openedAt: openedAt, now: now) {
        steps[step.id] = step.withoutPendingPictures
      }
    }

    let lost = steps.values.filter { step in
      step.picture?.required == true && step.image == nil
        && !step.isWaitingForPicture(openedAt: openedAt, now: now)
    }

    skipSteps(lost.map(\.id), now: now)
  }

  /// The run started, before the lesson shows. When it already holds answers (the learner came
  /// back to an open run), the lesson continues from them and from the answers the device still
  /// holds (`held`), which the server doesn't have yet.
  mutating func startRun(
    runId: String,
    answers runAnswers: [LessonRunAnswer],
    held: [LessonRunAnswer] = [],
    startedAt: Date = .distantPast,
    hyperdrive: LessonHyperdriveStart = .none,
    optionalStepIds: [String] = []
  ) {
    run = .started(runId: runId)
    hyperdriveStart = hyperdrive
    carriedStepIds = Set(runAnswers.filter { $0.answeredAt < startedAt }.map(\.stepId))
    skipSteps(optionalStepIds)

    // The server records nothing on a screen after its right answer, so a held answer behind one
    // never counts.
    let answers = held.reduce(runAnswers) { all, answer in
      all.contains { $0.stepId == answer.stepId && $0.isCorrect } ? all : all + [answer]
    }

    resume(from: answers.filter { steps[$0.stepId] != nil })
  }

  mutating func refuseRun(_ refusal: LessonRunRefusal) {
    run = .refused(refusal)
  }

  /// The server couldn't finish the lesson: it comes back from the server's answers, with the
  /// questions left out for a picture that has come since (`lesson` is the lesson read again), on
  /// the first screen the server is missing. When nothing it misses can be answered here (it was
  /// left out on this device), the finish fails instead, or the learner would replay the lesson
  /// without end.
  mutating func resync(
    answers runAnswers: [LessonRunAnswer], optionalStepIds: [String] = [],
    lesson: [LessonStep] = [], now: Date = .now
  ) {
    guard phase == .completed else {
      return
    }

    skipSteps(optionalStepIds)
    let known = runAnswers.filter { steps[$0.stepId] != nil }
    let answered = Set(known.map(\.stepId))
    var recovered = restoringPictures(from: lesson, optionalStepIds: optionalStepIds)
    recovered.resetForResume()
    recovered.resume(from: known)

    for id in lessonOrder where recovered.answers[id] != answers[id] {
      recovered.rounds[id, default: 0] += 1
    }

    let missing = recovered.queue.filter {
      steps[$0]?.isAnswerable == true && !answered.contains($0)
    }

    guard let first = missing.first, let position = recovered.queue.firstIndex(of: first) else {
      completion?.status = .failed
      return
    }

    recovered.recovery = Dictionary(
      missing.map { ($0, unavailableStepIds.contains($0) ? .pictureReady : .answerNotSaved) },
      uniquingKeysWith: { reason, _ in reason })
    recovered.enter(position, now: now)
    self = recovered
  }

  /// Screens left out here that the run still needs, back with the picture they now have.
  private func restoringPictures(from lesson: [LessonStep], optionalStepIds: [String])
    -> LessonPlayerState
  {
    var restored = self

    for step in lesson
    where step.image != nil && unavailableStepIds.contains(step.id)
      && !optionalStepIds.contains(step.id)
    {
      restored.steps[step.id] = steps[step.id]?.withPictures(from: step)
      restored.unavailableStepIds.removeAll { $0 == step.id }
    }

    return restored
  }

  mutating func skipSteps(_ stepIds: [String], now: Date = .now) {
    let added = stepIds.filter { steps[$0] != nil && !unavailableStepIds.contains($0) }

    guard !added.isEmpty else {
      return
    }

    unavailableStepIds.append(contentsOf: Set(added))
    let unavailable = unavailableStepIds

    quickCheck = quickCheck.map { check in
      QuickCheck(
        missed: check.missed,
        returnPosition: check.returnQueue.prefix(check.returnPosition).filter {
          !unavailable.contains($0)
        }.count,
        returnQueue: check.returnQueue.filter { !unavailable.contains($0) })
    }

    // Picture recovery can run as the lesson opens; only a learner's Finish saves a lesson then.
    leaveOutAhead({ unavailable.contains($0) }, completionStatus: .ready, now: now)
  }

  mutating func applyPictures(from fresh: [LessonStep]) {
    for step in fresh {
      guard let current = steps[step.id], current.imagePending else {
        continue
      }

      steps[step.id] = current.withPictures(from: step)
    }
  }

  mutating func completionSaving() {
    completion?.status = .saving
  }

  mutating func completionSaved(_ summary: LessonCompletionSummary) {
    completion = Completion(
      status: .saved, summary: summary, testedOut: completion?.testedOut ?? false)
  }

  mutating func completionFailed() {
    completion?.status = .failed
  }

  /// An answered screen shows its result, as Previous does. It starts over only as a missed
  /// question coming back (a later copy) or in "I know this". Any other shows what the learner
  /// left, with why it still waits: its chance to self-correct, or a finish that came back for it.
  private mutating func enter(_ newPosition: Int, now: Date) {
    let id = newPosition < queue.count ? queue[newPosition] : ""

    if results[id] != nil {
      if quickCheck != nil || queue.firstIndex(of: id) != newPosition {
        clearAnswer(id)
        results[id] = nil
      }
    } else if selfCorrected.contains(id) {
      notice = .selfCorrect
    } else if let reason = recovery?[id] {
      notice = reason
    }

    checkFailed = false
    reviewing = results[id] != nil
    phase = reviewing ? .feedback : .playing
    position = newPosition
    stepStartedAt = now
  }

  private mutating func clearAnswer(_ stepId: String) {
    answers[stepId] = nil
    rounds[stepId, default: 0] += 1
  }

  private mutating func complete(status: Completion.Status) {
    completion = Completion(status: status, testedOut: quickCheck != nil)
    phase = .completed
  }

  /// One rule for every way a lesson runs out of screens: the map, as a last screen after them,
  /// then the save.
  private mutating func end(_ status: Completion.Status, now: Date) {
    recovery = nil

    guard endsWithMap else {
      complete(status: status)
      return
    }

    checkFailed = false
    reviewing = false
    phase = .map
    position = queue.count
    stepStartedAt = now
  }

  private mutating func recordFirstVerdict(_ stepId: String, isCorrect: Bool, attemptId: String?) {
    firstVerdicts[stepId] = isCorrect
    firstVerdictAttemptIds[stepId] = attemptId
    answerOrder.append(stepId)
  }

  private mutating func addSkippedWriting(_ stepIds: [String]) {
    skippedWritingStepIds += stepIds.filter { !skippedWritingStepIds.contains($0) }
  }

  private mutating func advance(now: Date) {
    if quickCheck?.missed == true {
      leaveQuickCheck(now: now)
      return
    }

    queue = queue.enumerated().filter { index, id in
      index <= position || !unavailableStepIds.contains(id)
    }.map(\.element)

    guard let next = nextPosition, next < queue.count else {
      end(.saving, now: now)
      return
    }

    notice = nil
    enter(next, now: now)
  }

  private var nextPosition: Int? {
    queue.indices.first { $0 > position && continueStopsAt($0) }
  }

  /// A missed quick check returns to where the learner was, without the checks they just got
  /// right, which already count. The missed one comes back at the end of the lesson, to answer
  /// again.
  private mutating func leaveQuickCheck(now: Date) {
    guard let check = quickCheck else {
      return
    }

    let answered = queue.prefix(position + 1).filter { results[$0] != nil }
    let passed = Set(answered.filter { results[$0]?.isCorrect == true })
    let missed = answered.filter { !passed.contains($0) }
    let rest = check.returnQueue.enumerated().filter { index, id in
      index <= check.returnPosition || (!passed.contains(id) && !missed.contains(id))
    }.map(\.element)

    for id in missed {
      clearAnswer(id)
      results[id] = nil
    }

    quickCheck = nil
    notice = nil
    queue = rest + missed
    retried.formUnion(missed)
    enter(check.returnPosition, now: now)
  }

  /// A lesson with nothing left ends.
  private mutating func leaveOutAhead(
    _ isLeftOut: (String) -> Bool, completionStatus: Completion.Status, now: Date
  ) {
    guard phase != .completed, phase != .map else {
      return
    }

    // A busy current question keeps its verdict; only screens after it are removed.
    let start = min(position + (phase == .playing ? 0 : 1), queue.count)
    let ahead = queue[start...].filter { !isLeftOut($0) }

    guard ahead.count != queue.count - start else {
      return
    }

    let current = position < queue.count ? queue[position] : nil
    queue = Array(queue.prefix(start)) + ahead

    if position < queue.count, queue[position] == current {
      return
    }

    if position >= queue.count {
      end(completionStatus, now: now)
    } else {
      notice = nil
      enter(position, now: now)
    }
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

  private var quickCheckQueue: [String] {
    queue.reduce(into: [String]()) { checks, id in
      if steps[id]?.kind == .check, firstVerdicts[id] != true, !checks.contains(id) {
        checks.append(id)
      }
    }
  }

  /// The explanation screens right after the question in view, up to the next question or the
  /// first one about another skill: what "Explain first" moves in front of it.
  var explanationsAfterCurrent: [String] {
    guard let question = currentStep, position + 1 < queue.count else {
      return []
    }

    let following = queue[(position + 1)...]
    let firstOther = following.firstIndex { id in
      guard let step = steps[id] else {
        return true
      }

      return !step.isExplaining || Self.isOtherSkill(question, step)
    }

    return Array(following[..<(firstOther ?? following.endIndex)])
  }

  /// Screens of two different skills: when either doesn't say, they may be about the same idea.
  private static func isOtherSkill(_ a: LessonStep, _ b: LessonStep) -> Bool {
    a.skillId != nil && b.skillId != nil && a.skillId != b.skillId
  }

  private static func isSameSkill(_ a: String?, _ b: String?) -> Bool {
    a == nil || b == nil || a == b
  }

  /// The opening guess is never sent, so the one made here stays.
  private mutating func resetForResume() {
    let leftOut = unavailableStepIds + skippedWritingStepIds
    let steps = steps
    let isGuess = { (id: String) in steps[id]?.kind == .hook }
    queue = lessonOrder.filter { !leftOut.contains($0) }
    position = 0
    phase = queue.isEmpty ? .completed : .playing
    answers = answers.filter { isGuess($0.key) }
    results = results.filter { isGuess($0.key) }
    firstVerdicts = [:]
    firstVerdictAttemptIds = [:]
    answerOrder = []
    retried = []
    selfCorrected = []
    revealed = [:]
    misses = []
    quickCheck = nil
    writingRestore = nil
    notice = nil
    completion = nil
    reviewing = false
  }

  /// A lesson the learner comes back to continues where they left off: each screen they answered
  /// shows their last answer and counts with their first, a check they missed once comes back at
  /// the end, and the lesson opens at the first screen still to answer, after the reading that
  /// leads to it.
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
    let firsts = known.enumerated().filter { index, answer in
      ids.firstIndex(of: answer.stepId) == index
    }.map(\.element)
    let lessonLength = queue.count
    queue += missedOnce
    firstVerdicts = Dictionary(uniqueKeysWithValues: firsts.map { ($0.stepId, $0.isCorrect) })
    firstVerdictAttemptIds = Dictionary(
      uniqueKeysWithValues: firsts.compactMap { first in
        first.result.attemptId.map { (first.stepId, $0) }
      })
    answerOrder = firsts.map(\.stepId)
    retried = answeredMoreThanOnce.union(missedOnce)

    for answer in known {
      results[answer.stepId] = answer.result
      answers[answer.stepId] = answer.answer

      if case .challenge(let choiceIds) = answer.answer {
        revealed[answer.stepId] = choiceIds.count + 1
      }
    }

    let answered = Set(ids)
    let steps = steps
    let isAnswerable = { (id: String) in steps[id]?.isAnswerable == true }
    let open = queue.indices.first { index in
      isAnswerable(queue[index]) && (index >= lessonLength || !answered.contains(queue[index]))
    }

    guard let open else {
      position = max(queue.count - 1, 0)
      end(.ready, now: .now)
      return
    }

    let readingBefore = queue[..<open].lastIndex { isAnswerable($0) }
    enter(readingBefore.map { $0 + 1 } ?? 0, now: .now)
  }
}

extension LessonStep {
  func isRequiredPictureDrawing(openedAt: Date, now: Date = .now) -> Bool {
    picture?.required == true && isWaitingForPicture(openedAt: openedAt, now: now)
  }

  /// Screens the learner reads and moves past with Continue. A hook with a guess waits for a pick.
  var isRead: Bool {
    switch content {
    case .hook(let hook): hook.variant == .text
    case .explanation, .workedExample, .summary: true
    case .language(let exercise, _): exercise.kind == .alphabet || exercise.kind == .vocabulary
    default: false
    }
  }

  var isAnswerable: Bool {
    !isRead && kind != .hook
  }

  /// Missed checks and activities come back once at the end of the lesson.
  var isRetried: Bool {
    kind == .check || kind == .activity
  }

  var isExplaining: Bool {
    kind == .explanation || kind == .workedExample
  }

  var isQuestion: Bool {
    kind == .activity || kind == .check || kind == .typedAnswer
  }

  /// A written answer; a number typed into a number field is a calculation's answer instead, and
  /// can't be left out.
  var isWriting: Bool {
    guard case .typedAnswer(let content) = content else {
      return false
    }

    return !content.isNumberAnswer
  }

  var canSelfCorrect: Bool {
    guard case .language(let exercise, _) = content else {
      return false
    }

    return [.fillBlank, .listening, .reading].contains(exercise.kind)
  }

  func isServerGraded(_ answer: LessonAnswer) -> Bool {
    switch answer {
    case .typedAnswer, .spokenAnswer: true
    default: false
    }
  }
}

extension TypedAnswerContent {
  /// Every accepted answer is a number, with an optional currency before it ("R$ 18") or a short
  /// unit after it ("1,5 A", "350 kcal", "20%"): it takes a number field.
  var isNumberAnswer: Bool {
    guard let acceptedAnswers, !acceptedAnswers.isEmpty else {
      return false
    }

    return acceptedAnswers.allSatisfy { answer in
      answer.trimmingCharacters(in: .whitespacesAndNewlines).wholeMatch(
        of: /(?:\p{Lu}{0,3}\p{Sc}\s?)?[+\-−]?\d[\d.,\s]*(?:\s?[\p{L}%°Ωµ\/²³]{1,6})?/) != nil
    }
  }

  /// A written explanation in the learner's own words (no accepted wordings, not a number).
  var isOwnWords: Bool {
    !isNumberAnswer && (acceptedAnswers ?? []).isEmpty
  }
}
