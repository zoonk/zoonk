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
        #"data: {"entityId":"lesson-1","status":"completed","step":"writeLesson"}"# + "\n\n"
          + #"data: {"status":"completed","step":"lessonReady"}"# + "\n\n"),
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
        GenerationEvent(status: "completed", step: "lessonReady"),
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

  func testAStoppedRunEndsItsStreamEvenWhenTheStreamStaysOpen() async throws {
    let transport = OpenStreamTransport(status: "failed")
    let clients = APIClientFactory(
      baseURL: try XCTUnwrap(URL(string: "https://api.zoonk.test")), transport: transport)
    let events = clients.generationEvents(
      id: "run-1", token: "learner-token", stopCheck: .milliseconds(10))

    let outcome = await outcome(of: events, within: .seconds(2))

    XCTAssertEqual(outcome, .stopped)
    let statusChecks = await transport.statusChecks
    XCTAssertEqual(statusChecks, 1)
  }

  func testARunStillWorkingKeepsItsStreamOpen() async throws {
    let transport = OpenStreamTransport(status: "running")
    let clients = APIClientFactory(
      baseURL: try XCTUnwrap(URL(string: "https://api.zoonk.test")), transport: transport)
    let events = clients.generationEvents(
      id: "run-1", token: "learner-token", stopCheck: .milliseconds(10))

    let outcome = await outcome(of: events, within: .milliseconds(300))

    XCTAssertEqual(outcome, .open)
    let statusChecks = await transport.statusChecks
    XCTAssertGreaterThan(statusChecks, 1)
  }

  func testFollowsTheRunAJoinNamesOnceTheJoiningRunsStreamEnds() async throws {
    let transport = RunsTransport(events: [
      "/v1/generations/run-1/events?startIndex=0": [
        #"data: {"entityId":"run-2","status":"started","step":"joinLevelTestBank"}"# + "\n\n"
      ],
      "/v1/generations/run-2/events?startIndex=0": [
        #"data: {"status":"started","step":"writeLevelTestBank"}"# + "\n\n"
          + #"data: {"status":"completed","step":"levelTestBankReady"}"# + "\n\n"
      ],
    ])

    let events = try await collect(clients(transport).generationEvents(id: "run-1", token: "t"))

    XCTAssertEqual(events.map(\.step), ["writeLevelTestBank", "levelTestBankReady"])
    let requests = await transport.requests
    XCTAssertEqual(
      requests,
      [
        "/v1/generations/run-1/events?startIndex=0",
        "/v1/generations/run-2/events?startIndex=0",
      ])
  }

  func testReopensAStreamThatClosedWhileItsRunStillWorks() async throws {
    let transport = RunsTransport(
      events: [
        "/v1/generations/run-1/events?startIndex=0": [
          #"data: {"status":"started","step":"writeTestOutQuestions"}"# + "\n\n"
        ],
        "/v1/generations/run-1/events?startIndex=1": [
          #"data: {"status":"completed","step":"testOutQuestionsReady"}"# + "\n\n"
        ],
      ],
      statuses: ["/v1/generations/run-1": ["running"]])

    let events = try await collect(clients(transport).generationEvents(id: "run-1", token: "t"))

    XCTAssertEqual(events.map(\.step), ["writeTestOutQuestions", "testOutQuestionsReady"])
    let requests = await transport.requests
    XCTAssertEqual(
      requests,
      [
        "/v1/generations/run-1/events?startIndex=0",
        "/v1/generations/run-1",
        "/v1/generations/run-1/events?startIndex=1",
      ])
  }

  func testReadsWhatIsLeftOfAStreamThatClosedJustBeforeItsRunEnded() async throws {
    let transport = RunsTransport(
      events: [
        "/v1/generations/run-1/events?startIndex=0": [
          #"data: {"status":"started","step":"writeMockQuestions"}"# + "\n\n"
        ],
        "/v1/generations/run-1/events?startIndex=1": [
          #"data: {"status":"completed","step":"mockQuestionsReady"}"# + "\n\n"
        ],
      ],
      statuses: ["/v1/generations/run-1": ["completed"]])

    let events = try await collect(clients(transport).generationEvents(id: "run-1", token: "t"))

    XCTAssertEqual(events.map(\.step), ["writeMockQuestions", "mockQuestionsReady"])
    let requests = await transport.requests
    XCTAssertEqual(
      requests,
      [
        "/v1/generations/run-1/events?startIndex=0",
        "/v1/generations/run-1",
        "/v1/generations/run-1/events?startIndex=1",
      ])
  }

  func testFollowsAJoinPastTheCloseWhenTheJoiningRunAlreadyEnded() async throws {
    let transport = RunsTransport(
      events: [
        "/v1/generations/run-1/events?startIndex=0": [
          "",
          #"data: {"entityId":"run-2","status":"started","step":"joinFocusTestQuestions"}"#
            + "\n\n",
        ],
        "/v1/generations/run-2/events?startIndex=0": [
          #"data: {"status":"completed","step":"focusTestQuestionsReady"}"# + "\n\n"
        ],
      ],
      statuses: ["/v1/generations/run-1": ["completed"]])

    let events = try await collect(clients(transport).generationEvents(id: "run-1", token: "t"))

    XCTAssertEqual(events.map(\.step), ["focusTestQuestionsReady"])
    let requests = await transport.requests
    XCTAssertEqual(
      requests,
      [
        "/v1/generations/run-1/events?startIndex=0",
        "/v1/generations/run-1",
        "/v1/generations/run-1/events?startIndex=0",
        "/v1/generations/run-2/events?startIndex=0",
      ])
  }

  func testARunsErrorEventStopsIt() async throws {
    let transport = RunsTransport(events: [
      "/v1/generations/run-1/events?startIndex=0": [
        #"data: {"status":"started","step":"writeChallengeQuestions"}"# + "\n\n"
          + #"data: {"reason":"aiGenerationFailed","status":"error","step":"workflowError"}"#
          + "\n\n"
      ]
    ])

    let events = try clients(transport).generationEvents(id: "run-1", token: "t")

    let outcome = await outcome(of: events, within: .seconds(2))
    XCTAssertEqual(outcome, .stopped)
  }

  func testAStreamThatClosedOnAFailedRunStopsIt() async throws {
    let transport = RunsTransport(
      events: [
        "/v1/generations/run-1/events?startIndex=0": [
          #"data: {"status":"started","step":"writeFocusTestQuestions"}"# + "\n\n"
        ]
      ],
      statuses: ["/v1/generations/run-1": ["failed"]])

    let events = try clients(transport).generationEvents(id: "run-1", token: "t")

    let outcome = await outcome(of: events, within: .seconds(2))
    XCTAssertEqual(outcome, .stopped)
  }

  private func clients(_ transport: some ClientTransport) throws -> APIClientFactory {
    APIClientFactory(
      baseURL: try XCTUnwrap(URL(string: "https://api.zoonk.test")), transport: transport)
  }

  private func collect(_ events: AsyncThrowingStream<GenerationEvent, Error>) async throws
    -> [GenerationEvent]
  {
    var collected: [GenerationEvent] = []
    for try await event in events {
      collected.append(event)
    }
    return collected
  }

  private enum Outcome {
    case finished
    case stopped
    case failed
    case open
  }

  /// `open` when `events` is still going at `limit`; it's cancelled then.
  private func outcome(
    of events: AsyncThrowingStream<GenerationEvent, Error>, within limit: Duration
  ) async -> Outcome {
    await withTaskGroup(of: Outcome.self) { group in
      group.addTask {
        do {
          for try await _ in events {}
          return Task.isCancelled ? .open : .finished
        } catch is GenerationStopped {
          return .stopped
        } catch {
          return Task.isCancelled ? .open : .failed
        }
      }
      group.addTask {
        try? await Task.sleep(for: limit)
        return .open
      }

      let first = await group.next() ?? .open
      group.cancelAll()
      return first
    }
  }

  func testFollowingAWritingLessonWaitsForTheRunItsReadinessNamesThenReadsItAgain() async throws {
    let transport = LessonWritingTransport(
      readiness: [
        #"{"alternative":null,"generationId":"run-1","setAside":false,"status":"generating"}"#,
        #"{"alternative":null,"generationId":null,"setAside":false,"status":"ready"}"#,
      ],
      events: #"data: {"status":"started","step":"writeLesson"}"# + "\n\n"
        + #"data: {"entityId":"lesson-1","status":"completed","step":"lessonReady"}"# + "\n\n")
    let api = LessonPlayerAPI(
      clients: APIClientFactory(
        baseURL: try XCTUnwrap(URL(string: "https://api.zoonk.test")), transport: transport))

    let lesson = try await api.followWriting(id: "lesson-1", run: nil, token: "learner-token")

    XCTAssertEqual(lesson.status, .ready)
    let requests = await transport.requests
    XCTAssertEqual(
      requests,
      [
        "/v1/library/lessons/lesson-1/readiness",
        "/v1/generations/run-1/events?startIndex=0",
        "/v1/library/lessons/lesson-1/readiness",
      ])
  }

  func testFollowingALessonItsChecksSetAsideSaysSoOnceItsRunEnds() async throws {
    let transport = LessonWritingTransport(
      readiness: [
        #"{"alternative":null,"generationId":"run-1","setAside":false,"status":"generating"}"#,
        #"{"alternative":null,"generationId":null,"setAside":true,"status":"failed"}"#,
      ],
      events: #"data: {"status":"started","step":"writeLesson"}"# + "\n\n"
        + #"data: {"status":"error","step":"workflowError"}"# + "\n\n")
    let api = LessonPlayerAPI(
      clients: APIClientFactory(
        baseURL: try XCTUnwrap(URL(string: "https://api.zoonk.test")), transport: transport))

    let lesson = try await api.followWriting(id: "lesson-1", run: nil, token: "learner-token")

    XCTAssertEqual(lesson.status, .failed)
    XCTAssertTrue(lesson.setAside)
  }
}

/// A run's events stream that never ends, as a run that stopped without closing it (vercel/workflow#964).
private actor OpenStreamTransport: ClientTransport {
  private let status: String
  private(set) var statusChecks = 0

  init(status: String) {
    self.status = status
  }

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var headerFields = HTTPFields()

    if operationID == "streamGenerationEvents" {
      headerFields[.contentType] = "text/event-stream"
      let stream = AsyncThrowingStream<ArraySlice<UInt8>, any Error> { continuation in
        continuation.yield(
          ArraySlice((#"data: {"status":"started","step":"writeLesson"}"# + "\n\n").utf8))
      }
      return (
        HTTPResponse(status: .ok, headerFields: headerFields),
        HTTPBody(stream, length: .unknown, iterationBehavior: .single)
      )
    }

    XCTAssertEqual(operationID, "getGeneration")
    statusChecks += 1
    headerFields[.contentType] = "application/json"
    return (
      HTTPResponse(status: .ok, headerFields: headerFields),
      HTTPBody(#"{"id":"run-1","status":"\#(status)"}"#)
    )
  }
}

/// Answers each request path with its responses in turn, repeating the last one.
private actor RunsTransport: ClientTransport {
  private var events: [String: [String]]
  private var statuses: [String: [String]]
  private(set) var requests: [String] = []

  init(events: [String: [String]], statuses: [String: [String]] = [:]) {
    self.events = events
    self.statuses = statuses
  }

  private static func next(_ responses: inout [String]?) -> String? {
    guard let first = responses?.first else { return nil }
    if responses?.count ?? 0 > 1 { responses?.removeFirst() }
    return first
  }

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    let path = baseURL.path() + (request.path ?? "")
    requests.append(path)
    var headerFields = HTTPFields()

    if operationID == "streamGenerationEvents" {
      headerFields[.contentType] = "text/event-stream"
      let text = Self.next(&events[path]) ?? ""
      return (HTTPResponse(status: .ok, headerFields: headerFields), HTTPBody(text))
    }

    XCTAssertEqual(operationID, "getGeneration")
    let status = Self.next(&statuses[path]) ?? "completed"
    headerFields[.contentType] = "application/json"
    return (
      HTTPResponse(status: .ok, headerFields: headerFields),
      HTTPBody(#"{"id":"run","status":"\#(status)"}"#)
    )
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
