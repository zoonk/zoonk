import Foundation
import OpenAPIRuntime

struct GenerationEvent: Decodable, Hashable, Sendable {
  let at: Date?
  let entityID: String?
  let reason: String?
  let status: String
  let step: String

  private enum CodingKeys: String, CodingKey {
    case at
    case entityID = "entityId"
    case reason
    case status
    case step
  }

  init(
    at: Date? = nil, entityID: String? = nil, reason: String? = nil, status: String, step: String
  ) {
    self.at = at
    self.entityID = entityID
    self.reason = reason
    self.status = status
    self.step = step
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    at = try container.decodeIfPresent(Int.self, forKey: .at).map(dateFromEpochMilliseconds)
    entityID = try container.decodeIfPresent(String.self, forKey: .entityID)
    reason = try container.decodeIfPresent(String.self, forKey: .reason)
    status = try container.decode(String.self, forKey: .status)
    step = try container.decode(String.self, forKey: .step)
  }
}

private enum GenerationStatus: Sendable {
  case working
  case completed
  /// Failed or cancelled: its content won't come without starting it again.
  case stopped
}

/// The run reported an error, or reads failed or cancelled.
struct GenerationStopped: Error {}

extension APIClientFactory {
  /// A run's stream ends with its last event: one of these when it's ready, an error, or a join
  /// naming the run already doing the same work.
  private static let readySteps: Set<String> = [
    "challengeQuestionsReady", "explanationReady", "focusTestQuestionsReady", "goalReady",
    "lessonReady", "levelTestBankReady", "mockQuestionsReady", "testOutQuestionsReady",
    "understandingReady",
  ]

  private static let joinSteps: Set<String> = [
    "joinChallengeQuestions", "joinFocusTestQuestions", "joinLevelTestBank", "joinMockQuestions",
    "joinRunningExplanation", "joinRunningGoal", "joinRunningLesson", "joinRunningUnderstanding",
    "joinTestOutQuestions",
  ]

  private enum StreamEnd {
    case ready
    case stopped
    case joined(String)
    /// Without its last event, as when a function times out: the run's status says what's next.
    case closed(GenerationStatus)
  }

  /// Follows a run to its end, so a closed stream never reads as a failure while the run works:
  /// it finishes after the ready event, throws `GenerationStopped` on an error, and moves to the
  /// run a join names. A stream that closes without its last event reopens after the last event
  /// received: after a moment while the run works, and once more at once after it ended, for the
  /// events it wrote just before. A dropped connection resumes the same way. A run that stops
  /// without saying so may leave its stream open (vercel/workflow#964), so its status is read
  /// every `stopCheck` too.
  func generationEvents(
    id: String,
    token: String?,
    stopCheck: Duration = .seconds(120)
  ) -> AsyncThrowingStream<GenerationEvent, Error> {
    AsyncThrowingStream { continuation in
      let task = Task {
        do {
          try await follow(id, token: token, stopCheck: stopCheck, continuation)
          continuation.finish()
        } catch {
          continuation.finish(throwing: error)
        }
      }

      continuation.onTermination = { _ in task.cancel() }
    }
  }

  private func follow(
    _ id: String,
    token: String?,
    stopCheck: Duration,
    _ continuation: AsyncThrowingStream<GenerationEvent, Error>.Continuation
  ) async throws {
    var run = id
    var received = 0
    var dropsWithoutEvents = 0
    /// Once a status read the run ended, the next connection reads its stream to the end.
    var runEnded = false
    var watch = watchForStop(of: run, token: token, every: stopCheck, continuation)
    defer { watch.cancel() }

    while true {
      let before = received
      let end: StreamEnd

      do {
        end = try await read(run, token: token, received: &received, continuation)
      } catch {
        let error = apiError(from: error)

        if received > before {
          dropsWithoutEvents = 0
        }

        guard error as? APIError == .network, dropsWithoutEvents < 3 else {
          throw error
        }

        dropsWithoutEvents += 1
        try await Task.sleep(for: .seconds(dropsWithoutEvents))
        continue
      }

      dropsWithoutEvents = 0

      switch end {
      case .ready:
        return
      case .stopped:
        throw GenerationStopped()
      case .closed(.completed) where runEnded:
        return
      case .closed(.stopped) where runEnded:
        throw GenerationStopped()
      case .joined(let joined):
        run = joined
        received = 0
        runEnded = false
        watch.cancel()
        watch = watchForStop(of: run, token: token, every: stopCheck, continuation)
      case .closed(.working):
        try await Task.sleep(for: .milliseconds(1500))
      case .closed:
        runEnded = true
      }
    }
  }

  /// One connection to `run`'s stream, from the events already `received` on.
  private func read(
    _ run: String,
    token: String?,
    received: inout Int,
    _ continuation: AsyncThrowingStream<GenerationEvent, Error>.Continuation
  ) async throws -> StreamEnd {
    for try await event in try await openGenerationEvents(
      id: run, token: token, startIndex: received)
    {
      received += 1

      if event.status == "error" || event.step == "workflowError" {
        return .stopped
      }

      if Self.joinSteps.contains(event.step), let joined = event.entityID, joined != run {
        return .joined(joined)
      }

      continuation.yield(event)

      if Self.readySteps.contains(event.step), event.status == "completed" {
        return .ready
      }
    }

    // A cancelled iteration ends like a closed stream.
    try Task.checkCancellation()
    return .closed(try await generationStatus(id: run, token: token))
  }

  private func watchForStop(
    of run: String,
    token: String?,
    every interval: Duration,
    _ continuation: AsyncThrowingStream<GenerationEvent, Error>.Continuation
  ) -> Task<Void, Never> {
    Task {
      while (try? await Task.sleep(for: interval)) != nil {
        if (try? await generationStatus(id: run, token: token)) == .stopped {
          continuation.finish(throwing: GenerationStopped())
          return
        }
      }
    }
  }

  private func generationStatus(id: String, token: String?) async throws -> GenerationStatus {
    let output = try await perform(token: token) { client in
      try await client.getGeneration(path: .init(generationId: id))
    }

    switch output {
    case .ok(let response):
      switch try response.body.json.status {
      case .pending, .running: return .working
      case .completed: return .completed
      case .failed, .cancelled: return .stopped
      }
    case .notFound:
      throw APIError.notFound
    default:
      throw APIError.unavailable
    }
  }

  private func openGenerationEvents(
    id: String,
    token: String?,
    startIndex: Int
  ) async throws -> some AsyncSequence<GenerationEvent, any Error> {
    let output = try await makeStreamingClient(token: token).streamGenerationEvents(
      path: .init(generationId: id),
      query: .init(startIndex: startIndex))

    switch output {
    case .ok(let response):
      return try response.body.textEventStream
        .asDecodedServerSentEventsWithJSONData(of: GenerationEvent.self)
        .compactMap { $0.data }
    case .notFound:
      throw APIError.notFound
    case .badRequest, .internalServerError, .undocumented:
      throw APIError.unavailable
    }
  }
}
