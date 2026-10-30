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

enum GenerationStatus: Sendable {
  case working
  case completed
  /// Failed or cancelled: its content won't come without starting it again.
  case stopped
}

extension APIClientFactory {
  /// Resumes a dropped connection after the last event. When the stream ends, read the
  /// generation's status. A run that stopped may leave its stream open (vercel/workflow#964), so
  /// its status is read every `stopCheck` too, and a stopped run ends the stream.
  func generationEvents(
    id: String,
    token: String?,
    stopCheck: Duration = .seconds(120)
  ) -> AsyncThrowingStream<GenerationEvent, Error> {
    AsyncThrowingStream { continuation in
      let watch = Task {
        while (try? await Task.sleep(for: stopCheck)) != nil {
          if (try? await generationStatus(id: id, token: token)) == .stopped {
            continuation.finish()
            return
          }
        }
      }

      let task = Task {
        var received = 0
        var dropsWithoutEvents = 0

        while true {
          do {
            for try await event in try await openGenerationEvents(
              id: id, token: token, startIndex: received)
            {
              received += 1
              dropsWithoutEvents = 0
              continuation.yield(event)
            }

            continuation.finish()
            return
          } catch {
            let error = apiError(from: error)

            guard error as? APIError == .network, dropsWithoutEvents < 3 else {
              continuation.finish(throwing: error)
              return
            }

            dropsWithoutEvents += 1

            do {
              try await Task.sleep(for: .seconds(dropsWithoutEvents))
            } catch {
              continuation.finish(throwing: error)
              return
            }
          }
        }
      }

      continuation.onTermination = { _ in
        task.cancel()
        watch.cancel()
      }
    }
  }

  func generationStatus(id: String, token: String?) async throws -> GenerationStatus {
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
