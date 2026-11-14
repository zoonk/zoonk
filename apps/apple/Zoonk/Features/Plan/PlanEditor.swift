import Foundation
import Observation

@MainActor
@Observable
final class PlanEditor {
  enum Latest: Equatable {
    case applied(AppliedPlanChange, sentence: String)
    case invalid
    case undone
    case unchanged
  }

  private(set) var latest: Latest?
  private(set) var isSaving = false
  var failed = false

  private let goalId: String
  private let store: PlanStore
  /// Whose date a statement names: the exam's or the goal's end date.
  let dateKind: GoalDateKind

  init(goalId: String, store: PlanStore, dateKind: GoalDateKind = .unknown) {
    self.goalId = goalId
    self.store = store
    self.dateKind = dateKind
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

    let goalId = goalId
    let undone = await store.write { api, token in
      try await api.decide(
        token: token, goalId: goalId, changeId: change.id, decision: .undone)
    } changed: {
      $0 != nil
    }

    switch undone {
    case .done(.some): latest = .undone
    case .done(nil), .failed: failed = true
    case .obsolete: break
    }
  }
}
