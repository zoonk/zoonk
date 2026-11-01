import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class CourseCatalogAPITests: XCTestCase {
  func testMissingCourseMapsToNotFound() async {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "getCourse",
        expectedPath: "/courses/00000000-0000-7000-8000-000000000002",
        expectedQuery: [:],
        responseBody: errorResponseBody,
        status: .notFound))

    do {
      _ = try await api.getCourse(id: Course.testFixture.id)
      XCTFail("Expected not found")
    } catch let error as APIError {
      XCTAssertEqual(error, .notFound)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testServerFailureMapsToUnavailable() async {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "listCourses",
        expectedPath: "/courses",
        expectedQuery: ["language": "en"],
        responseBody: errorResponseBody,
        status: .internalServerError))

    do {
      _ = try await api.listCourses(query: CourseCatalogQuery(language: "en"))
      XCTFail("Expected unavailable")
    } catch let error as APIError {
      XCTAssertEqual(error, .unavailable)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testURLFailureMapsToNetwork() async {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogFailureTransport(failure: .network))

    do {
      _ = try await api.listCourses(query: CourseCatalogQuery(language: "en"))
      XCTFail("Expected network failure")
    } catch let error as APIError {
      XCTAssertEqual(error, .network)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testCancellationRemainsCancellation() async {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogFailureTransport(failure: .cancellation))

    do {
      _ = try await api.listCourses(query: CourseCatalogQuery(language: "en"))
      XCTFail("Expected cancellation")
    } catch is CancellationError {
      return
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }
}

private let errorResponseBody =
  #"{"error":{"code":"RESOURCE_NOT_FOUND","message":"Resource not found"}}"#

private func makeCourseCatalogAPI(transport: any ClientTransport) -> CourseCatalogAPI {
  CourseCatalogAPI(
    clients: APIClientFactory(
      baseURL: URL(string: "https://api.zoonk.test")!,
      transport: transport))
}

private struct CourseCatalogResponseTransport: ClientTransport {
  let expectedOperationID: String
  let expectedPath: String
  let expectedQuery: [String: String]
  let expectedToken: String?
  let responseBody: String
  let status: HTTPResponse.Status

  init(
    expectedOperationID: String,
    expectedPath: String,
    expectedQuery: [String: String],
    expectedToken: String? = nil,
    responseBody: String,
    status: HTTPResponse.Status
  ) {
    self.expectedOperationID = expectedOperationID
    self.expectedPath = expectedPath
    self.expectedQuery = expectedQuery
    self.expectedToken = expectedToken
    self.responseBody = responseBody
    self.status = status
  }

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTAssertEqual(baseURL, URL(string: "https://api.zoonk.test/v1"))
    XCTAssertEqual(operationID, expectedOperationID)
    XCTAssertEqual(request.method, .get)
    XCTAssertEqual(
      request.headerFields[.authorization],
      expectedToken.map { "Bearer \($0)" })
    XCTAssertNotNil(request.headerFields[.acceptLanguage])

    let components = try XCTUnwrap(
      URLComponents(string: "https://api.zoonk.test\(request.path ?? "")"))
    let query = Dictionary(
      uniqueKeysWithValues: (components.queryItems ?? []).compactMap { item in
        item.value.map { (item.name, $0) }
      })

    XCTAssertEqual(components.path, expectedPath)
    XCTAssertEqual(query, expectedQuery)

    var headerFields = HTTPFields()
    headerFields[.contentType] = "application/json"

    return (
      HTTPResponse(status: status, headerFields: headerFields),
      HTTPBody(responseBody)
    )
  }
}

private enum CourseCatalogTransportFailure: Sendable {
  case cancellation
  case network
}

private struct CourseCatalogFailureTransport: ClientTransport {
  let failure: CourseCatalogTransportFailure

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
