/// The writes started from several controls or views, held by their owner, which can cancel them
/// together: a screen, when it goes away. A canceled write comes back `.obsolete`, so it shows and
/// starts nothing; a change the learner made still saves when it goes through `LearnerSaves`.
@MainActor
final class ScreenTasks {
  private var running: [Int: Task<Void, Never>] = [:]
  private var lastID = 0

  func run(_ work: @escaping @MainActor () async -> Void) {
    lastID += 1
    let id = lastID

    running[id] = Task {
      await work()
      running[id] = nil
    }
  }

  /// A write the learner's tap sent, then what its answer leads to. The write isn't the screen's:
  /// it finishes whatever happens to the screen, so what the server saved is never lost or sent
  /// twice. What it leads to is, and a screen that went away meanwhile goes nowhere.
  func send<Value: Sendable>(
    _ write: @escaping @MainActor () async throws -> Value,
    then next: @escaping @MainActor (Value) -> Void,
    failed: @escaping @MainActor (any Error) -> Void = { _ in },
    ended: @escaping @MainActor () -> Void = {}
  ) {
    let sent = Task { try await write() }

    run {
      defer { ended() }

      do {
        let value = try await sent.value
        try await goOnUnlessLeft { next(value) }
      } catch is CancellationError {
      } catch {
        failed(error)
      }
    }
  }

  func cancel() {
    for task in running.values {
      task.cancel()
    }
  }
}

/// What a screen's work leads to once it's done, such as a step's way on to the next. A write can
/// finish for a caller that's gone, so a screen that went away meanwhile (its task canceled) goes
/// nowhere: Back during a step's last answer stays where the learner went.
@MainActor
func goOnUnlessLeft(_ next: () async throws -> Void) async throws {
  try Task.checkCancellation()
  try await next()
}
