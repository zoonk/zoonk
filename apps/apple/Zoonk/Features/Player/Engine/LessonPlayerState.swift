import Foundation

/// Network work happens outside and reports back through its methods.
struct LessonPlayerState: Hashable, Sendable {
  enum Phase: Hashable, Sendable {
    case playing
    case checking
    case feedback
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
    /// "Can't write now" left the lesson's writing out; "Write again" puts it back.
    case writingSkipped
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

  enum LessonSupport: String, Hashable, Sendable {
    case explanationFirst, questionFirst
  }

  /// A device-graded answer the server hasn't accepted yet: the lesson can't finish without it,
  /// and a resend keeps its attempt id so the server records it once.
  struct UnsavedAnswer: Hashable, Sendable {
    let answer: LessonAnswer
    let attemptId: String
    let durationMs: Int
    let usedHelp: Bool
  }

  let lessonId: String
  private(set) var steps: [String: LessonStep]
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
  private(set) var checkFailed = false
  /// Back on an answered screen with Previous: it shows its result again.
  private(set) var reviewing = false
  private(set) var completion: Completion?
  private(set) var stepStartedAt: Date
  private(set) var unsavedAnswers: [String: UnsavedAnswer] = [:]

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

  private var isRefused: Bool {
    if case .refused = run {
      return true
    }

    return false
  }

  /// Previous is on every screen after the first while it's being played, not during "I know this".
  var canGoBack: Bool {
    phase == .playing && position > 0 && quickCheck == nil && !isRefused
  }

  var progress: Double {
    guard !queue.isEmpty else {
      return 1
    }

    let done = phase == .completed ? queue.count : position + (phase == .feedback ? 1 : 0)
    return Double(done) / Double(queue.count)
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

  /// "Explain first": the explanation screens move in front of the question, and its answer
  /// counts as helped.
  mutating func explainFirst(now: Date = .now) {
    guard canExplainFirst, let step = currentStep else {
      return
    }

    let ids = explanationsAfterCurrent
    let rest = queue[position...].filter { !ids.contains($0) }
    queue = Array(queue[..<position]) + ids + rest
    answers[step.id] = nil
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
  /// doesn't come back at the end.
  mutating func dontKnow(_ stepId: String) {
    guard phase == .playing, let step = currentStep, step.id == stepId,
      case .typedAnswer(let content) = step.content
    else {
      return
    }

    checkFailed = false
    notice = nil
    phase = .feedback
    results[stepId] = .sampleAnswer(content.sampleAnswer)
    addSkippedWriting([stepId])
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

  mutating func startChecking() {
    guard phase == .playing else {
      return
    }

    checkFailed = false
    phase = .checking
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
  /// guess (`counts: false`) only shows its reveal.
  mutating func resolve(
    _ stepId: String, result: LessonStepResult, counts: Bool = true, saving: UnsavedAnswer? = nil,
    now: Date = .now
  ) {
    guard phase != .completed, let step = steps[stepId] else {
      return
    }

    // Kept before anything moves on: match columns finishes a lesson on its own check.
    if let saving {
      unsavedAnswers[stepId] = saving
    }

    let isFirst = counts && firstVerdicts[stepId] == nil
    let isMiss = counts && !result.isCorrect

    if isMiss, step.canSelfCorrect, quickCheck == nil, !selfCorrected.contains(stepId) {
      if isFirst {
        recordFirstVerdict(stepId, isCorrect: false)
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
      recordFirstVerdict(stepId, isCorrect: result.isCorrect)
    }

    if counts {
      misses = result.isCorrect ? [] : misses + [Miss(stepId: stepId, skillId: step.skillId)]
    }

    if isMiss, quickCheck != nil {
      quickCheck?.missed = true
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
    answerSaved(stepId, attemptId: attemptId)

    guard var result = results[stepId], result.attemptId == attemptId else {
      return
    }

    result.nextReviewAt = nextReviewAt
    result.savedMistake = savedMistake
    results[stepId] = result
  }

  /// The server accepted (or refused for good) an answer: it no longer holds the lesson back. A
  /// reply about an earlier attempt leaves a newer one waiting.
  mutating func answerSaved(_ stepId: String, attemptId: String) {
    if unsavedAnswers[stepId]?.attemptId == attemptId {
      unsavedAnswers[stepId] = nil
    }
  }

  func isWaitingForPicture(_ step: LessonStep, openedAt: Date, now: Date = .now) -> Bool {
    step.isAnswerable && step.isWaitingForPicture(openedAt: openedAt, now: now)
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
      step.asksNumberedPicture && step.image == nil
        && !step.isWaitingForPicture(openedAt: openedAt, now: now)
    }

    skipSteps(lost.map(\.id), now: now)
  }

  /// The run started. When it already holds answers the screen doesn't show (the learner came
  /// back to an open run), the lesson continues from them. Once the learner answered anything
  /// here, their screen leads.
  mutating func startRun(
    runId: String,
    answers runAnswers: [LessonRunAnswer],
    startedAt: Date = .distantPast,
    hyperdrive: LessonHyperdriveStart = .none,
    optionalStepIds: [String] = [],
    support: LessonSupport? = nil
  ) {
    let isUntouched = results.isEmpty && quickCheck == nil

    if isUntouched, support != self.support {
      self.support = support
      queue = Self.orderOpening(queue, steps: steps, support: support)
    }

    run = .started(runId: runId)
    hyperdriveStart = hyperdrive
    carriedStepIds = Set(runAnswers.filter { $0.answeredAt < startedAt }.map(\.stepId))
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
    let known = runAnswers.filter { steps[$0.stepId] != nil }
    let answered = Set(known.map(\.stepId))
    var resumed = self
    resumed.resetForResume()
    resumed.resume(from: known)

    // Going back helps only if a screen here is still to answer; when the one the server misses
    // was left out on this device, the learner would replay the lesson without end.
    let isOpen = resumed.queue.contains {
      steps[$0]?.isAnswerable == true && !answered.contains($0)
    }

    if isOpen {
      self = resumed
      notice = .answerNotSaved
    } else {
      completion?.status = .failed
    }
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
    completion = Completion(status: status, testedOut: quickCheck != nil)
    phase = .completed
  }

  private mutating func recordFirstVerdict(_ stepId: String, isCorrect: Bool) {
    firstVerdicts[stepId] = isCorrect
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

    guard position + 1 < queue.count else {
      complete(status: .saving)
      return
    }

    notice = nil
    enter(position + 1, now: now)
  }

  /// A missed quick check returns to where the learner was, without the checks they just got
  /// right, which already count. The missed one comes back at the end of the lesson.
  private mutating func leaveQuickCheck(now: Date) {
    guard let check = quickCheck else {
      return
    }

    let answered = queue.filter { results[$0] != nil }
    let passed = Set(answered.filter { results[$0]?.isCorrect == true })
    let missed = answered.filter { !passed.contains($0) }
    let rest = check.returnQueue.enumerated().filter { index, id in
      index <= check.returnPosition || (!passed.contains(id) && !missed.contains(id))
    }.map(\.element)

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
    guard phase != .completed else {
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
      complete(status: completionStatus)
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
  private var explanationsAfterCurrent: [String] {
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

  private static func verdicts(_ answers: [LessonRunAnswer]) -> [String: Bool] {
    var verdicts: [String: Bool] = [:]

    for answer in answers where verdicts[answer.stepId] == nil {
      verdicts[answer.stepId] = answer.isCorrect
    }

    return verdicts
  }

  private mutating func resetForResume() {
    let leftOut = unavailableStepIds + skippedWritingStepIds
    queue = Self.orderOpening(lessonOrder, steps: steps, support: support).filter {
      !leftOut.contains($0)
    }
    position = 0
    phase = queue.isEmpty ? .completed : .playing
    answers = [:]
    results = [:]
    firstVerdicts = [:]
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
    answerOrder = ids.enumerated().filter { index, id in ids.firstIndex(of: id) == index }.map(
      \.element)
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
  var asksNumberedPicture: Bool {
    let description: LessonPictureDescription? =
      switch content {
      case .check(let content): content.image
      case .activity(let content): content.image
      case .hook(let content): content.image
      case .workedExample(let content): content.image
      default: nil
      }

    return !(description?.parts ?? []).isEmpty
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
