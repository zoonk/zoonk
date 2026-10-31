import Foundation
import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

@MainActor
final class ContentWritingTests: XCTestCase {
  func testACallNotWrittenYetStartsOnceTheRunWritingItEnds() async throws {
    let transport = ContentWritingTransport(
      starts: [.writing("run-1"), .created("call-1")],
      events: [
        "run-1": #"data: {"entityId":"run-2","status":"started","step":"joinRunningCall"}"#,
        "run-2": #"data: {"status":"completed","step":"callReady"}"#,
      ])
    var waits = 0

    let started = try await LiveCallAPI(clients: clients(transport)).startOnceWritten(
      Self.checkpoint, token: "learner-token"
    ) {
      waits += 1
    }

    guard case .done("call-1") = started else {
      return XCTFail("the call opens once it's written")
    }

    XCTAssertEqual(waits, 1)
    let requests = await transport.requests
    XCTAssertEqual(
      requests,
      [
        "startLanguageConversation", "streamGenerationEvents run-1",
        "streamGenerationEvents run-2", "startLanguageConversation",
      ])
  }

  func testACallStillUnwrittenAfterItsRunFailsInsteadOfWaitingAgain() async throws {
    let transport = ContentWritingTransport(
      starts: [.writing("run-1"), .writing("run-2")],
      events: ["run-1": #"data: {"status":"completed","step":"callReady"}"#])

    do {
      _ = try await LiveCallAPI(clients: clients(transport)).startOnceWritten(
        Self.checkpoint, token: "learner-token"
      ) {}
      XCTFail("a second run right after the first would only loop")
    } catch {
      XCTAssertEqual(error as? APIError, .unavailable)
    }

    let starts = await transport.requests.filter { $0 == "startLanguageConversation" }
    XCTAssertEqual(starts.count, 2)
  }

  func testARunThatFailsFailsTheStartWithoutSendingItAgain() async throws {
    let transport = ContentWritingTransport(
      starts: [.writing("run-1")],
      events: ["run-1": #"data: {"status":"error","step":"writeCall"}"#])

    do {
      _ = try await LiveCallAPI(clients: clients(transport)).startOnceWritten(
        Self.checkpoint, token: "learner-token"
      ) {}
      XCTFail("a failed run fails the start")
    } catch {
      XCTAssertTrue(error is GenerationStopped)
    }

    let starts = await transport.requests.filter { $0 == "startLanguageConversation" }
    XCTAssertEqual(starts.count, 1)
  }

  func testASetupLessonIsChosenAgainOnceItsRunEnds() async throws {
    let transport = ContentWritingTransport(
      starts: [],
      events: [
        "run-1": #"data: {"status":"started","step":"writeSetupLessons"}"# + "\n\n"
          + #"data: {"status":"completed","step":"setupLessonsReady"}"#
      ])
    var answers: [Written<String>] = [.writing(generationID: "run-1"), .done("applied")]

    let chosen = try await clients(transport).sendOnceWritten(token: "learner-token") {
    } _: {
      answers.removeFirst()
    }

    XCTAssertEqual(chosen, "applied")
    XCTAssertTrue(answers.isEmpty)
  }

  private static let checkpoint = Components.Schemas.LanguageConversationStartInput.case2(
    .init(blockId: "block-1", kind: .checkpoint))

  private func clients(_ transport: ContentWritingTransport) throws -> APIClientFactory {
    APIClientFactory(
      baseURL: try XCTUnwrap(URL(string: "https://api.zoonk.test")), transport: transport)
  }
}

private enum CallStartAnswer: Sendable {
  case writing(String)
  case created(String)
}

private actor ContentWritingTransport: ClientTransport {
  private var starts: [CallStartAnswer]
  private let events: [String: String]
  private(set) var requests: [String] = []

  init(starts: [CallStartAnswer], events: [String: String]) {
    self.starts = starts
    self.events = events
  }

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var headerFields = HTTPFields()

    switch operationID {
    case "startLanguageConversation":
      requests.append(operationID)
      headerFields[.contentType] = "application/json"

      switch starts.removeFirst() {
      case .writing(let run):
        headerFields[HTTPField.Name("Location")!] = "/v1/generations/\(run)"
        return (
          HTTPResponse(status: .accepted, headerFields: headerFields),
          HTTPBody(#"{"generationId":"\#(run)","status":"generating"}"#)
        )
      case .created(let id):
        return (
          HTTPResponse(status: .created, headerFields: headerFields),
          HTTPBody(#"{"conversationId":"\#(id)"}"#)
        )
      }
    case "streamGenerationEvents":
      let run = request.path?.split(separator: "/").dropLast().last.map(String.init) ?? ""
      requests.append("\(operationID) \(run)")
      headerFields[.contentType] = "text/event-stream"
      return (
        HTTPResponse(status: .ok, headerFields: headerFields),
        HTTPBody((events[run] ?? "") + "\n\n")
      )
    default:
      XCTAssertEqual(operationID, "getGeneration")
      headerFields[.contentType] = "application/json"
      return (
        HTTPResponse(status: .ok, headerFields: headerFields),
        HTTPBody(#"{"id":"run","status":"completed"}"#)
      )
    }
  }
}
