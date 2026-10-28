import Foundation
import Observation

/// One place that changes the plan ("Adjust plan", a sheet, the Plan's slot): it saves one change at
/// a time, says what the latest one did, and undoes it while it's still the plan's latest. Each
/// saved change re-plans from today, so the plan, Today and the summary revalidate.
@MainActor
@Observable
final class PlanEditor {
  /// What the latest change came to, shown until the next one.
  enum Latest: Equatable {
    /// Saved: what it did, in the sentence the control that made it says.
    case applied(AppliedPlanChange, sentence: String)
    /// The API refused it, such as a date the plan can't reach.
    case invalid
    case undone
    /// Nothing changed: the plan already works that way.
    case unchanged
  }

  private(set) var latest: Latest?
  private(set) var isSaving = false
  /// The latest request didn't reach the server.
  var failed = false

  private let goalId: String
  private let store: PlanStore

  init(goalId: String, store: PlanStore) {
    self.goalId = goalId
    self.store = store
  }

  /// Saves edits from "Adjust plan" or a sheet.
  @discardableResult
  func change(_ edits: [PlanEdit], sentence: String) async -> Bool {
    let goalId = goalId
    return await apply(sentence: sentence) { api, token in
      try await api.change(token: token, goalId: goalId, edits: edits)
    }
  }

  /// Saves any of the plan's choices (an exam option, a tool), which answer like a change.
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

    let outcome = await store.write(request) { outcome in
      if case .applied = outcome {
        return true
      }

      return false
    }

    switch outcome {
    case .done(.applied(let change)):
      latest = .applied(change, sentence: sentence)
      return true
    case .done(.invalid):
      latest = .invalid
    case .done(.unchanged):
      latest = .unchanged
    case .failed:
      failed = true
    case .obsolete:
      break
    }

    return false
  }

  /// Undoes the latest change; the plan goes back as it was.
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
