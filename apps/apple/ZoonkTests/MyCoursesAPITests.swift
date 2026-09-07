import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class MyCoursesAPITests: XCTestCase {
  func testListCoursesUsesAuthenticatedPaginationAndMapsNullableOrganization() async throws {
    let api = makeMyCoursesAPI(
      transport: MyCoursesResponseTransport(
        expectedOperationID: "listCurrentUserCourses",
        expectedPath: "/me/courses",
        expectedQuery: [
          "cursor": "opaque-cursor",
          "limit": "24",
          "query": "night sky",
        ],
        expectedToken: "session-token",
        responseBody:
          #"""
          {
            "data": [
              {
                "description": "Understand the night sky.",
                "id": "00000000-0000-7000-8000-000000000002",
                "imageUrl": "https://cdn.zoonk.test/course.png",
                "language": "en",
                "organization": {
                  "id": "00000000-0000-7000-8000-000000000001",
                  "logo": "https://cdn.zoonk.test/organization.png",
                  "name": "Zoonk",
                  "slug": "zoonk"
                },
                "slug": "astronomy",
                "title": "Astronomy"
              },
              {
                "description": null,
                "id": "00000000-0000-7000-8000-000000000003",
                "imageUrl": null,
                "language": "pt",
                "organization": null,
                "slug": "personal-course",
                "title": "Personal Course"
              }
            ],
            "pagination": { "hasMore": true, "nextCursor": "next-page" }
          }
          """#,
        status: .ok))

    let page = try await api.listCourses(
      request: MyCoursesRequest(
        query: MyCoursesQuery(cursor: "opaque-cursor", limit: 24, query: "night sky"),
        token: "session-token"))

    XCTAssertEqual(
      page,
      MyCoursesPage(
        courses: [.myCoursesTestFixture, .personalMyCoursesTestFixture],
        hasMore: true,
        nextCursor: "next-page"))
    XCTAssertNil(page.courses.last?.organization)
  }

  func testUnauthorizedResponseMapsToUnauthorized() async {
    let api = makeMyCoursesAPI(
      transport: MyCoursesResponseTransport(
        expectedOperationID: "listCurrentUserCourses",
        expectedPath: "/me/courses",
        expectedQuery: [:],
        expectedToken: "expired-session",
        responseBody:
          #"{"error":{"code":"UNAUTHORIZED","message":"Sign in to continue"}}"#,
        status: .unauthorized))

    do {
      _ = try await api.listCourses(
        request: MyCoursesRequest(
          query: MyCoursesQuery(),
          token: "expired-session"))
      XCTFail("Expected an unauthorized error")
    } catch let error as MyCoursesAPIError {
      XCTAssertEqual(error, .unauthorized)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testNetworkFailureMapsToNetwork() async {
    let api = makeMyCoursesAPI(
      transport: MyCoursesFailureTransport(failure: .network))

    do {
      _ = try await api.listCourses(
        request: MyCoursesRequest(query: MyCoursesQuery(), token: "session-token"))
      XCTFail("Expected a network error")
    } catch let error as MyCoursesAPIError {
      XCTAssertEqual(error, .network)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testCancellationIsPreserved() async {
    let api = makeMyCoursesAPI(
      transport: MyCoursesFailureTransport(failure: .cancellation))

    do {
      _ = try await api.listCourses(
        request: MyCoursesRequest(query: MyCoursesQuery(), token: "session-token"))
      XCTFail("Expected cancellation")
    } catch is CancellationError {
      return
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }
}

extension CourseOrganization {
  static let myCoursesTestFixture = CourseOrganization(
    id: "00000000-0000-7000-8000-000000000001",
    logoURL: URL(string: "https://cdn.zoonk.test/organization.png"),
    name: "Zoonk",
    slug: "zoonk")
}

extension UserCourseSummary {
  static let myCoursesTestFixture = UserCourseSummary(
    description: "Understand the night sky.",
    id: "00000000-0000-7000-8000-000000000002",
    imageURL: URL(string: "https://cdn.zoonk.test/course.png"),
    language: "en",
    organization: .myCoursesTestFixture,
    slug: "astronomy",
    title: "Astronomy")

  static let personalMyCoursesTestFixture = UserCourseSummary(
    description: nil,
    id: "00000000-0000-7000-8000-000000000003",
    imageURL: nil,
    language: "pt",
    organization: nil,
    slug: "personal-course",
    title: "Personal Course")
}

private func makeMyCoursesAPI(transport: any ClientTransport) -> MyCoursesAPI {
  MyCoursesAPI(
    clients: APIClientFactory(
      baseURL: URL(string: "https://api.zoonk.test")!,
      transport: transport))
}

/// Exercises the generated learner-library operation without depending on an external server.
private struct MyCoursesResponseTransport: ClientTransport {
  let expectedOperationID: String
  let expectedPath: String
  let expectedQuery: [String: String]
  let expectedToken: String
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
    XCTAssertEqual(request.headerFields[.authorization], "Bearer \(expectedToken)")
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

private enum MyCoursesTransportFailure: Sendable {
  case cancellation
  case network
}

private struct MyCoursesFailureTransport: ClientTransport {
  let failure: MyCoursesTransportFailure

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
