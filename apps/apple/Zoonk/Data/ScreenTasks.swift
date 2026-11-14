/// The writes a screen starts from several controls or views, canceled together when it goes
/// away: a canceled write comes back `.obsolete` from `mutate`, so it shows and starts nothing.
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
