import Foundation
import Observation
import SwiftUI

/// Every step reads the mock again, so the screen always matches what's stored.
@MainActor
@Observable
final class MockRun {
  enum Step: Equatable {
    case submit
    case finish
    case endBreak
    case startSpeaking
  }

  enum EssayGrading: Equatable {
    case idle
    case grading
    case failed
  }

  private static let slowAfter = Duration.seconds(10)
  private static let stepTimeout = Duration.seconds(45)
  /// A speaking paper not written yet takes about a minute.
  private static let paperTimeout = Duration.seconds(300)
  /// Essays take 10 to 25 s each to grade, at once for a mock's few.
  private static let gradingTimeout = Duration.seconds(120)
  private static let textSaveDelay = Duration.milliseconds(1500)
  private static let leaveWait = Duration.seconds(5)
  private static let answerDeadlineGrace: TimeInterval = 30

  let mock: Resource<MockView>
  let queue: MockDraftQueue

  private(set) var drafts: [String: MockDraft] = [:]
  private var initiallyStored: [String: MockDraft] = [:]
  private var partials: [String: PracticeAnswer] = [:]
  private(set) var position = 0
  private(set) var busy: Step?
  private(set) var failed = false
  private(set) var slow = false
  private(set) var isWritingPaper = false
  private(set) var essayGrading: EssayGrading = .idle
  private var sectionTimeUp = false

  private var reached = 0
  private var changed: [Int] = []
  private var questionTimeUp = false

  @ObservationIgnored private let store: ExamStore
  @ObservationIgnored private let blockId: String
  @ObservationIgnored private let now: () -> Date
  @ObservationIgnored private let unsent: UnsentMockDrafts
  @ObservationIgnored private var adopted: String?
  @ObservationIgnored private var shown: (itemId: String, at: ContinuousClock.Instant)?
  @ObservationIgnored private var unsavedText: MockDraft?
  @ObservationIgnored private var textTask: Task<Void, Never>?
  @ObservationIgnored private let taps = ScreenTasks()

  init(
    store: ExamStore,
    blockId: String,
    defaults: UserDefaults = .standard,
    now: @escaping () -> Date = { .now }
  ) {
    self.store = store
    self.blockId = blockId
    self.now = now
    let mock = store.mock(blockId: blockId)
    self.mock = mock
    let unsent = UnsentMockDrafts(blockId: blockId, defaults: defaults)
    self.unsent = unsent
    // A save the session changed under didn't reach the server either: it stays kept and retried.
    queue = MockDraftQueue { [store] draft in
      switch await store.write({ api, token in
        try await api.saveAnswer(token: token, blockId: blockId, draft: draft)
      }) {
      case .done(let stored):
        unsent.drop(draft)
        return stored ? .stored : .refused
      case .failed, .obsolete:
        return .unreachable
      }
    }
  }

  var view: MockView? { mock.value }
  var current: MockCurrent? { view?.current }
  var questions: [MockQuestion] { current?.questions ?? [] }

  var question: MockQuestion? {
    questions.indices.contains(position) ? questions[position] : nil
  }

  func isCountedAsAnswered(_ itemId: String) -> Bool {
    queue.countsTowardsProgress(drafts[itemId], initiallyStored: initiallyStored[itemId])
  }

  var timeUp: Bool { sectionTimeUp || questionTimeUp }
  var pending: Bool { busy != nil }

  /// A step's button waits while another step's request runs; its own keeps it busy, not disabled.
  func pending(besides step: Step) -> Bool { busy != nil && busy != step }

  var moves: MockSectionMoves {
    MockSectionMoves(
      answered: question.map { drafts[$0.itemId]?.isAnswered ?? false } ?? false,
      changed: changed,
      changesAllowed: current.flatMap { current in
        current.changesLeft.map { $0 + current.changedItemIds.count }
      },
      navigation: view?.currentSection?.navigation, position: position, reached: reached,
      total: questions.count)
  }

  func adopt(_ view: MockView) {
    let key = "\(view.status.rawValue):\(view.current?.section ?? -1)"

    guard key != adopted else {
      return
    }

    adopted = key
    queue.forgetRefusals()
    shown = nil
    drafts = Dictionary(
      (view.current?.drafts ?? []).map { ($0.itemId, $0) }, uniquingKeysWith: { _, last in last })
    initiallyStored = drafts
    position = view.current?.resume ?? 0
    reached = position
    let questionIds = (view.current?.questions ?? []).map(\.itemId)
    changed = (view.current?.changedItemIds ?? []).compactMap { questionIds.firstIndex(of: $0) }
    questionTimeUp = Self.hasExpiredFinalQuestion(view)
    sectionTimeUp = view.current.map { $0.deadline <= .now } ?? false
    restoreUnsent(view)
  }

  /// Answers kept on the device go out again in the order they were made, counting a review's
  /// changes as they did then.
  private func restoreUnsent(_ view: MockView) {
    guard view.status == .running, let current = view.current else {
      if view.status == .finished || view.status == .expired {
        unsent.clear()
      }

      return
    }

    let questionIds = current.questions.map(\.itemId)

    for kept in unsent.restore(for: Set(questionIds), matching: initiallyStored) {
      guard let index = questionIds.firstIndex(of: kept.itemId) else { continue }
      let draft = kept.edit == nil ? kept.nextEdit() : kept
      unsent.keep(draft, inPlace: true)
      reached = max(reached, index)
      countChange(draft.itemId, at: index, to: draft.answer)
      drafts[draft.itemId] = draft
      queue.add(draft)
    }

    if moves.forwardOnly {
      position = reached
    }
  }

  /// A partial answer, or text as typed, stays on the device; the mock saves only its answer.
  func answerBinding(for question: MockQuestion) -> Binding<PracticeAnswer?> {
    Binding(
      get: { [weak self] in
        self?.partials[question.itemId] ?? self?.drafts[question.itemId]?.answer
      },
      set: { [weak self] answer in
        guard self?.pending == false else { return }
        self?.partials[question.itemId] = answer?.complete == answer ? nil : answer
        let saved = answer?.complete

        switch question.format {
        case .typed, .numeric, .essay: self?.write(saved)
        case .multipleChoice, .trueFalse: self?.answer(saved)
        }
      })
  }

  func answer(_ answer: PracticeAnswer?) {
    guard let question, canAnswer(answer) else { return }
    var draft = withTimeSpent(question.itemId)
    draft.answer = answer
    persist(draft.nextEdit())
  }

  func write(_ answer: PracticeAnswer?) {
    guard let question, canAnswer(answer) else { return }
    var draft = (drafts[question.itemId] ?? .empty(question.itemId)).nextEdit()
    draft.answer = answer
    drafts[question.itemId] = draft
    unsavedText = draft
    unsent.keep(draft, inPlace: queue.isWaiting(draft.itemId))
    textTask?.cancel()
    textTask = Task { [weak self] in
      try? await Task.sleep(for: Self.textSaveDelay)
      guard !Task.isCancelled else { return }
      self?.saveText()
    }
  }

  func toggleUnsure() {
    guard let question, !pending, !timeUp else { return }
    unsavedText = nil
    saveText()
    var draft = withTimeSpent(question.itemId)
    draft.unsure.toggle()
    persist(draft.nextEdit())
  }

  /// In a forward-only section a question is saved as reached at once, so the ones before it stay
  /// behind the learner.
  func show(_ itemId: String) {
    shown = (itemId, .now)

    if moves.forwardOnly, drafts[itemId] == nil {
      persist(MockDraft.empty(itemId).nextEdit())
    }
  }

  func timeOutSection() {
    if let question {
      leave(question.itemId)
    }
    sectionTimeUp = true
  }

  func leave(_ itemId: String) {
    guard shown?.itemId == itemId else { return }
    let canSaveTime =
      current.map { now() <= $0.deadline.addingTimeInterval(Self.answerDeadlineGrace) } ?? true
    let shouldSave = unsavedText != nil || (canSaveTime && !queue.wasRefused(itemId))
    unsavedText = nil
    saveText()
    if shouldSave {
      persist(withTimeSpent(itemId).nextEdit())
    }
    shown = nil
  }

  func go(to target: Int) {
    move(to: target, timedOut: false)
  }

  func timeOutQuestion() {
    move(to: position + 1, timedOut: true)
  }

  private func move(to target: Int, timedOut: Bool) {
    guard !pending, !timeUp, !(timedOut && moves.itemSeconds == nil) else { return }

    if timedOut, target == questions.count {
      if let question { leave(question.itemId) }
      questionTimeUp = true
      return
    }

    guard timedOut ? moves.canOpenAfterTimeout(target) : moves.canOpen(target) else { return }

    if let question, target != position {
      leave(question.itemId)
    }

    position = target
    reached = max(reached, target)
  }

  private func canAnswer(_ next: PracticeAnswer?) -> Bool {
    guard let question, !pending, !timeUp, moves.canChange(position) else { return false }
    countChange(question.itemId, at: position, to: next)
    return true
  }

  /// In a forward-only section's review, changing a left-behind answer uses one of its changes,
  /// once per question.
  private func countChange(_ itemId: String, at index: Int, to next: PracticeAnswer?) {
    guard moves.reviewing, moves.canChange(index), index < reached, !changed.contains(index),
      drafts[itemId]?.answer != next
    else {
      return
    }

    changed.append(index)
  }

  /// Runs a tap's step, which the run owns rather than the screen: a section handed in on purpose
  /// is handed in even if the mock closes meanwhile. ✕ waits for it, so only another place closing
  /// the mock can; its step timeouts still cancel it.
  func start(_ step: @escaping @MainActor () async -> Void) {
    taps.run(step)
  }

  func submitSection() async {
    let section = current?.section ?? 0
    await step(.submit) { api, token, blockId in
      try await api.submitSection(token: token, blockId: blockId, section: section)
    }
  }

  func finish() async {
    await step(.finish) { api, token, blockId in
      try await api.finish(token: token, blockId: blockId)
    }
  }

  func endBreak() async {
    await step(.endBreak) { api, token, blockId in
      try await api.endBreak(token: token, blockId: blockId)
      return nil
    }
  }

  func startSpeaking() async {
    await step(.startSpeaking, timeout: Self.paperTimeout) { [weak self] api, token, blockId in
      let started = try await api.startSpeaking(token: token, blockId: blockId) {
        self?.slow = false
        self?.isWritingPaper = true
      }

      guard started else {
        throw APIError.unavailable
      }

      return nil
    }

    isWritingPaper = false
  }

  /// False when no plays were left (another device used the last one). A play the server couldn't
  /// count keeps going.
  func play(setId: String) async -> Bool {
    guard let blockId = view?.blockId else { return true }

    let result = await store.write { api, token in
      try await api.recordPlay(token: token, blockId: blockId, setId: setId)
    }

    guard case .done(let played) = result else { return true }

    guard let played else { return false }

    mock.update { view in
      var view = view
      view.current?.plays.removeAll { $0.setId == setId }
      view.current?.plays.append(.init(played: played, setId: setId))
      return view
    }

    return true
  }

  func reload() async {
    await mock.refresh()
    if let view { adopt(view) }
  }

  private func step(
    _ kind: Step,
    timeout: Duration = stepTimeout,
    _ request: @escaping (ExamAPI, String, String) async throws -> MockStepOutcome?
  ) async {
    guard busy == nil, let blockId = view?.blockId else { return }
    let wasFinished = view?.status == .finished
    busy = kind
    failed = false

    if let question {
      leave(question.itemId)
    }

    saveText()
    let slowTask = Task { [weak self] in
      try? await Task.sleep(for: Self.slowAfter)
      if !Task.isCancelled, self?.isWritingPaper == false { self?.slow = true }
    }

    // Answers are saved first, then the step.
    let refusals = queue.refusals
    let result: MutationResult<MockStepOutcome?>? = await within(timeout) {
      [queue, store] in
      queue.retryNow()
      await queue.idle()
      guard !Task.isCancelled, queue.refusals == refusals else { return .failed(.unavailable) }
      return await store.write { api, token in try await request(api, token, blockId) }
    }

    slowTask.cancel()
    slow = false

    switch result {
    case .done(let outcome):
      if outcome == .finished {
        store.cache.invalidate([.goals, .learnerModel, .userProgress, .userSession])
      }

      await mock.refresh()
      busy = nil

      if let view {
        adopt(view)

        // An explicit hand-in grades the essays right away, while the objective result shows.
        if kind == .submit || kind == .finish, view.status == .finished, !wasFinished,
          view.hasPendingEssays
        {
          await gradeEssays()
        }
      }
    case .obsolete:
      busy = nil
    case .failed, nil:
      busy = nil
      failed = true
    }
  }

  func gradeEssays() async {
    guard essayGrading != .grading else { return }
    essayGrading = .grading

    let result: MutationResult<Void>? = await within(Self.gradingTimeout) { [store, blockId] in
      await store.write(invalidating: [.learnerModel]) { api, token in
        try await api.gradeEssays(token: token, blockId: blockId)
      }
    }

    switch result {
    case .done:
      await mock.refresh()
      essayGrading = .idle
    case .obsolete:
      essayGrading = .idle
    case .failed, nil:
      essayGrading = .failed
    }
  }

  /// Leaving waits a moment for answers still going out, so ✕ always leaves, even offline.
  func prepareToLeave() async {
    if let question {
      leave(question.itemId)
    }

    saveText()

    guard queue.isBusy else { return }
    queue.retryNow()
    _ = await within(Self.leaveWait) { [queue] in await queue.idle() }
  }

  private func persist(_ draft: MockDraft) {
    drafts[draft.itemId] = draft
    unsent.keep(draft, inPlace: queue.isWaiting(draft.itemId))
    queue.add(draft)
  }

  func stop() {
    textTask?.cancel()
    queue.stop()
  }

  private func saveText() {
    textTask?.cancel()
    textTask = nil

    if let draft = unsavedText {
      unsavedText = nil
      persist(draft)
    }
  }

  private func withTimeSpent(_ itemId: String) -> MockDraft {
    var draft = drafts[itemId] ?? .empty(itemId)
    let instant = ContinuousClock.now

    if let shown, shown.itemId == itemId {
      let afterDeadline = max(0, current.map { now().timeIntervalSince($0.deadline) } ?? 0)
      let elapsed = max(.zero, (instant - shown.at) - .seconds(afterDeadline))
      let elapsedMs =
        Int(elapsed.components.seconds * 1000)
        + Int(elapsed.components.attoseconds / 1_000_000_000_000_000)
      let limit = question?.format == .essay ? 24 * 60 * 60 * 1000 : 3_600_000
      draft.durationMs = min(draft.durationMs + elapsedMs, limit)
    }

    shown = (itemId, instant)
    return draft
  }

  static func hasExpiredFinalQuestion(_ view: MockView) -> Bool {
    guard let current = view.current, let last = current.questions.last,
      let seconds = view.currentSection?.navigation?.itemSeconds
    else {
      return false
    }

    let spent = current.drafts.first { $0.itemId == last.itemId }?.durationMs ?? 0
    return spent >= seconds * 1000
  }
}

/// Runs `operation`, giving up (nil) after `limit`; the operation is cancelled then.
@MainActor
func within<Value: Sendable>(
  _ limit: Duration, _ operation: @escaping @MainActor @Sendable () async -> Value
) async -> Value? {
  await withTaskGroup(of: Value?.self) { group in
    group.addTask { await operation() }
    group.addTask {
      try? await Task.sleep(for: limit)
      return nil
    }

    let first = await group.next() ?? nil
    group.cancelAll()
    return first
  }
}
