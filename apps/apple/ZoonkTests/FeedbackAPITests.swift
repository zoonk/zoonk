import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class FeedbackAPITests: XCTestCase {
  func testSubmitFeedbackSendsItsContextAndLinksTheSignedInAccount() async throws {
    let api = makeFeedbackAPI(
      transport: FeedbackResponseTransport(
        expectedAuthorization: "Bearer learner-session",
        expectedBody: [
          "context": [
            "appVersion": "2.0 (7)",
            "contentId": CourseChapter.testFixture.id,
            "contentKind": "chapter",
            "platform": "ios",
            "screen": "chapter",
          ],
          "email": "learner@zoonk.test",
          "message": "The chapter explanation could be clearer.",
        ],
        responseBody: #"{"message":"Feedback received"}"#,
        status: .ok))

    try await api.submit(
      FeedbackSubmission(
        context: FeedbackContext(contentID: CourseChapter.testFixture.id, contentKind: .chapter),
        email: "learner@zoonk.test",
        message: "The chapter explanation could be clearer."),
      token: "learner-session")
  }

  func testSignedOutFeedbackStillNamesTheApp() async throws {
    let api = makeFeedbackAPI(
      transport: FeedbackResponseTransport(
        expectedAuthorization: nil,
        expectedBody: [
          "context": ["appVersion": "2.0 (7)", "platform": "ios"],
          "email": "learner@zoonk.test",
          "message": "Please help.",
        ],
        responseBody: #"{"message":"Feedback received"}"#,
        status: .ok))

    try await api.submit(
      FeedbackSubmission(email: "learner@zoonk.test", message: "Please help."),
      token: nil)
  }

  func testValidationResponseRemainsActionable() async {
    let api = makeFeedbackAPI(
      transport: FeedbackResponseTransport(
        expectedAuthorization: nil,
        expectedBody: [
          "context": ["appVersion": "2.0 (7)", "platform": "ios"],
          "email": "invalid-email",
          "message": "Please help.",
        ],
        responseBody: feedbackErrorResponseBody,
        status: .badRequest))

    await assertFailure(.validation) {
      try await api.submit(
        FeedbackSubmission(email: "invalid-email", message: "Please help."), token: nil)
    }
  }

  func testServerFailureMapsToUnavailable() async {
    let api = makeFeedbackAPI(
      transport: FeedbackResponseTransport(
        expectedAuthorization: nil,
        expectedBody: [
          "context": ["appVersion": "2.0 (7)", "platform": "ios"],
          "email": "learner@zoonk.test",
          "message": "Please help.",
        ],
        responseBody: feedbackErrorResponseBody,
        status: .internalServerError))

    await assertFailure(.unavailable) {
      try await api.submit(
        FeedbackSubmission(email: "learner@zoonk.test", message: "Please help."), token: nil)
    }
  }

  func testURLFailureMapsToNetwork() async {
    let api = makeFeedbackAPI(transport: FeedbackFailureTransport(failure: .network))

    await assertFailure(.network) {
      try await api.submit(
        FeedbackSubmission(email: "learner@zoonk.test", message: "Please help."), token: nil)
    }
  }

  func testCancellationRemainsCancellation() async {
    let api = makeFeedbackAPI(transport: FeedbackFailureTransport(failure: .cancellation))

    do {
      try await api.submit(
        FeedbackSubmission(email: "learner@zoonk.test", message: "Please help."), token: nil)
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
      transport: transport),
    appVersion: "2.0 (7)")
}

/// Exercises the generated public feedback operation without sending a real message.
private struct FeedbackResponseTransport: ClientTransport {
  let expectedAuthorization: String?
  let expectedBody: [String: any Sendable]
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
    XCTAssertEqual(request.headerFields[.authorization], expectedAuthorization)

    let requestBody = try await Data(collecting: XCTUnwrap(body), upTo: 4_096)
    let requestPayload = try XCTUnwrap(
      JSONSerialization.jsonObject(with: requestBody) as? NSDictionary)
    XCTAssertEqual(requestPayload, NSDictionary(dictionary: expectedBody.mapValues { $0 as Any }))

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
