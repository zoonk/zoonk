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

  func cancel() {
    for task in running.values {
      task.cancel()
    }
  }
}
