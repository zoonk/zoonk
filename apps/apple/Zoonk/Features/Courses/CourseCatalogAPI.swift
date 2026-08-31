import Foundation
import OpenAPIRuntime

protocol CourseCatalogAPIClient: Sendable {
  func listCourses(query: CourseCatalogQuery) async throws -> CourseCatalogPage
  func getCourse(id: String) async throws -> Course
  func getChapter(id: String) async throws -> CourseChapter
  func listCourseChapters(courseID: String) async throws -> [CourseChapter]
  func listChapterLessons(chapterID: String) async throws -> [CourseLesson]
  func getCourseNextLesson(courseID: String, token: String?) async throws
    -> CatalogContinuationTarget
  func getChapterNextLesson(chapterID: String, token: String?) async throws
    -> CatalogContinuationTarget
  func getCourseProgress(courseID: String, token: String?) async throws -> CourseProgress
  func getChapterProgress(chapterID: String, token: String?) async throws -> ChapterProgress
  func searchCatalog(query: CatalogSearchQuery) async throws -> CatalogSearchResults
}

struct CourseCatalogAPI: CourseCatalogAPIClient, @unchecked Sendable {
  private let clients: APIClientFactory

  init(clients: APIClientFactory) {
    self.clients = clients
  }

  func listCourses(query: CourseCatalogQuery) async throws -> CourseCatalogPage {
    try await perform { client in
      let output = try await client.listCourses(
        .init(
          query: .init(
            category: query.category.map(makeGeneratedCourseCategory),
            cursor: query.cursor,
            language: query.language,
            limit: query.limit)))

      switch output {
      case .ok(let response):
        return makeCourseCatalogPage(try response.body.json)
      case .badRequest, .internalServerError, .undocumented:
        throw CourseCatalogFailure.unavailable
      }
    }
  }

  func getCourse(id: String) async throws -> Course {
    try await perform { client in
      let output = try await client.getCourse(.init(path: .init(courseId: id)))

      switch output {
      case .ok(let response):
        return try makeCourse(try response.body.json)
      case .notFound:
        throw CourseCatalogFailure.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw CourseCatalogFailure.unavailable
      }
    }
  }

  func getChapter(id: String) async throws -> CourseChapter {
    try await perform { client in
      let output = try await client.getChapter(.init(path: .init(chapterId: id)))

      switch output {
      case .ok(let response):
        return makeCourseChapter(try response.body.json)
      case .notFound:
        throw CourseCatalogFailure.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw CourseCatalogFailure.unavailable
      }
    }
  }

  func listCourseChapters(courseID: String) async throws -> [CourseChapter] {
    try await perform { client in
      let output = try await client.listCourseChapters(
        .init(path: .init(courseId: courseID)))

      switch output {
      case .ok(let response):
        return try response.body.json.data.map(makeCourseChapter)
      case .notFound:
        throw CourseCatalogFailure.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw CourseCatalogFailure.unavailable
      }
    }
  }

  func listChapterLessons(chapterID: String) async throws -> [CourseLesson] {
    try await perform { client in
      let output = try await client.listChapterLessons(
        .init(path: .init(chapterId: chapterID)))

      switch output {
      case .ok(let response):
        return try response.body.json.data.map(makeCourseLesson)
      case .notFound:
        throw CourseCatalogFailure.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw CourseCatalogFailure.unavailable
      }
    }
  }

  func getCourseNextLesson(courseID: String, token: String?) async throws
    -> CatalogContinuationTarget
  {
    try await perform(token: token) { client in
      let output = try await client.getCourseNextLesson(
        .init(path: .init(courseId: courseID)))

      switch output {
      case .ok(let response):
        return makeCatalogContinuationTarget(try response.body.json)
      case .notFound:
        throw CourseCatalogFailure.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw CourseCatalogFailure.unavailable
      }
    }
  }

  func getChapterNextLesson(chapterID: String, token: String?) async throws
    -> CatalogContinuationTarget
  {
    try await perform(token: token) { client in
      let output = try await client.getChapterNextLesson(
        .init(path: .init(chapterId: chapterID)))

      switch output {
      case .ok(let response):
        return makeCatalogContinuationTarget(try response.body.json)
      case .notFound:
        throw CourseCatalogFailure.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw CourseCatalogFailure.unavailable
      }
    }
  }

  func getCourseProgress(courseID: String, token: String?) async throws -> CourseProgress {
    try await perform(token: token) { client in
      let output = try await client.getCourseProgress(
        .init(path: .init(courseId: courseID)))

      switch output {
      case .ok(let response):
        return makeCourseProgress(try response.body.json)
      case .notFound:
        throw CourseCatalogFailure.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw CourseCatalogFailure.unavailable
      }
    }
  }

  func getChapterProgress(chapterID: String, token: String?) async throws -> ChapterProgress {
    try await perform(token: token) { client in
      let output = try await client.getChapterProgress(
        .init(path: .init(chapterId: chapterID)))

      switch output {
      case .ok(let response):
        return makeChapterProgress(try response.body.json)
      case .notFound:
        throw CourseCatalogFailure.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw CourseCatalogFailure.unavailable
      }
    }
  }

  func searchCatalog(query: CatalogSearchQuery) async throws -> CatalogSearchResults {
    try await perform { client in
      let output = try await client.searchCatalog(
        .init(query: .init(language: query.language, query: query.query)))

      switch output {
      case .ok(let response):
        return makeCatalogSearchResults(try response.body.json)
      case .badRequest, .internalServerError, .undocumented:
        throw CourseCatalogFailure.unavailable
      }
    }
  }

  /// Keeps generated transport failures behind stable recovery states while preserving task cancellation.
  private func perform<Output: Sendable>(
    token: String? = nil,
    operation: @Sendable (Client) async throws -> Output
  ) async throws -> Output {
    do {
      return try await operation(clients.makeClient(token: token))
    } catch {
      if isRequestCancellation(error) {
        throw CancellationError()
      }

      if let failure = error as? CourseCatalogFailure {
        throw failure
      }

      if isNetworkError(error) {
        throw CourseCatalogFailure.network
      }

      throw CourseCatalogFailure.unavailable
    }
  }

  private func isRequestCancellation(_ error: Error) -> Bool {
    if error is CancellationError {
      return true
    }

    if let urlError = error as? URLError {
      return urlError.code == .cancelled
    }

    if let clientError = error as? ClientError {
      return isRequestCancellation(clientError.underlyingError)
    }

    return false
  }

  private func isNetworkError(_ error: Error) -> Bool {
    if error is URLError {
      return true
    }

    if let clientError = error as? ClientError {
      return isNetworkError(clientError.underlyingError)
    }

    return false
  }
}

private func makeGeneratedCourseCategory(
  _ category: CourseCategory
) -> Operations.ListCourses.Input.Query.CategoryPayload {
  switch category {
  case .arts: .arts
  case .business: .business
  case .communication: .communication
  case .culture: .culture
  case .economics: .economics
  case .engineering: .engineering
  case .geography: .geography
  case .health: .health
  case .history: .history
  case .languages: .languages
  case .law: .law
  case .math: .math
  case .science: .science
  case .society: .society
  case .tech: .tech
  }
}

private func makeCourseCatalogPage(
  _ payload: Operations.ListCourses.Output.Ok.Body.JsonPayload
) -> CourseCatalogPage {
  CourseCatalogPage(
    courses: payload.data.map(makeCourseSummary),
    hasMore: payload.pagination.hasMore,
    nextCursor: payload.pagination.nextCursor)
}

private func makeCourseSummary(
  _ payload: Components.Schemas.CourseResult
) -> CourseSummary {
  CourseSummary(
    description: payload.description,
    id: payload.id,
    imageURL: payload.imageUrl.flatMap(URL.init(string:)),
    language: payload.language,
    organization: makeCourseOrganization(payload.organization),
    slug: payload.slug,
    title: payload.title)
}

private func makeCourse(
  _ payload: Components.Schemas.CourseResource
) throws -> Course {
  Course(
    categories: try payload.categories.map(makeCourseCategory),
    description: payload.description,
    id: payload.id,
    imageURL: payload.imageUrl.flatMap(URL.init(string:)),
    language: payload.language,
    organization: makeCourseOrganization(payload.organization),
    slug: payload.slug,
    targetLanguage: payload.targetLanguage,
    title: payload.title)
}

private func makeCourseCategory(
  _ payload: Components.Schemas.CourseResource.CategoriesPayloadPayload
) throws -> CourseCategory {
  guard let category = CourseCategory(rawValue: payload.rawValue) else {
    throw CourseCatalogFailure.unavailable
  }

  return category
}

private func makeCourseOrganization(
  _ payload: Components.Schemas.OrganizationSummary
) -> CourseOrganization {
  CourseOrganization(
    id: payload.id,
    logoURL: payload.logo.flatMap(URL.init(string:)),
    name: payload.name,
    slug: payload.slug)
}

private func makeCourseChapter(
  _ payload: Components.Schemas.CourseChapter
) -> CourseChapter {
  CourseChapter(
    courseID: payload.courseId,
    description: payload.description,
    id: payload.id,
    imageURL: payload.imageUrl.flatMap(URL.init(string:)),
    language: payload.language,
    lessonCount: payload.lessonCount,
    position: payload.position,
    slug: payload.slug,
    title: payload.title)
}

private func makeCourseChapter(
  _ payload: Components.Schemas.ChapterResource
) -> CourseChapter {
  CourseChapter(
    courseID: payload.courseId,
    description: payload.description,
    id: payload.id,
    imageURL: payload.imageUrl.flatMap(URL.init(string:)),
    language: payload.language,
    lessonCount: nil,
    position: payload.position,
    slug: payload.slug,
    title: payload.title)
}

private func makeCourseLesson(
  _ payload: Components.Schemas.LessonResource
) throws -> CourseLesson {
  CourseLesson(
    chapterID: payload.chapterId,
    courseID: payload.courseId,
    description: payload.description,
    id: payload.id,
    imageURL: payload.imageUrl.flatMap(URL.init(string:)),
    kind: try makeLessonKind(payload.kind),
    language: payload.language,
    position: payload.position,
    slug: payload.slug,
    title: payload.title)
}

private func makeLessonKind(
  _ payload: Components.Schemas.LessonResource.KindPayload
) throws -> LessonKind {
  guard let kind = LessonKind(rawValue: payload.rawValue) else {
    throw CourseCatalogFailure.unavailable
  }

  return kind
}

private func makeCatalogContinuationTarget(
  _ payload: Components.Schemas.NextLessonResponse
) -> CatalogContinuationTarget {
  switch payload {
  case .chapter(let target):
    .chapter(
      CatalogChapterContinuation(
        canPrefetch: target.canPrefetch,
        chapterID: target.chapterId,
        chapterSlug: target.chapterSlug,
        completed: target.completed,
        courseID: target.courseId,
        courseSlug: target.courseSlug,
        hasStarted: target.hasStarted,
        organizationSlug: target.organizationSlug))
  case .empty(let target):
    .empty(
      CatalogEmptyContinuation(
        completed: target.completed,
        hasStarted: target.hasStarted))
  case .lesson(let target):
    .lesson(
      CatalogLessonContinuation(
        canPrefetch: target.canPrefetch,
        chapterID: target.chapterId,
        chapterSlug: target.chapterSlug,
        completed: target.completed,
        courseID: target.courseId,
        courseSlug: target.courseSlug,
        hasStarted: target.hasStarted,
        lessonID: target.lessonId,
        lessonPosition: target.lessonPosition,
        lessonSlug: target.lessonSlug,
        organizationSlug: target.organizationSlug))
  }
}

private func makeCourseProgress(
  _ payload: Components.Schemas.CourseCompletionResponse
) -> CourseProgress {
  CourseProgress(
    chapters: payload.chapters.map(makeCourseChapterProgress),
    percentComplete: payload.percentComplete)
}

private func makeCourseChapterProgress(
  _ payload: Components.Schemas.CourseCompletionResponse.ChaptersPayloadPayload
) -> CourseChapterProgress {
  CourseChapterProgress(
    chapterID: payload.chapterId,
    completedLessons: payload.completedLessons,
    totalLessons: payload.totalLessons)
}

private func makeChapterProgress(
  _ payload: Components.Schemas.ChapterCompletionResponse
) -> ChapterProgress {
  ChapterProgress(
    lessons: payload.lessons.map(makeChapterLessonProgress),
    percentComplete: payload.percentComplete)
}

private func makeChapterLessonProgress(
  _ payload: Components.Schemas.ChapterCompletionResponse.LessonsPayloadPayload
) -> ChapterLessonProgress {
  ChapterLessonProgress(
    isCompleted: payload.isCompleted,
    lessonID: payload.lessonId)
}

private func makeCatalogSearchResults(
  _ payload: Components.Schemas.CatalogSearchResponse
) -> CatalogSearchResults {
  CatalogSearchResults(
    chapters: payload.chapters.map(makeCatalogChapterSearchResult),
    courses: payload.courses.map(makeCatalogCourseSearchResult))
}

private func makeCatalogChapterSearchResult(
  _ payload: Components.Schemas.CatalogSearchResponse.ChaptersPayloadPayload
) -> CatalogChapterSearchResult {
  CatalogChapterSearchResult(
    courseID: payload.courseId,
    courseSlug: payload.courseSlug,
    courseTitle: payload.courseTitle,
    description: payload.description,
    id: payload.id,
    imageURL: payload.imageUrl.flatMap(URL.init(string:)),
    language: payload.language,
    organizationSlug: payload.organizationSlug,
    slug: payload.slug,
    title: payload.title)
}

private func makeCatalogCourseSearchResult(
  _ payload: Components.Schemas.CatalogSearchResponse.CoursesPayloadPayload
) -> CatalogCourseSearchResult {
  CatalogCourseSearchResult(
    description: payload.description,
    id: payload.id,
    imageURL: payload.imageUrl.flatMap(URL.init(string:)),
    language: payload.language,
    organizationSlug: payload.organizationSlug,
    slug: payload.slug,
    title: payload.title)
}
