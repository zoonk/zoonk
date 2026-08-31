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
            "coursePromptId": null,
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
        expectedQuery: [:],
        responseBody:
          #"""
          {
            "courseId": "00000000-0000-7000-8000-000000000002",
            "description": "Meet our cosmic neighborhood.",
            "generationId": null,
            "generationStatus": "completed",
            "id": "00000000-0000-7000-8000-000000000004",
            "imageUrl": null,
            "language": "en",
            "position": 0,
            "slug": "solar-system",
            "title": "The Solar System"
          }
          """#,
        status: .ok))

    let chapter = try await api.getChapter(id: CourseChapter.testFixture.id)

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
                "imageUrl": null,
                "language": "en",
                "lessonCount": 2,
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

  func testListChapterLessonsMapsLessonKind() async throws {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "listChapterLessons",
        expectedPath: "/chapters/00000000-0000-7000-8000-000000000004/lessons",
        expectedQuery: [:],
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
                "imageUrl": null,
                "kind": "explanation",
                "language": "en",
                "position": 0,
                "slug": "the-sun",
                "title": "The Sun"
              }
            ]
          }
          """#,
        status: .ok))

    let lessons = try await api.listChapterLessons(chapterID: CourseChapter.testFixture.id)

    XCTAssertEqual(lessons, [.testFixture])
  }

  func testGetCourseNextLessonMapsConcreteLessonTarget() async throws {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "getCourseNextLesson",
        expectedPath:
          "/courses/00000000-0000-7000-8000-000000000002/next-lesson",
        expectedQuery: [:],
        expectedToken: "session-token",
        responseBody:
          #"""
          {
            "canPrefetch": true,
            "chapterId": "00000000-0000-7000-8000-000000000004",
            "chapterSlug": "solar-system",
            "completed": false,
            "courseId": "00000000-0000-7000-8000-000000000002",
            "courseSlug": "astronomy",
            "hasStarted": true,
            "lessonId": "00000000-0000-7000-8000-000000000005",
            "lessonPosition": 0,
            "lessonSlug": "the-sun",
            "organizationSlug": "zoonk",
            "type": "lesson"
          }
          """#,
        status: .ok))

    let target = try await api.getCourseNextLesson(
      courseID: Course.testFixture.id,
      token: "session-token")

    XCTAssertEqual(target, .testLessonFixture)
  }

  func testGetChapterNextLessonMapsEmptyTarget() async throws {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "getChapterNextLesson",
        expectedPath:
          "/chapters/00000000-0000-7000-8000-000000000004/next-lesson",
        expectedQuery: [:],
        expectedToken: "session-token",
        responseBody:
          #"""
          { "completed": false, "hasStarted": false, "type": "empty" }
          """#,
        status: .ok))

    let target = try await api.getChapterNextLesson(
      chapterID: CourseChapter.testFixture.id,
      token: "session-token")

    XCTAssertEqual(
      target,
      .empty(CatalogEmptyContinuation(completed: false, hasStarted: false)))
  }

  func testGetCourseNextLessonMapsPendingChapterTargetWithoutAuthorization() async throws {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "getCourseNextLesson",
        expectedPath:
          "/courses/00000000-0000-7000-8000-000000000002/next-lesson",
        expectedQuery: [:],
        responseBody:
          #"""
          {
            "canPrefetch": false,
            "chapterId": "00000000-0000-7000-8000-000000000004",
            "chapterSlug": "solar-system",
            "completed": false,
            "courseId": "00000000-0000-7000-8000-000000000002",
            "courseSlug": "astronomy",
            "hasStarted": false,
            "organizationSlug": "zoonk",
            "type": "chapter"
          }
          """#,
        status: .ok))

    let target = try await api.getCourseNextLesson(
      courseID: Course.testFixture.id,
      token: nil)

    XCTAssertEqual(target, .testChapterFixture)
  }

  func testGetCourseProgressMapsChapterAndAggregateProgress() async throws {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "getCourseProgress",
        expectedPath: "/courses/00000000-0000-7000-8000-000000000002/progress",
        expectedQuery: [:],
        expectedToken: "session-token",
        responseBody:
          #"""
          {
            "chapters": [
              {
                "chapterId": "00000000-0000-7000-8000-000000000004",
                "completedLessons": 1,
                "totalLessons": 2
              }
            ],
            "percentComplete": 50
          }
          """#,
        status: .ok))

    let progress = try await api.getCourseProgress(
      courseID: Course.testFixture.id,
      token: "session-token")

    XCTAssertEqual(progress, .testFixture)
  }

  func testGetChapterProgressMapsLessonAndAggregateProgress() async throws {
    let api = makeCourseCatalogAPI(
      transport: CourseCatalogResponseTransport(
        expectedOperationID: "getChapterProgress",
        expectedPath: "/chapters/00000000-0000-7000-8000-000000000004/progress",
        expectedQuery: [:],
        expectedToken: "session-token",
        responseBody:
          #"""
          {
            "lessons": [
              {
                "isCompleted": true,
                "lessonId": "00000000-0000-7000-8000-000000000005"
              }
            ],
            "percentComplete": 50
          }
          """#,
        status: .ok))

    let progress = try await api.getChapterProgress(
      chapterID: CourseChapter.testFixture.id,
      token: "session-token")

    XCTAssertEqual(progress, .testFixture)
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
                "imageUrl": "https://cdn.zoonk.test/chapter.png",
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
    } catch let error as CourseCatalogFailure {
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
    } catch let error as CourseCatalogFailure {
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
    } catch let error as CourseCatalogFailure {
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
