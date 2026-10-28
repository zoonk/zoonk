import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class CourseCatalogAPITests: XCTestCase {
  func testListCoursesUsesPublicCatalogQueryAndMapsPage() async throws {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "listCourses",
        expectedPath: "/courses",
        expectedQuery: [
          "category": "science",
          "cursor": "opaque-cursor",
          "language": "en",
          "limit": "24",
        ],
        responseBody:
          #"""
          {
            "data": [
              {
                "description": "Understand the night sky.",
                "estimatedMinutes": 45,
                "id": "00000000-0000-7000-8000-000000000002",
                "imageUrl": "https://cdn.zoonk.test/course.png",
                "language": "en",
                "lessonCount": 3,
                "organization": {
                  "id": "00000000-0000-7000-8000-000000000001",
                  "logo": "https://cdn.zoonk.test/organization.png",
                  "name": "Zoonk",
                  "slug": "zoonk"
                },
                "slug": "astronomy",
                "title": "Astronomy"
              }
            ],
            "pagination": { "hasMore": true, "nextCursor": "next-page" }
          }
          """#,
        status: .ok))

    let page = try await api.listCourses(
      query: CourseCatalogQuery(
        category: .science,
        cursor: "opaque-cursor",
        language: "en",
        limit: 24))

    XCTAssertEqual(page.courses, [.testFixture])
    XCTAssertTrue(page.hasMore)
    XCTAssertEqual(page.nextCursor, "next-page")
  }

  func testGetCourseMapsPublicCourseMetadata() async throws {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "getCourse",
        expectedPath: "/courses/00000000-0000-7000-8000-000000000002",
        expectedQuery: [:],
        responseBody:
          #"""
          {
            "categories": ["science"],
            "description": "Understand the night sky.",
            "format": "core",
            "generationId": null,
            "generationStatus": "completed",
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
            "targetLanguage": null,
            "title": "Astronomy"
          }
          """#,
        status: .ok))

    let course = try await api.getCourse(id: Course.testFixture.id)

    XCTAssertEqual(course, .testFixture)
  }

  func testGetChapterMapsCanonicalChapterMetadata() async throws {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "getChapter",
        expectedPath: "/chapters/00000000-0000-7000-8000-000000000004",
        expectedQuery: ["courseId": "00000000-0000-7000-8000-000000000002"],
        responseBody:
          #"""
          {
            "courseId": "00000000-0000-7000-8000-000000000002",
            "description": "Meet our cosmic neighborhood.",
            "generationId": null,
            "generationStatus": "completed",
            "id": "00000000-0000-7000-8000-000000000004",
            "language": "en",
            "level": "beginner",
            "position": 0,
            "slug": "solar-system",
            "title": "The Solar System"
          }
          """#,
        status: .ok))

    let chapter = try await api.getChapter(.testFixture)

    XCTAssertEqual(chapter, .resourceTestFixture)
  }

  func testListCourseChaptersMapsAuthoredOrderAndLessonCount() async throws {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "listCourseChapters",
        expectedPath: "/courses/00000000-0000-7000-8000-000000000002/chapters",
        expectedQuery: [:],
        responseBody:
          #"""
          {
            "data": [
              {
                "courseId": "00000000-0000-7000-8000-000000000002",
                "description": "Meet our cosmic neighborhood.",
                "generationId": null,
                "generationStatus": "completed",
                "id": "00000000-0000-7000-8000-000000000004",
                "language": "en",
                "lessonCount": 2,
                "level": "beginner",
                "position": 0,
                "slug": "solar-system",
                "title": "The Solar System"
              }
            ]
          }
          """#,
        status: .ok))

    let chapters = try await api.listCourseChapters(courseID: Course.testFixture.id)

    XCTAssertEqual(chapters, [.testFixture])
  }

  func testCourseAndChapterKeepTheirWritingState() async throws {
    let courseAPI = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "getCourse",
        expectedPath: "/courses/00000000-0000-7000-8000-000000000002",
        expectedQuery: [:],
        responseBody:
          #"""
          {
            "categories": [],
            "description": null,
            "format": "core",
            "generationId": "run-1",
            "generationStatus": "running",
            "id": "00000000-0000-7000-8000-000000000002",
            "imageUrl": null,
            "language": "en",
            "organization": {
              "id": "00000000-0000-7000-8000-000000000001",
              "logo": null,
              "name": "Zoonk",
              "slug": "zoonk"
            },
            "slug": "astronomy",
            "targetLanguage": null,
            "title": "Astronomy"
          }
          """#,
        status: .ok))
    let chapterAPI = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "getChapter",
        expectedPath: "/chapters/00000000-0000-7000-8000-000000000004",
        expectedQuery: ["courseId": "00000000-0000-7000-8000-000000000002"],
        responseBody:
          #"""
          {
            "courseId": "00000000-0000-7000-8000-000000000002",
            "description": "Meet our cosmic neighborhood.",
            "generationId": null,
            "generationStatus": "pending",
            "id": "00000000-0000-7000-8000-000000000004",
            "language": "en",
            "level": "beginner",
            "position": 0,
            "slug": "solar-system",
            "title": "The Solar System"
          }
          """#,
        status: .ok))

    let course = try await courseAPI.getCourse(id: Course.testFixture.id)
    let chapter = try await chapterAPI.getChapter(.testFixture)

    XCTAssertEqual(course.generationStatus, .running)
    XCTAssertEqual(chapter.generationStatus, .pending)
  }

  func testListChapterLessonsReadsTheChapterInItsCourse() async throws {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "listChapterLessons",
        expectedPath: "/chapters/00000000-0000-7000-8000-000000000004/lessons",
        expectedQuery: ["courseId": "00000000-0000-7000-8000-000000000002"],
        responseBody:
          #"""
          {
            "data": [
              {
                "chapterId": "00000000-0000-7000-8000-000000000004",
                "courseId": "00000000-0000-7000-8000-000000000002",
                "description": "A first look at our star.",
                "generationId": null,
                "generationStatus": "completed",
                "id": "00000000-0000-7000-8000-000000000005",
                "language": "en",
                "position": 0,
                "slug": "the-sun",
                "title": "The Sun"
              }
            ]
          }
          """#,
        status: .ok))

    let lessons = try await api.listChapterLessons(.testFixture)

    XCTAssertEqual(lessons, [.testFixture])
  }

  func testSearchCatalogMapsCourseAndChapterResults() async throws {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "searchCatalog",
        expectedPath: "/catalog/search",
        expectedQuery: ["language": "en", "query": "stars"],
        responseBody:
          #"""
          {
            "chapters": [
              {
                "courseId": "00000000-0000-7000-8000-000000000002",
                "courseSlug": "astronomy",
                "courseTitle": "Astronomy",
                "description": "Meet our cosmic neighborhood.",
                "id": "00000000-0000-7000-8000-000000000004",
                "language": "en",
                "organizationSlug": "zoonk",
                "slug": "solar-system",
                "title": "The Solar System"
              }
            ],
            "courses": [
              {
                "description": "Understand the night sky.",
                "id": "00000000-0000-7000-8000-000000000002",
                "imageUrl": "https://cdn.zoonk.test/course.png",
                "language": "en",
                "organizationSlug": "zoonk",
                "slug": "astronomy",
                "title": "Astronomy"
              }
            ]
          }
          """#,
        status: .ok))

    let results = try await api.searchCatalog(
      query: CatalogSearchQuery(language: "en", query: "stars"))

    XCTAssertEqual(results, .testFixture)
  }

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

/// Exercises the generated public catalog operations without depending on an external server.
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
