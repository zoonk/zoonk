import Foundation
import HTTPTypes
import OpenAPIRuntime
import Synchronization
import Testing

@testable import Zoonk

/// A run on our servers, against the stream every client reads (core's `code-run-events.json`).
struct CodeRunAPITests {
  private static let fixture: String = {
    let file = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .appending(
        path: "../../../packages/core/src/library/activities/programs/code-run-events.json")
    return try! JSONDecoder().decode(String.self, from: Data(contentsOf: file))
  }()

  private static let runID = "ec8eedd5-7adf-48aa-b686-ed38e40340b5"

  private func result(_ fields: String) -> String {
    #"event: result"# + "\n" + #"data: {"runId":"\#(Self.runID)",\#(fields)}"# + "\n\n"
  }

  private static let requestID = "afff9e26-a25b-4dba-adb3-18673729ab25"

  private func api(_ transport: CodeRunTransport) -> CodeRunAPI {
    CodeRunAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: transport),
      askAgainAfter: .milliseconds(1))
  }

  private func run(
    _ responses: [CodeRunResponse],
    keepWaiting: @escaping @MainActor @Sendable () -> Bool = {
      true
    }
  ) async throws -> (CodeRunOutcome, [CodeRunPhase], [CodeRunRequest]) {
    let transport = CodeRunTransport(responses)
    let phases = Mutex<[CodeRunPhase]>([])
    let request = CodeRuns.Request(
      code: "class Main {}", language: .java, id: Self.requestID,
      phase: { phase in phases.withLock { $0.append(phase) } }, keepWaiting: keepWaiting)

    let outcome = try await api(transport).run(request, token: "learner-token")
    return (outcome, phases.withLock { $0 }, await transport.requests)
  }

  @Test func theStreamReportsEachPhaseThenTheResultWithItsRun() async throws {
    let (outcome, phases, requests) = try await run([.events(Self.fixture)])

    #expect(phases == [.starting, .compiling, .running])
    #expect(outcome == .finished(CodeProgramRun(stop: .done, output: "hello\n", runID: Self.runID)))
    #expect(
      requests.map { [$0.code, $0.language, $0.requestId] }
        == [["class Main {}", "java", Self.requestID]])
  }

  @Test func aReplayBringsOnlyTheResult() async throws {
    let (outcome, phases, _) = try await run([
      .events(result(#""stop":"done","output":"42\n","errorOutput":"","error":null"#))
    ])

    #expect(phases.isEmpty)
    #expect(outcome == .finished(CodeProgramRun(stop: .done, output: "42\n", runID: Self.runID)))
  }

  @Test func eachStopReadsAsTheDeviceRunsDo() async throws {
    let compileError = result(
      #""stop":"error","output":"","errorOutput":"Main.java:3: error: ';' expected\n","error":{"line":3,"message":"';' expected"}"#
    )
    #expect(
      try await run([.events(compileError)]).0
        == .finished(
          CodeProgramRun(
            stop: .error, errorOutput: "Main.java:3: error: ';' expected\n",
            error: "';' expected", errorLine: 3, runID: Self.runID)))

    for stop in [CodeProgramRun.Stop.timeout, .tooMuchOutput] {
      let stopped = result(
        #""stop":"\#(stop.rawValue)","output":"x\n","errorOutput":"","error":null"#)
      #expect(
        try await run([.events(stopped)]).0
          == .finished(CodeProgramRun(stop: stop, output: "x\n", runID: Self.runID)))
    }

    let unavailable = result(#""stop":"unavailable","output":"","errorOutput":"","error":null"#)
    #expect(try await run([.events(unavailable)]).0 == .unavailable)
  }

  @Test func anUnknownPhaseIsSkippedAndAResultWithoutItsRunCantBeUsed() async throws {
    let (outcome, phases, _) = try await run([
      .events(
        #"event: phase"# + "\n" + #"data: {"phase":"linking"}"# + "\n\n" + #"event: result"#
          + "\n" + #"data: {"stop":"done"}"# + "\n\n")
    ])

    #expect(phases.isEmpty)
    #expect(outcome == .unavailable)
  }

  @Test func aStreamThatBreaksOffOrEndsBeforeItsResultIsOffline() async throws {
    let started = #"event: phase"# + "\n" + #"data: {"phase":"starting"}"# + "\n\n"

    await #expect(throws: APIError.network) { try await run([.drop(started)]) }
    await #expect(throws: APIError.network) { try await run([.events(started)]) }
    await #expect(throws: APIError.network) { try await run([.offline]) }
  }

  @Test func aRunStillGoingIsAskedForAgainUnderTheSameRequest() async throws {
    let (outcome, _, requests) = try await run([
      .status(409, "ALREADY_RUNNING"),
      .status(409, "ALREADY_RUNNING"),
      .events(result(#""stop":"done","output":"hi\n","errorOutput":"","error":null"#)),
    ])

    #expect(outcome == .finished(CodeProgramRun(stop: .done, output: "hi\n", runID: Self.runID)))
    #expect(requests.map(\.requestId) == Array(repeating: Self.requestID, count: 3))
  }

  @Test func askingStopsOnceNothingWaitsForTheRun() async throws {
    await #expect(throws: CancellationError.self) {
      try await run([.status(409, "ALREADY_RUNNING")], keepWaiting: { false })
    }
  }

  @Test func refusalsReadAsTheLimitTheyReached() async throws {
    let limit = { (tier: String) in
      #"{"limit":{"period":"day","resource":"aiUsage","tier":"\#(tier)"}}"#
    }

    #expect(
      try await run([.status(402, "USAGE_LIMIT_REACHED", details: limit("free"))]).0
        == .refused(.limitReached(period: .day, tier: .free)))
    #expect(
      try await run([.status(403, "USAGE_LIMIT_REACHED", details: limit("guest"))]).0
        == .refused(.limitReached(period: .day, tier: .guest)))
    #expect(
      try await run([.status(429, "USAGE_LIMIT_REACHED", details: limit("plus"))]).0
        == .refused(.limitReached(period: .day, tier: .plus)))
    #expect(try await run([.status(403, "SIGN_UP_REQUIRED")]).0 == .refused(.signUpRequired))

    let slowDown = try await run([
      .status(429, "SLOW_DOWN", details: #"{"retryAfterSeconds":20}"#)
    ]).0
    guard case .refused(.slowDown(let until)) = slowDown else {
      Issue.record("expected a short break, got \(slowDown)")
      return
    }
    #expect(until.timeIntervalSinceNow > 15)
  }

  @Test func aRequestTheServerCantTakeIsUnavailableAndAnEndedSessionThrows() async throws {
    #expect(try await run([.status(400, "VALIDATION_ERROR")]).0 == .unavailable)
    #expect(try await run([.status(500, "INTERNAL_ERROR")]).0 == .unavailable)
    await #expect(throws: APIError.unauthorized) {
      try await run([.status(401, "UNAUTHORIZED")])
    }
  }

  @Test func theAnswerNamesTheRunWhoseOutputTheServerGrades() throws {
    #expect(
      ActivityAnswer.output("hi\n", runID: Self.runID).value
        == .object([
          "kind": .string("output"), "output": .string("hi\n"), "runId": .string(Self.runID),
        ]))
    #expect(
      ActivityAnswer.output("hi\n").value
        == .object(["kind": .string("output"), "output": .string("hi\n")]))
  }

  @Test func everyLanguageNamesItsFileAndRunsWhereCoreRunsIt() throws {
    let registry = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .appending(
        path: "../../../packages/core/src/library/activities/programs/program-languages.ts")
    let source = try String(contentsOf: registry, encoding: .utf8)
    let entries = source.matches(
      of: #/  (\w+): \{[\s\S]*?fileName: "([^"]+)",\s*name: "([^"]+)",\s*runs: "(\w+)"/#)

    #expect(entries.count == 12)

    for entry in entries {
      let language = try #require(CodeLanguage(rawValue: String(entry.1)))
      #expect(language.defaultFileName == entry.2)
      #expect(language.runtimeName == entry.3)
      #expect(language.runsOnDevice == (entry.4 == "device"))
    }
  }
}

struct CodeRunRequest: Decodable, Sendable {
  let code: String
  let language: String
  let requestId: String
}

enum CodeRunResponse: Sendable {
  case events(String)
  /// The stream sends this, then the connection drops.
  case drop(String)
  case status(Int, String, details: String? = nil)
  case offline
}

/// Answers each run with the next response, repeating the last one.
private actor CodeRunTransport: ClientTransport {
  private var responses: [CodeRunResponse]
  private(set) var requests: [CodeRunRequest] = []

  init(_ responses: [CodeRunResponse]) {
    self.responses = responses
  }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    #expect(operationID == "runCode")
    #expect(request.method == .post)
    #expect(baseURL.path() + (request.path ?? "") == "/v1/code-runs")
    let data = try await Data(collecting: try #require(body), upTo: 1 << 20)
    requests.append(try JSONDecoder().decode(CodeRunRequest.self, from: data))

    let response = responses.count > 1 ? responses.removeFirst() : responses[0]
    var headerFields = HTTPFields()

    switch response {
    case .events(let text):
      headerFields[.contentType] = "text/event-stream"
      return (HTTPResponse(status: .ok, headerFields: headerFields), HTTPBody(text))
    case .drop(let text):
      headerFields[.contentType] = "text/event-stream"
      let stream = AsyncThrowingStream<ArraySlice<UInt8>, any Error> { continuation in
        continuation.yield(ArraySlice(text.utf8))
        continuation.finish(throwing: URLError(.networkConnectionLost))
      }
      return (
        HTTPResponse(status: .ok, headerFields: headerFields),
        HTTPBody(stream, length: .unknown, iterationBehavior: .single)
      )
    case .status(let status, let code, let details):
      headerFields[.contentType] = "application/json"
      let detailsField = details.map { #","details":\#($0)"# } ?? ""
      return (
        HTTPResponse(status: .init(code: status), headerFields: headerFields),
        HTTPBody(#"{"error":{"code":"\#(code)","message":"Refused"\#(detailsField)}}"#)
      )
    case .offline:
      throw URLError(.notConnectedToInternet)
    }
  }
}
