import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class FeedbackAPITests: XCTestCase {
  func testSubmitFeedbackUsesPublicEndpoint() async throws {
    let api = makeFeedbackAPI(
      transport: FeedbackResponseTransport(
        expectedSubmission: FeedbackSubmission(
          email: "learner@zoonk.test",
          message: "The chapter explanation could be clearer."),
        responseBody: #"{"message":"Feedback received"}"#,
        status: .ok))

    try await api.submit(
      FeedbackSubmission(
        email: "learner@zoonk.test",
        message: "The chapter explanation could be clearer."))
  }

  func testValidationResponseRemainsActionable() async {
    let api = makeFeedbackAPI(
      transport: FeedbackResponseTransport(
        expectedSubmission: FeedbackSubmission(
          email: "invalid-email",
          message: "Please help."),
        responseBody: feedbackErrorResponseBody,
        status: .badRequest))

    await assertFailure(.validation) {
      try await api.submit(
        FeedbackSubmission(email: "invalid-email", message: "Please help."))
    }
  }

  func testServerFailureMapsToUnavailable() async {
    let api = makeFeedbackAPI(
      transport: FeedbackResponseTransport(
        expectedSubmission: FeedbackSubmission(
          email: "learner@zoonk.test",
          message: "Please help."),
        responseBody: feedbackErrorResponseBody,
        status: .internalServerError))

    await assertFailure(.unavailable) {
      try await api.submit(
        FeedbackSubmission(email: "learner@zoonk.test", message: "Please help."))
    }
  }

  func testURLFailureMapsToNetwork() async {
    let api = makeFeedbackAPI(transport: FeedbackFailureTransport(failure: .network))

    await assertFailure(.network) {
      try await api.submit(
        FeedbackSubmission(email: "learner@zoonk.test", message: "Please help."))
    }
  }

  func testCancellationRemainsCancellation() async {
    let api = makeFeedbackAPI(transport: FeedbackFailureTransport(failure: .cancellation))

    do {
      try await api.submit(
        FeedbackSubmission(email: "learner@zoonk.test", message: "Please help."))
      XCTFail("Expected cancellation")
    } catch is CancellationError {
      return
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  private func assertFailure(
    _ expectedFailure: FeedbackFailure,
    operation: () async throws -> Void
  ) async {
    do {
      try await operation()
      XCTFail("Expected \(expectedFailure)")
    } catch let failure as FeedbackFailure {
      XCTAssertEqual(failure, expectedFailure)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }
}

private let feedbackErrorResponseBody =
  #"{"error":{"code":"INVALID_FEEDBACK","message":"Invalid feedback"}}"#

private func makeFeedbackAPI(transport: any ClientTransport) -> FeedbackAPI {
  FeedbackAPI(
    clients: APIClientFactory(
      baseURL: URL(string: "https://api.zoonk.test")!,
      transport: transport))
}

/// Exercises the generated public feedback operation without sending a real message.
private struct FeedbackResponseTransport: ClientTransport {
  let expectedSubmission: FeedbackSubmission
  let responseBody: String
  let status: HTTPResponse.Status

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTAssertEqual(baseURL, URL(string: "https://api.zoonk.test/v1"))
    XCTAssertEqual(operationID, "createFeedback")
    XCTAssertEqual(request.method, .post)
    XCTAssertEqual(request.path, "/feedback")
    XCTAssertNil(request.headerFields[.authorization])

    let requestBody = try await String(
      collecting: XCTUnwrap(body),
      upTo: 4_096)
    let requestPayload = try XCTUnwrap(
      JSONSerialization.jsonObject(with: Data(requestBody.utf8)) as? [String: String])
    XCTAssertEqual(
      requestPayload,
      [
        "email": expectedSubmission.email,
        "message": expectedSubmission.message,
      ])

    var headerFields = HTTPFields()
    headerFields[.contentType] = "application/json"

    return (
      HTTPResponse(status: status, headerFields: headerFields),
      HTTPBody(responseBody)
    )
  }
}

private enum FeedbackTransportFailure: Sendable {
  case cancellation
  case network
}

private struct FeedbackFailureTransport: ClientTransport {
  let failure: FeedbackTransportFailure

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    switch failure {
    case .cancellation:
      throw CancellationError()
    case .network:
      throw URLError(.notConnectedToInternet)
    }
  }
}
