import Foundation
import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class GenerationEventsTests: XCTestCase {
  func testStreamDecodesStepUpdatesAndResumesAfterADroppedConnection() async throws {
    let transport = GenerationEventsTransport(responses: [
      .drop(after: #"data: {"at":1760000000000,"status":"started","step":"writeLesson"}"# + "\n\n"),
      .events(
        #"data: {"entityId":"lesson-1","status":"completed","step":"writeLesson"}"# + "\n\n"),
    ])
    let clients = APIClientFactory(
      baseURL: try XCTUnwrap(URL(string: "https://api.zoonk.test")),
      transport: transport)

    var events: [GenerationEvent] = []
    for try await event in clients.generationEvents(id: "run-1", token: "learner-token") {
      events.append(event)
    }

    XCTAssertEqual(
      events,
      [
        GenerationEvent(
          at: Date(timeIntervalSince1970: 1_760_000_000), status: "started", step: "writeLesson"),
        GenerationEvent(entityID: "lesson-1", status: "completed", step: "writeLesson"),
      ])
    let requests = await transport.requests
    XCTAssertEqual(
      requests,
      [
        "/v1/generations/run-1/events?startIndex=0",
        "/v1/generations/run-1/events?startIndex=1",
      ])
  }

  func testMissingGenerationEndsTheStreamWithNotFound() async throws {
    let transport = GenerationEventsTransport(responses: [.notFound])
    let clients = APIClientFactory(
      baseURL: try XCTUnwrap(URL(string: "https://api.zoonk.test")),
      transport: transport)

    do {
      for try await _ in clients.generationEvents(id: "missing", token: nil) {}
      XCTFail("Expected the stream to fail")
    } catch {
      XCTAssertEqual(error as? APIError, .notFound)
    }
  }

  func testFollowingAWritingLessonWaitsForTheRunItsReadinessNamesThenReadsItAgain() async throws {
    let transport = LessonWritingTransport(
      readiness: [
        #"{"alternative":null,"generationId":"run-1","status":"generating"}"#,
        #"{"alternative":null,"generationId":null,"status":"ready"}"#,
      ],
      events: #"data: {"status":"started","step":"writeLesson"}"# + "\n\n"
        + #"data: {"entityId":"lesson-1","status":"completed","step":"lessonReady"}"# + "\n\n")
    let api = LessonPlayerAPI(
      clients: APIClientFactory(
        baseURL: try XCTUnwrap(URL(string: "https://api.zoonk.test")), transport: transport))

    let status = try await api.followWriting(id: "lesson-1", run: nil, token: "learner-token")

    XCTAssertEqual(status, .ready)
    let requests = await transport.requests
    XCTAssertEqual(
      requests,
      [
        "/v1/library/lessons/lesson-1/readiness",
        "/v1/generations/run-1/events?startIndex=0",
        "/v1/library/lessons/lesson-1/readiness",
      ])
  }
}

private actor LessonWritingTransport: ClientTransport {
  private var readiness: [String]
  private let events: String
  private(set) var requests: [String] = []

  init(readiness: [String], events: String) {
    self.readiness = readiness
    self.events = events
  }

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    requests.append(baseURL.path() + (request.path ?? ""))
    var headerFields = HTTPFields()

    if operationID == "streamGenerationEvents" {
      headerFields[.contentType] = "text/event-stream"
      return (HTTPResponse(status: .ok, headerFields: headerFields), HTTPBody(events))
    }

    headerFields[.contentType] = "application/json"
    let body = HTTPBody(readiness.removeFirst())
    return (HTTPResponse(status: .ok, headerFields: headerFields), body)
  }
}

private enum GenerationEventsResponse: Sendable {
  case drop(after: String)
  case events(String)
  case notFound
}

private actor GenerationEventsTransport: ClientTransport {
  private var responses: [GenerationEventsResponse]
  private(set) var requests: [String] = []

  init(responses: [GenerationEventsResponse]) {
    self.responses = responses
  }

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTAssertEqual(operationID, "streamGenerationEvents")
    requests.append(baseURL.path() + (request.path ?? ""))
    var headerFields = HTTPFields()
    headerFields[.contentType] = "text/event-stream"

    switch responses.removeFirst() {
    case .events(let text):
      return (HTTPResponse(status: .ok, headerFields: headerFields), HTTPBody(text))
    case .drop(let text):
      let stream = AsyncThrowingStream<ArraySlice<UInt8>, any Error> { continuation in
        continuation.yield(ArraySlice(text.utf8))
        continuation.finish(throwing: URLError(.networkConnectionLost))
      }
      return (
        HTTPResponse(status: .ok, headerFields: headerFields),
        HTTPBody(stream, length: .unknown, iterationBehavior: .single)
      )
    case .notFound:
      headerFields[.contentType] = "application/json"
      return (
        HTTPResponse(status: .notFound, headerFields: headerFields),
        HTTPBody(#"{"error":{"code":"notFound","message":"Generation not found"}}"#)
      )
    }
  }
}
