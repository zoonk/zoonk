import Foundation
import Observation

private struct CourseCatalogRequest<Value: Codable & Equatable & Sendable>: Sendable {
  let isEmpty: @Sendable (Value) -> Bool
  let load: @Sendable (any CourseCatalogAPIClient) async throws -> Value
}

private enum CourseCatalogResource: Hashable, Sendable {
  case chapter(String)
  case course(String)
  case courses
  case search
}

private struct CourseCatalogRequestIdentity: Sendable {
  let resource: CourseCatalogResource
  let revision: UUID
}

@MainActor
@Observable
final class CourseCatalogStore {
  private(set) var coursesState: CourseCatalogLoadState<CourseCatalogPage> = .idle
  private(set) var searchState: CourseCatalogLoadState<CatalogSearchResults> = .idle
  private(set) var isLoadingMore = false
  private(set) var loadMoreFailure: CourseCatalogFailure?

  private let api: any CourseCatalogAPIClient
  private let language: String
  private let session: SessionStore
  private var activeCourseQuery: CourseCatalogQuery?
  private var activeRequests: Set<CourseCatalogResource> = []
  private var activeSearchQuery: CatalogSearchQuery?
  private var chapterStates: [String: CourseCatalogLoadState<ChapterDetail>] = [:]
  private var courseStates: [String: CourseCatalogLoadState<CourseDetail>] = [:]
  private var loadMoreRevision: UUID?
  private var requestRevisions: [CourseCatalogResource: UUID] = [:]
  private var sessionIdentity: AuthenticatedSession?

  init(
    api: any CourseCatalogAPIClient,
    language: String,
    session: SessionStore
  ) {
    self.api = api
    self.language = language
    self.session = session
    sessionIdentity = session.authenticatedSession
  }

  var isLoadingCourses: Bool {
    activeRequests.contains(.courses)
  }

  var isSearching: Bool {
    activeRequests.contains(.search)
  }

  func loadCoursesIfNeeded(category: CourseCategory?) async {
    let query = CourseCatalogQuery(category: category, language: language)

    guard query != activeCourseQuery || needsPresentationLoad(coursesState) else {
      return
    }

    await loadCourses(category: category, force: true)
  }

  func loadCourses(category: CourseCategory?, force: Bool = false) async {
    let query = CourseCatalogQuery(category: category, language: language)
    let queryChanged = query != activeCourseQuery

    guard
      queryChanged
        || canBeginRequest(resource: .courses, state: coursesState, force: force)
    else {
      return
    }

    activeCourseQuery = query
    isLoadingMore = false
    loadMoreRevision = nil
    loadMoreFailure = nil

    let requestIdentity = beginRequest(for: .courses)
    let previousState: CourseCatalogLoadState<CourseCatalogPage> =
      queryChanged ? .idle : coursesState
    coursesState = loadingState(from: previousState)
    let state = await load(
      CourseCatalogRequest(
        isEmpty: { $0.courses.isEmpty },
        load: { api in try await api.listCourses(query: query) }))

    guard isCurrent(requestIdentity), activeCourseQuery == query else {
      return
    }

    coursesState = stateAfterRequest(state, previousState: previousState)
    finishRequest(requestIdentity)
  }

  func loadMoreCourses(category: CourseCategory?, force: Bool = false) async {
    guard
      let activeCourseQuery,
      activeCourseQuery.category == category,
      case .loaded(let currentPage) = coursesState,
      currentPage.canLoadMore,
      let cursor = currentPage.nextCursor,
      !isLoadingCourses,
      !isLoadingMore || force,
      let catalogRevision = requestRevisions[.courses]
    else {
      return
    }

    isLoadingMore = true
    loadMoreFailure = nil
    let paginationRevision = UUID()
    loadMoreRevision = paginationRevision
    let nextQuery = CourseCatalogQuery(
      category: category,
      cursor: cursor,
      language: language)

    do {
      let nextPage = try await api.listCourses(query: nextQuery)

      guard
        isCurrentPaginationRequest(
          catalogRevision: catalogRevision,
          paginationRevision: paginationRevision)
      else {
        return
      }

      coursesState = .loaded(merge(currentPage: currentPage, nextPage: nextPage))
      isLoadingMore = false
      loadMoreRevision = nil
    } catch is CancellationError {
      guard
        isCurrentPaginationRequest(
          catalogRevision: catalogRevision,
          paginationRevision: paginationRevision)
      else {
        return
      }

      isLoadingMore = false
      loadMoreRevision = nil
    } catch let failure as CourseCatalogFailure {
      guard
        isCurrentPaginationRequest(
          catalogRevision: catalogRevision,
          paginationRevision: paginationRevision)
      else {
        return
      }

      isLoadingMore = false
      loadMoreRevision = nil
      loadMoreFailure = failure
    } catch {
      guard
        isCurrentPaginationRequest(
          catalogRevision: catalogRevision,
          paginationRevision: paginationRevision)
      else {
        return
      }

      isLoadingMore = false
      loadMoreRevision = nil
      loadMoreFailure = .unavailable
    }
  }

  func courseState(for id: String) -> CourseCatalogLoadState<CourseDetail> {
    courseStates[id] ?? .idle
  }

  func loadCourseIfNeeded(id: String) async {
    synchronizeSession()

    guard needsPresentationLoad(courseState(for: id)) else {
      return
    }

    await loadCourse(id: id, force: true)
  }

  func loadCourse(id: String, force: Bool = false) async {
    synchronizeSession()
    let authenticatedSession = session.authenticatedSession
    let resource = CourseCatalogResource.course(id)
    let previousState = courseState(for: id)

    guard canBeginRequest(resource: resource, state: previousState, force: force) else {
      return
    }

    let requestIdentity = beginRequest(for: resource)
    courseStates[id] = loadingState(from: previousState)
    let state = await load(
      CourseCatalogRequest(
        isEmpty: { _ in false },
        load: { api in
          async let course = api.getCourse(id: id)
          async let chapters = api.listCourseChapters(courseID: id)
          async let continuation = loadCatalogSupplement {
            try await api.getCourseNextLesson(
              courseID: id,
              token: authenticatedSession?.bearerToken)
          }
          async let progress = loadCatalogSupplement {
            try await api.getCourseProgress(
              courseID: id,
              token: authenticatedSession?.bearerToken)
          }
          let (loadedCourse, loadedChapters, loadedContinuation, loadedProgress) =
            try await (course, chapters, continuation, progress)
          return CourseDetail(
            continuation: loadedContinuation,
            course: loadedCourse,
            chapters: loadedChapters,
            progress: loadedProgress)
        }))

    guard isCurrent(requestIdentity), session.authenticatedSession == authenticatedSession else {
      synchronizeSession()
      return
    }

    courseStates[id] = stateAfterRequest(state, previousState: previousState)
    finishRequest(requestIdentity)
  }

  func chapterState(for id: String) -> CourseCatalogLoadState<ChapterDetail> {
    chapterStates[id] ?? .idle
  }

  func loadChapterIfNeeded(id: String) async {
    synchronizeSession()

    guard needsPresentationLoad(chapterState(for: id)) else {
      return
    }

    await loadChapter(id: id, force: true)
  }

  func loadChapter(id: String, force: Bool = false) async {
    synchronizeSession()
    let authenticatedSession = session.authenticatedSession
    let resource = CourseCatalogResource.chapter(id)
    let previousState = chapterState(for: id)

    guard canBeginRequest(resource: resource, state: previousState, force: force) else {
      return
    }

    let requestIdentity = beginRequest(for: resource)
    chapterStates[id] = loadingState(from: previousState)
    let state = await load(
      CourseCatalogRequest(
        isEmpty: { _ in false },
        load: { api in
          async let chapter = loadCatalogSupplement {
            try await api.getChapter(id: id)
          }
          async let lessons = api.listChapterLessons(chapterID: id)
          async let continuation = loadCatalogSupplement {
            try await api.getChapterNextLesson(
              chapterID: id,
              token: authenticatedSession?.bearerToken)
          }
          async let progress = loadCatalogSupplement {
            try await api.getChapterProgress(
              chapterID: id,
              token: authenticatedSession?.bearerToken)
          }
          let (loadedChapter, loadedLessons, loadedContinuation, loadedProgress) =
            try await (chapter, lessons, continuation, progress)
          return ChapterDetail(
            chapter: loadedChapter,
            continuation: loadedContinuation,
            lessons: loadedLessons,
            progress: loadedProgress)
        }))

    guard isCurrent(requestIdentity), session.authenticatedSession == authenticatedSession else {
      synchronizeSession()
      return
    }

    chapterStates[id] = stateAfterRequest(state, previousState: previousState)
    finishRequest(requestIdentity)
  }

  func searchCatalog(query: String, force: Bool = false) async {
    let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !normalizedQuery.isEmpty else {
      clearSearch()
      return
    }

    let query = CatalogSearchQuery(language: language, query: normalizedQuery)
    let queryChanged = query != activeSearchQuery

    guard
      queryChanged
        || canBeginRequest(resource: .search, state: searchState, force: force)
    else {
      return
    }

    activeSearchQuery = query
    let requestIdentity = beginRequest(for: .search)
    let previousState: CourseCatalogLoadState<CatalogSearchResults> =
      queryChanged ? .idle : searchState
    searchState = loadingState(from: previousState)
    let state = await load(
      CourseCatalogRequest(
        isEmpty: \.isEmpty,
        load: { api in try await api.searchCatalog(query: query) }))

    guard isCurrent(requestIdentity), activeSearchQuery == query else {
      return
    }

    searchState = stateAfterRequest(state, previousState: previousState)
    finishRequest(requestIdentity)
  }

  func clearSearch() {
    activeSearchQuery = nil
    activeRequests.remove(.search)
    requestRevisions.removeValue(forKey: .search)
    searchState = .idle
  }

  private func beginRequest(
    for resource: CourseCatalogResource
  ) -> CourseCatalogRequestIdentity {
    let requestIdentity = CourseCatalogRequestIdentity(resource: resource, revision: UUID())
    requestRevisions[resource] = requestIdentity.revision
    activeRequests.insert(resource)
    return requestIdentity
  }

  private func finishRequest(_ requestIdentity: CourseCatalogRequestIdentity) {
    activeRequests.remove(requestIdentity.resource)
  }

  private func isCurrent(_ requestIdentity: CourseCatalogRequestIdentity) -> Bool {
    isCurrent(resource: requestIdentity.resource, revision: requestIdentity.revision)
  }

  private func isCurrent(resource: CourseCatalogResource, revision: UUID) -> Bool {
    requestRevisions[resource] == revision
  }

  private func isCurrentPaginationRequest(
    catalogRevision: UUID,
    paginationRevision: UUID
  ) -> Bool {
    isCurrent(resource: .courses, revision: catalogRevision)
      && loadMoreRevision == paginationRevision
  }

  private func synchronizeSession() {
    let currentSessionIdentity = session.authenticatedSession

    guard currentSessionIdentity != sessionIdentity else {
      return
    }

    sessionIdentity = currentSessionIdentity
    requestRevisions = requestRevisions.filter { entry in
      entry.key == .courses || entry.key == .search
    }
    activeRequests = Set(
      activeRequests.filter { resource in
        resource == .courses || resource == .search
      })
    chapterStates.removeAll()
    courseStates.removeAll()
  }

  private func load<Value>(
    _ request: CourseCatalogRequest<Value>
  ) async -> CourseCatalogLoadState<Value>? {
    do {
      let value = try await request.load(api)
      return request.isEmpty(value) ? .empty : .loaded(value)
    } catch is CancellationError {
      return nil
    } catch let failure as CourseCatalogFailure {
      return .failed(failure)
    } catch {
      return .failed(.unavailable)
    }
  }

  private func canBeginRequest<Value>(
    resource: CourseCatalogResource,
    state: CourseCatalogLoadState<Value>,
    force: Bool
  ) -> Bool {
    force || (!activeRequests.contains(resource) && needsPresentationLoad(state))
  }

  private func needsPresentationLoad<Value>(
    _ state: CourseCatalogLoadState<Value>
  ) -> Bool {
    switch state {
    case .idle, .loading, .failed:
      true
    case .loaded, .empty:
      false
    }
  }

  private func loadingState<Value>(
    from state: CourseCatalogLoadState<Value>
  ) -> CourseCatalogLoadState<Value> {
    switch state {
    case .loaded, .empty:
      state
    case .idle, .loading, .failed:
      .loading
    }
  }

  private func stateAfterCancellation<Value>(
    from state: CourseCatalogLoadState<Value>
  ) -> CourseCatalogLoadState<Value> {
    switch state {
    case .empty, .failed, .loaded:
      state
    case .idle, .loading:
      .idle
    }
  }

  private func stateAfterRequest<Value>(
    _ requestState: CourseCatalogLoadState<Value>?,
    previousState: CourseCatalogLoadState<Value>
  ) -> CourseCatalogLoadState<Value> {
    guard let requestState else {
      return stateAfterCancellation(from: previousState)
    }

    guard case .failed(let failure) = requestState, failure != .notFound else {
      return requestState
    }

    switch previousState {
    case .loaded, .empty:
      return previousState
    case .idle, .loading, .failed:
      return requestState
    }
  }

  private func merge(
    currentPage: CourseCatalogPage,
    nextPage: CourseCatalogPage
  ) -> CourseCatalogPage {
    return CourseCatalogPage(
      courses: appendingUniqueCourses(
        currentCourses: currentPage.courses,
        candidates: nextPage.courses),
      hasMore: nextPage.hasMore,
      nextCursor: nextPage.nextCursor)
  }

  private func appendingUniqueCourses(
    currentCourses: [CourseSummary],
    candidates: [CourseSummary]
  ) -> [CourseSummary] {
    guard let candidate = candidates.first else {
      return currentCourses
    }

    let remainingCandidates = Array(candidates.dropFirst())

    guard !currentCourses.contains(where: { $0.id == candidate.id }) else {
      return appendingUniqueCourses(
        currentCourses: currentCourses,
        candidates: remainingCandidates)
    }

    return appendingUniqueCourses(
      currentCourses: currentCourses + [candidate],
      candidates: remainingCandidates)
  }
}

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
