import Foundation
import Observation
import SwiftUI

/// A started mock from the learner's side: answering and flagging (saved as drafts as they go),
/// moving through the section, handing it in (the clock only closes the answers) and its result.
/// Every step reads the mock again, so the screen always matches what's stored.
@MainActor
@Observable
final class MockRun {
  /// A step of the mock the learner waits on.
  enum Step: Equatable {
    case submit
    case finish
    case endBreak
    case startSpeaking
  }

  /// Where grading the finished mock's essays stands.
  enum EssayGrading: Equatable {
    case idle
    case grading
    case failed
    case limitReached
  }

  /// Handing in and scoring are a second or two of database work: past 10 s the screen says it's
  /// still at it, past 45 s it stops waiting and offers to try again (a handed-in section stays in).
  private static let slowAfter = Duration.seconds(10)
  private static let stepTimeout = Duration.seconds(45)
  /// Essays take 10 to 25 s each to grade, at once for a mock's few.
  private static let gradingTimeout = Duration.seconds(120)
  /// Typing is saved this long after the learner stops, and whenever they leave the question.
  private static let textSaveDelay = Duration.milliseconds(1500)
  /// Leaving waits this long at most for answers still going out.
  private static let leaveWait = Duration.seconds(5)

  let mock: Resource<MockView>
  let queue: MockDraftQueue

  private(set) var drafts: [String: MockDraft] = [:]
  private(set) var position = 0
  private(set) var busy: Step?
  /// The last step didn't go through.
  private(set) var failed = false
  /// The step on its way is taking longer than usual.
  private(set) var slow = false
  private(set) var essayGrading: EssayGrading = .idle
  /// The section's clock ran out: answers close until the learner hands it in.
  var sectionTimeUp = false

  /// The furthest question opened and the questions the review changed, in the running section.
  private var reached = 0
  private var changed: [Int] = []
  /// The last question's own clock ran out.
  private var questionTimeUp = false

  @ObservationIgnored private let store: ExamStore
  @ObservationIgnored private var adopted: String?
  @ObservationIgnored private var shown: (itemId: String, at: ContinuousClock.Instant)?
  @ObservationIgnored private var unsavedText: MockDraft?
  @ObservationIgnored private var textTask: Task<Void, Never>?

  init(store: ExamStore, blockId: String) {
    self.store = store
    let mock = store.mock(blockId: blockId)
    self.mock = mock
    queue = MockDraftQueue { [store] draft in
      switch await store.write({ api, token in
        try await api.saveAnswer(token: token, blockId: blockId, draft: draft)
      }) {
      case .done(true): .stored
      case .done(false), .obsolete: .refused
      case .failed: .unreachable
      }
    }
  }

  var view: MockView? { mock.value }
  var current: MockCurrent? { view?.current }
  var questions: [MockQuestion] { current?.questions ?? [] }

  var question: MockQuestion? {
    questions.indices.contains(position) ? questions[position] : nil
  }

  var timeUp: Bool { sectionTimeUp || questionTimeUp }
  var pending: Bool { busy != nil }

  var moves: MockSectionMoves {
    MockSectionMoves(
      answered: question.map { drafts[$0.itemId]?.isAnswered ?? false } ?? false,
      changed: changed, changesLeft: current?.changesLeft,
      navigation: view?.currentSection?.navigation, position: position, reached: reached,
      total: questions.count)
  }

  /// Takes the mock as it now stands: a new section (or a first read) starts its sheet over from
  /// the saved drafts, at the question it resumes on.
  func adopt(_ view: MockView) {
    let key = "\(view.status.rawValue):\(view.current?.section ?? -1)"

    guard key != adopted else {
      return
    }

    adopted = key
    shown = nil
    drafts = Dictionary(
      (view.current?.drafts ?? []).map { ($0.itemId, $0) }, uniquingKeysWith: { _, last in last })
    position = view.current?.resume ?? 0
    reached = position
    changed = []
    questionTimeUp = Self.hasExpiredFinalQuestion(view)
    sectionTimeUp = view.current.map { $0.deadline <= .now } ?? false
  }

  // MARK: Answers

  /// The current question's answer as its control edits it: a pick saves at once; text and
  /// numbers save once typing pauses.
  func answerBinding(for question: MockQuestion) -> Binding<PracticeAnswer?> {
    Binding(
      get: { [weak self] in self?.drafts[question.itemId]?.answer },
      set: { [weak self] answer in
        switch question.format {
        case .typed, .numeric, .essay: self?.write(answer)
        case .multipleChoice, .trueFalse: self?.answer(answer)
        }
      })
  }

  func answer(_ answer: PracticeAnswer?) {
    guard let question, canAnswer(answer) else { return }
    var draft = withTimeSpent(question.itemId)
    draft.answer = answer
    persist(draft)
  }

  func write(_ answer: PracticeAnswer?) {
    guard let question, canAnswer(answer) else { return }
    var draft = drafts[question.itemId] ?? .empty(question.itemId)
    draft.answer = answer
    drafts[question.itemId] = draft
    unsavedText = draft
    textTask?.cancel()
    textTask = Task { [weak self] in
      try? await Task.sleep(for: Self.textSaveDelay)
      guard !Task.isCancelled else { return }
      self?.saveText()
    }
  }

  func toggleFlag() {
    guard let question, !timeUp else { return }
    unsavedText = nil
    saveText()
    var draft = withTimeSpent(question.itemId)
    draft.flagged.toggle()
    persist(draft)
  }

  /// A question appears: its clock starts, and in a forward-only section it's saved as reached at
  /// once, so the ones before it stay behind the learner.
  func show(_ itemId: String) {
    shown = (itemId, .now)

    if moves.forwardOnly, drafts[itemId] == nil {
      persist(.empty(itemId))
    }
  }

  /// A question leaves the screen: its time so far (and what was typed) is saved with it.
  func leave(_ itemId: String) {
    guard shown?.itemId == itemId else { return }
    unsavedText = nil
    saveText()
    persist(withTimeSpent(itemId))
    shown = nil
  }

  // MARK: Moving

  func go(to target: Int) {
    move(to: target, timedOut: false)
  }

  /// The current question's clock ran out: on to the next one, answered or not.
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

  /// Whether the current question's answer may become this one. In a forward-only section's
  /// review, changing a left-behind answer uses one of its changes, once per question.
  private func canAnswer(_ next: PracticeAnswer?) -> Bool {
    guard let question, !timeUp, moves.canChange(position) else { return false }
    let saved = drafts[question.itemId]?.answer

    if moves.reviewing, position < reached, saved != next, !changed.contains(position) {
      changed.append(position)
    }

    return true
  }

  // MARK: Steps

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

  /// Starts the running speaking section: its paper's task cards are written now.
  func startSpeaking() async {
    await step(.startSpeaking) { api, token, blockId in
      _ = try await api.startSpeaking(token: token, blockId: blockId)
      return nil
    }
  }

  /// Counts a play of a listening section's recording as it starts: false when the mock had none
  /// left for it (another device used the last one), so it stops. A play the server couldn't count
  /// keeps going.
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

  /// Reads the mock again (a speaking task's call came back, or a stale sitting).
  func reload() async {
    await mock.refresh()
    if let view { adopt(view) }
  }

  private func step(
    _ kind: Step,
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
      if !Task.isCancelled { self?.slow = true }
    }

    // Answers are saved first, then the step; a step that fails or takes too long says so.
    let result: MutationResult<MockStepOutcome?>? = await within(Self.stepTimeout) {
      [queue, store] in
      await queue.idle()
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

  /// Grades the finished mock's essays: right after hand-in, or again from the result.
  func gradeEssays() async {
    guard essayGrading != .grading, let blockId = view?.blockId else { return }
    essayGrading = .grading

    let result: MutationResult<Bool>? = await within(Self.gradingTimeout) { [store] in
      await store.write(invalidating: [.learnerModel]) { api, token in
        try await api.gradeEssays(token: token, blockId: blockId)
      }
    }

    switch result {
    case .done(let allGraded):
      await mock.refresh()
      essayGrading = allGraded ? .idle : .limitReached
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

  // MARK: Drafts

  private func persist(_ draft: MockDraft) {
    drafts[draft.itemId] = draft
    queue.add(draft)
  }

  private func saveText() {
    textTask?.cancel()
    textTask = nil

    if let draft = unsavedText {
      unsavedText = nil
      persist(draft)
    }
  }

  /// The question's draft with the time since it appeared added.
  private func withTimeSpent(_ itemId: String) -> MockDraft {
    var draft = drafts[itemId] ?? .empty(itemId)
    let now = ContinuousClock.now

    if let shown, shown.itemId == itemId {
      let elapsed = now - shown.at
      draft.durationMs +=
        Int(elapsed.components.seconds * 1000)
        + Int(elapsed.components.attoseconds / 1_000_000_000_000_000)
    }

    shown = (itemId, now)
    return draft
  }

  /// A resumed final question whose saved time already used its clock stays closed.
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
