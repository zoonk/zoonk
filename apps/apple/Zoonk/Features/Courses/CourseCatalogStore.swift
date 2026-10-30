import Foundation
import Observation

@MainActor
@Observable
final class CourseCatalogStore {
  /// Public content changes rarely; pull to refresh fetches it sooner.
  private static let catalogMaxAge = Duration.seconds(60 * 60)

  private(set) var isLoadingMore = false
  private(set) var loadMoreFailure: APIError?

  @ObservationIgnored private let api: any CourseCatalogAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored let language: String
  @ObservationIgnored private var chapters: [CatalogChapterKey: Resource<ChapterDetail>] = [:]
  @ObservationIgnored private var courseDetails: [String: Resource<CourseDetail>] = [:]
  @ObservationIgnored private var pages: [CourseCategory?: Resource<CourseCatalogPage>] = [:]
  @ObservationIgnored private var searches: [String: Resource<CatalogSearchResults>] = [:]

  @ObservationIgnored let categoryCounts: Resource<CourseCategoryCounts>

  init(api: any CourseCatalogAPIClient, language: String, cache: AppCache) {
    self.api = api
    self.cache = cache
    self.language = language
    categoryCounts = cache.resource(audience: .everyone, maxAge: Self.catalogMaxAge) { _ in
      try await api.countCourses(language: language)
    }
  }

  func courses(category: CourseCategory?) -> Resource<CourseCatalogPage> {
    if let resource = pages[category] {
      return resource
    }

    let query = CourseCatalogQuery(category: category, language: language)
    let resource: Resource<CourseCatalogPage> = cache.resource(
      audience: .everyone,
      maxAge: Self.catalogMaxAge,
      isEmpty: \.courses.isEmpty
    ) { [api] _ in
      try await api.listCourses(query: query)
    }
    pages[category] = resource
    return resource
  }

  func loadMoreCourses(category: CourseCategory?) async {
    let resource = courses(category: category)

    guard
      !isLoadingMore,
      case .loaded(let page) = resource.state,
      page.canLoadMore,
      let cursor = page.nextCursor
    else {
      return
    }

    let revision = resource.revision
    isLoadingMore = true
    loadMoreFailure = nil
    defer { isLoadingMore = false }

    do {
      let nextPage = try await api.listCourses(
        query: CourseCatalogQuery(category: category, cursor: cursor, language: language))

      guard resource.revision == revision else {
        return
      }

      resource.update { merge(currentPage: $0, nextPage: nextPage) }
    } catch {
      let error = apiError(from: error)

      guard resource.revision == revision, !(error is CancellationError) else {
        return
      }

      loadMoreFailure = error as? APIError ?? .unavailable
    }
  }

  func course(id: String) -> Resource<CourseDetail> {
    if let resource = courseDetails[id] {
      return resource
    }

    let resource: Resource<CourseDetail> = cache.resource(
      audience: .everyone,
      maxAge: Self.catalogMaxAge
    ) { [api] _ in
      async let loadingCourse = api.getCourse(id: id)
      async let loadingChapters = api.listCourseChapters(courseID: id)
      // The course first, so a missing course reads as not found whatever its chapters say.
      let (course, chapters) = try await (loadingCourse, loadingChapters)
      let tryLessonID = try await loadCatalogSupplement { () -> String? in
        guard let first = chapters.first else {
          return nil
        }

        return firstWrittenLessonID(
          try await api.listChapterLessons(CatalogChapterKey(chapterID: first.id, courseID: id)))
      }

      return CourseDetail(course: course, chapters: chapters, tryLessonID: tryLessonID ?? nil)
    }
    courseDetails[id] = resource
    return resource
  }

  /// A chapter that no longer exists also refreshes its course, so the course page stops listing it.
  func chapter(_ key: CatalogChapterKey) -> Resource<ChapterDetail> {
    if let resource = chapters[key] {
      return resource
    }

    let resource: Resource<ChapterDetail> = cache.resource(
      audience: .everyone,
      maxAge: Self.catalogMaxAge
    ) { [api, weak self] _ in
      do {
        return try await loadChapterDetail(api: api, key: key)
      } catch APIError.notFound {
        await self?.courseDetails[key.courseID]?.refresh()
        throw APIError.notFound
      }
    }
    chapters[key] = resource
    return resource
  }

  /// Nil for blank text.
  func search(query: String) -> Resource<CatalogSearchResults>? {
    guard let text = catalogText(query) else {
      return nil
    }

    if let resource = searches[text] {
      return resource
    }

    let query = CatalogSearchQuery(language: language, query: text)
    let resource: Resource<CatalogSearchResults> = cache.resource(
      audience: .everyone, isEmpty: \.isEmpty
    ) { [api] _ in
      try await api.searchCatalog(query: query)
    }
    searches[text] = resource
    return resource
  }

  private func merge(
    currentPage: CourseCatalogPage,
    nextPage: CourseCatalogPage
  ) -> CourseCatalogPage {
    var seenIDs = Set(currentPage.courses.map(\.id))

    return CourseCatalogPage(
      courses: currentPage.courses + nextPage.courses.filter { seenIDs.insert($0.id).inserted },
      hasMore: nextPage.hasMore,
      nextCursor: nextPage.nextCursor)
  }
}

private func loadChapterDetail(
  api: any CourseCatalogAPIClient,
  key: CatalogChapterKey
) async throws -> ChapterDetail {
  async let chapter = loadCatalogSupplement {
    try await api.getChapter(key)
  }
  let lessons = try await api.listChapterLessons(key)

  return try await ChapterDetail(chapter: chapter, lessons: lessons)
}

/// Its failure doesn't fail the page.
private func loadCatalogSupplement<Value: Sendable>(
  _ operation: @Sendable () async throws -> Value
) async throws -> Value? {
  do {
    return try await operation()
  } catch is CancellationError {
    throw CancellationError()
  } catch {
    return nil
  }
}
