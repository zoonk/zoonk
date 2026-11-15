/// Work a page asked for and how it ended, held for the visit that asked. The page keeps it in
/// `@State` and calls `leave()` as it goes away (another tab, a page pushed over it, closing): the
/// work still out is cancelled, so it shows and opens nothing when it lands, and an outcome already
/// shown is gone on the next visit. A write the learner made still saves when it goes through
/// `LearnerSaves`; a store keeps only facts about the data, never how a page's request ended.
@MainActor
@Observable
final class VisitRequest<Outcome> {
  private(set) var isRunning = false
  /// How the last run ended, for as long as the visit that asked lasts; nil when it says nothing.
  var outcome: Outcome?
  @ObservationIgnored private var task: Task<Void, Never>?

  /// Starts `work` in place of a run still out. `work` returns what the page says of it, or nil;
  /// `then` gets the same once it lands, only while the visit lasts, for what follows it, such as
  /// opening a screen.
  func run(
    _ work: @escaping @MainActor () async -> Outcome?,
    then next: @escaping @MainActor (Outcome?) -> Void = { _ in }
  ) {
    task?.cancel()
    isRunning = true
    outcome = nil

    task = Task {
      let ended = await work()

      guard !Task.isCancelled else {
        return
      }

      isRunning = false
      outcome = ended
      next(ended)
    }
  }

  func leave() {
    task?.cancel()
    task = nil
    isRunning = false
    outcome = nil
  }
}
