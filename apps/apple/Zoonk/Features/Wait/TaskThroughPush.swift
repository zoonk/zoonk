import SwiftUI

extension View {
  /// `.task(id:)` for work a wait follows: pushing the wait's progress takes this page off screen,
  /// which cancels a `.task`, so the progress would stop updating while the learner watches it. This
  /// one runs until `id` changes or the view goes away for good.
  func taskThroughPush<ID: Equatable>(
    id: ID, _ work: @escaping @MainActor () async -> Void
  ) -> some View {
    modifier(TaskThroughPush(id: id, work: work))
  }
}

private struct TaskThroughPush<ID: Equatable>: ViewModifier {
  let id: ID
  let work: @MainActor () async -> Void

  @State private var running = RunningWork<ID>()

  func body(content: Content) -> some View {
    content
      .onChange(of: id, initial: true) { _, id in
        running.start(id: id, work)
      }
  }
}

/// Lives as long as the view's state: its deinit is the view going away.
private final class RunningWork<ID: Equatable> {
  private var id: ID?
  private var task: Task<Void, Never>?

  @MainActor
  func start(id: ID, _ work: @escaping @MainActor () async -> Void) {
    // Coming back on screen with the same work keeps it going.
    guard self.id != id || task == nil else {
      return
    }

    self.id = id
    task?.cancel()
    task = Task { await work() }
  }

  deinit {
    task?.cancel()
  }
}
