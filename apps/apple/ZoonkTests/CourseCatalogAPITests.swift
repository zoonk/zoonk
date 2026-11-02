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
  let responseBody: String
  let status: HTTPResponse.Status

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTAssertEqual(baseURL, URL(string: "https://api.zoonk.test/v1"))
    XCTAssertEqual(operationID, expectedOperationID)
    XCTAssertEqual(request.method, .get)
    XCTAssertNil(request.headerFields[.authorization])
    XCTAssertNotNil(request.headerFields[.acceptLanguage])
    XCTAssertEqual(request.path, expectedPath)

    var headerFields = HTTPFields()
    headerFields[.contentType] = "application/json"

    return (
      HTTPResponse(status: status, headerFields: headerFields),
      HTTPBody(responseBody)
    )
  }
}
