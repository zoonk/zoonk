import Foundation
import Observation

@MainActor
@Observable
final class PlanEditor {
  enum Latest: Equatable {
    case applied(AppliedPlanChange, sentence: String)
    /// Saved without moving a lesson: what the learner asked is all there is to say.
    case saved(sentence: String)
    case invalid
    case undone
    case unchanged
  }

  private(set) var latest: Latest?
  private(set) var isSaving = false
  var failed = false

  private let goalId: String
  private let store: PlanStore
  @ObservationIgnored private let tasks = ScreenTasks()
  /// Whose date a statement names: the exam's or the goal's end date.
  let dateKind: GoalDateKind

  init(goalId: String, store: PlanStore, dateKind: GoalDateKind = .unknown) {
    self.goalId = goalId
    self.store = store
    self.dateKind = dateKind
  }

  /// Runs a tap's change for the editor's screen, which calls `cancel()` when it goes away. The
  /// store saves the change anyway; the screen gone, the editor shows nothing of it.
  func run(_ work: @escaping @MainActor () async -> Void) {
    tasks.run(work)
  }

  func cancel() {
    tasks.cancel()
  }

  /// What the plan says once the change is saved: each edit's statement, unless the caller has
  /// its own.
  @discardableResult
  func change(_ edits: [PlanEdit], sentence: String? = nil) async -> Bool {
    let goalId = goalId
    let operations = edits.compactMap { try? PracticeJSON.recode($0, as: PlanChangeOperation.self) }
    let sentence = sentence ?? PlanChangeWords.statements(operations, dateKind: dateKind)

    return await apply(sentence: sentence) { api, token in
      try await api.change(token: token, goalId: goalId, edits: edits)
    }
  }

  /// What `edits` would do, without saving; nil when it couldn't be read.
  func preview(_ edits: [PlanEdit]) async -> PlanChangePreview? {
    let goalId = goalId
    let result = await store.write { api, token in
      try await api.preview(token: token, goalId: goalId, edits: edits)
    } changed: { _ in
      false
    }

    guard case .done(let preview) = result else {
      return nil
    }

    return preview
  }

  @discardableResult
  func apply(
    sentence: String,
    _ request: @escaping (any PlanAPIClient, String) async throws -> PlanChangeOutcome
  ) async -> Bool {
    guard !isSaving else {
      return false
    }

    isSaving = true
    failed = false
    defer { isSaving = false }

    switch await store.change(request) {
    case .done(.applied(let change)):
      latest = .applied(change, sentence: sentence)
      return true
    case .done(.saved):
      latest = .saved(sentence: sentence)
      return true
    case .done(.invalid):
      latest = .invalid
    case .done(.unchanged):
      latest = .unchanged
    case .done(.undone):
      latest = .undone
      return true
    case .failed:
      failed = true
    case .obsolete:
      break
    }

    return false
  }

  @discardableResult
  func chooseExamOptions(_ subjects: [String], in group: String) async -> Bool {
    let goalId = goalId
    let choice = PlanChangeOperation(kind: "setExamChoice", group: group, subjects: subjects)

    return await apply(sentence: PlanChangeWords.statement(choice, dateKind: dateKind)) {
      api, token in
      try await api.chooseExamOption(token: token, goalId: goalId, group: group, subjects: subjects)
    }
  }

  func undo() async {
    guard !isSaving, case .applied(let change, _) = latest, change.canUndo else {
      return
    }

    isSaving = true
    failed = false
    defer { isSaving = false }

    switch await store.undo(goalId: goalId, changeId: change.id) {
    case .done(.some): latest = .undone
    case .done(nil), .failed: failed = true
    case .obsolete: break
    }
  }
}
