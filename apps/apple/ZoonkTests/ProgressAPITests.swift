import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class ProgressAPITests: XCTestCase {
  func testUnauthorizedResponseMapsToUnauthorized() async {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserActivity",
        status: .unauthorized,
        responseBody:
          #"{"error":{"code":"UNAUTHORIZED","message":"Sign in to continue"}}"#))

    do {
      _ = try await api.getActivity(token: "test-session")
      XCTFail("Expected an unauthorized error")
    } catch let error as APIError {
      XCTAssertEqual(error, .unauthorized)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testURLFailureMapsToNetwork() async {
    let api = makeProgressAPI(
      transport: ProgressFailureTransport(failure: .network))

    do {
      _ = try await api.getActivity(token: "test-session")
      XCTFail("Expected a network error")
    } catch let error as APIError {
      XCTAssertEqual(error, .network)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testCancellationErrorIsPreserved() async {
    let api = makeProgressAPI(
      transport: ProgressFailureTransport(failure: .cancellation))

    do {
      _ = try await api.getActivity(token: "test-session")
      XCTFail("Expected cancellation")
    } catch is CancellationError {
      return
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testCancelledURLRequestIsPreservedAsCancellation() async {
    let api = makeProgressAPI(
      transport: ProgressFailureTransport(failure: .cancelledURL))

    do {
      _ = try await api.getActivity(token: "test-session")
      XCTFail("Expected cancellation")
    } catch is CancellationError {
      return
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testInvalidLogicalDateMapsToInvalidResponse() async {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserActivity",
        status: .ok,
        responseBody:
          #"""
          {
            "activity": {
              "learningDays": 1,
              "totalLearningSeconds": 300,
              "totalLessonCompletions": 1,
              "days": [{ "activitiesCompleted": 1, "date": "2026-02-30", "lessonCompletions": 1 }]
            }
          }
          """#))

    do {
      _ = try await api.getActivity(token: "test-session")
      XCTFail("Expected an invalid response error")
    } catch let error as APIError {
      XCTAssertEqual(error, .unavailable)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testServerErrorMapsToInvalidResponse() async {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserActivity",
        status: .internalServerError,
        responseBody:
          #"{"error":{"code":"INTERNAL_SERVER_ERROR","message":"Try again later"}}"#))

    do {
      _ = try await api.getActivity(token: "test-session")
      XCTFail("Expected an invalid response error")
    } catch let error as APIError {
      XCTAssertEqual(error, .unavailable)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }
}

private func makeProgressAPI(transport: any ClientTransport) -> ProgressAPI {
  ProgressAPI(
    clients: APIClientFactory(
      baseURL: URL(string: "https://api.zoonk.test")!,
      transport: transport))
}

private struct ProgressResponseTransport: ClientTransport {
  let expectedOperationID: String
  let status: HTTPResponse.Status
  let responseBody: String

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTAssertEqual(baseURL, URL(string: "https://api.zoonk.test/v1"))
    XCTAssertEqual(operationID, expectedOperationID)
    XCTAssertEqual(request.method, .get)
    XCTAssertEqual(request.headerFields[.authorization], "Bearer test-session")
    XCTAssertNotNil(request.headerFields[.acceptLanguage])

    var headerFields = HTTPFields()
    headerFields[.contentType] = "application/json"

    return (
      HTTPResponse(status: status, headerFields: headerFields),
      HTTPBody(responseBody)
    )
  }
}

private enum ProgressTransportFailure: Sendable {
  case cancellation
  case cancelledURL
  case network
}

private struct ProgressFailureTransport: ClientTransport {
  let failure: ProgressTransportFailure

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    switch failure {
    case .cancellation:
      throw CancellationError()
    case .cancelledURL:
      throw URLError(.cancelled)
    case .network:
      throw URLError(.notConnectedToInternet)
    }
  }
}
