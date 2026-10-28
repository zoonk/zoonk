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

  init(goalId: String, store: PlanStore) {
    self.goalId = goalId
    self.store = store
  }

  @discardableResult
  func change(_ edits: [PlanEdit], sentence: String) async -> Bool {
    let goalId = goalId
    return await apply(sentence: sentence) { api, token in
      try await api.change(token: token, goalId: goalId, edits: edits)
    }
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

  func undo() async {
    guard !isSaving, case .applied(let change, _) = latest, change.canUndo else {
      return
    }

    isSaving = true
    failed = false
    defer { isSaving = false }

    let goalId = goalId
    let undone = await store.write { api, token in
      try await api.undo(token: token, goalId: goalId, changeId: change.id)
    } changed: {
      $0
    }

    switch undone {
    case .done(true): latest = .undone
    case .done(false), .failed: failed = true
    case .obsolete: break
    }
  }
}
