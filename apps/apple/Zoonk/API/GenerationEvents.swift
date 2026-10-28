import Foundation
import OpenAPIRuntime

/// One step update from a generation's event stream.
struct GenerationEvent: Decodable, Hashable, Sendable {
  /// When the step reported it.
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

extension APIClientFactory {
  /// Streams a generation's step updates from `GET /generations/{id}/events` until the run ends.
  /// A dropped connection resumes after the last event received, through the endpoint's
  /// `startIndex`; it gives up after three drops in a row without a new event. When the stream
  /// ends, read the generation's status: a run that stopped ends its stream at once.
  func generationEvents(
    id: String,
    token: String?
  ) -> AsyncThrowingStream<GenerationEvent, Error> {
    AsyncThrowingStream { continuation in
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
      }
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
