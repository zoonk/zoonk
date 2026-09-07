import Foundation
import Observation

@MainActor
@Observable
final class MyCoursesStore {
  private(set) var coursesState: MyCoursesLoadState<MyCoursesPage> = .idle
  private(set) var coursesRevision: UUID?
  private(set) var isLoadingCourses = false
  private(set) var isLoadingMore = false
  private(set) var loadMoreFailure: MyCoursesFailure?

  private let api: any MyCoursesAPIClient
  private let session: SessionStore
  private var activeQuery: String?
  private var loadMoreRevision: UUID?
  private var sessionIdentity: AuthenticatedSession?

  init(api: any MyCoursesAPIClient, session: SessionStore) {
    self.api = api
    self.session = session
    sessionIdentity = session.authenticatedSession
  }

  func loadCoursesIfNeeded(query: String = "") async {
    synchronizeSession()

    guard catalogText(query) != activeQuery || canBeginCoursesRequest(force: false) else {
      return
    }

    await loadCourses(query: query)
  }

  func loadCourses(query: String = "", force: Bool = false) async {
    synchronizeSession()
    let normalizedQuery = catalogText(query)
    let queryChanged = normalizedQuery != activeQuery

    guard let authenticatedSession = session.authenticatedSession,
      queryChanged || canBeginCoursesRequest(force: force)
    else {
      return
    }

    let previousState: MyCoursesLoadState<MyCoursesPage> = queryChanged ? .idle : coursesState
    activeQuery = normalizedQuery
    let requestRevision = UUID()
    coursesRevision = requestRevision
    isLoadingCourses = true
    cancelPagination()
    coursesState = loadingState(from: previousState)

    defer {
      finishCoursesRequest(requestRevision)
    }

    do {
      let page = try await api.listCourses(
        request: MyCoursesRequest(
          query: MyCoursesQuery(query: normalizedQuery),
          token: authenticatedSession.bearerToken))

      guard
        isCurrentRequest((revision: requestRevision, session: authenticatedSession))
      else {
        synchronizeSession()
        return
      }

      coursesState = page.courses.isEmpty ? .empty : .loaded(page)
    } catch is CancellationError {
      guard
        isCurrentRequest((revision: requestRevision, session: authenticatedSession))
      else {
        synchronizeSession()
        return
      }

      coursesState = stateAfterCancellation(from: previousState)
    } catch MyCoursesAPIError.unauthorized {
      guard
        isCurrentRequest((revision: requestRevision, session: authenticatedSession))
      else {
        synchronizeSession()
        return
      }

      await session.expire(authenticatedSession)
      synchronizeSession()
    } catch MyCoursesAPIError.network {
      guard
        isCurrentRequest((revision: requestRevision, session: authenticatedSession))
      else {
        synchronizeSession()
        return
      }

      coursesState = stateAfterFailure((failure: .network, previousState: previousState))
    } catch {
      guard
        isCurrentRequest((revision: requestRevision, session: authenticatedSession))
      else {
        synchronizeSession()
        return
      }

      coursesState = stateAfterFailure((failure: .unavailable, previousState: previousState))
    }
  }

  func loadMoreCourses(force: Bool = false) async {
    synchronizeSession()

    guard
      let authenticatedSession = session.authenticatedSession,
      case .loaded(let currentPage) = coursesState,
      currentPage.canLoadMore,
      let cursor = currentPage.nextCursor,
      let coursesRevision,
      !isLoadingCourses,
      !isLoadingMore || force
    else {
      return
    }

    let paginationRevision = UUID()
    loadMoreRevision = paginationRevision
    isLoadingMore = true
    loadMoreFailure = nil

    defer {
      finishPaginationRequest(paginationRevision)
    }

    do {
      let nextPage = try await api.listCourses(
        request: MyCoursesRequest(
          query: MyCoursesQuery(cursor: cursor, query: activeQuery),
          token: authenticatedSession.bearerToken))

      guard
        isCurrentPaginationRequest(
          (
            coursesRevision: coursesRevision,
            paginationRevision: paginationRevision,
            session: authenticatedSession
          ))
      else {
        synchronizeSession()
        return
      }

      coursesState = .loaded(merge((currentPage: currentPage, nextPage: nextPage)))
    } catch is CancellationError {
      guard
        isCurrentPaginationRequest(
          (
            coursesRevision: coursesRevision,
            paginationRevision: paginationRevision,
            session: authenticatedSession
          ))
      else {
        synchronizeSession()
        return
      }
    } catch MyCoursesAPIError.unauthorized {
      guard
        isCurrentPaginationRequest(
          (
            coursesRevision: coursesRevision,
            paginationRevision: paginationRevision,
            session: authenticatedSession
          ))
      else {
        synchronizeSession()
        return
      }

      await session.expire(authenticatedSession)
      synchronizeSession()
    } catch MyCoursesAPIError.network {
      guard
        isCurrentPaginationRequest(
          (
            coursesRevision: coursesRevision,
            paginationRevision: paginationRevision,
            session: authenticatedSession
          ))
      else {
        synchronizeSession()
        return
      }

      loadMoreFailure = .network
    } catch {
      guard
        isCurrentPaginationRequest(
          (
            coursesRevision: coursesRevision,
            paginationRevision: paginationRevision,
            session: authenticatedSession
          ))
      else {
        synchronizeSession()
        return
      }

      loadMoreFailure = .unavailable
    }
  }

  private func canBeginCoursesRequest(force: Bool) -> Bool {
    force || (!isLoadingCourses && needsPresentationLoad(coursesState))
  }

  private func needsPresentationLoad(_ state: MyCoursesLoadState<MyCoursesPage>) -> Bool {
    switch state {
    case .idle, .loading, .failed:
      true
    case .loaded, .empty:
      false
    }
  }

  private func loadingState(
    from state: MyCoursesLoadState<MyCoursesPage>
  ) -> MyCoursesLoadState<MyCoursesPage> {
    switch state {
    case .loaded, .empty:
      state
    case .idle, .loading, .failed:
      .loading
    }
  }

  private func stateAfterCancellation(
    from state: MyCoursesLoadState<MyCoursesPage>
  ) -> MyCoursesLoadState<MyCoursesPage> {
    switch state {
    case .empty, .failed, .loaded:
      state
    case .idle, .loading:
      .idle
    }
  }

  private func stateAfterFailure(
    _ source: (
      failure: MyCoursesFailure,
      previousState: MyCoursesLoadState<MyCoursesPage>
    )
  ) -> MyCoursesLoadState<MyCoursesPage> {
    switch source.previousState {
    case .loaded, .empty:
      source.previousState
    case .idle, .loading, .failed:
      .failed(source.failure)
    }
  }

  private func isCurrentRequest(
    _ source: (revision: UUID, session: AuthenticatedSession)
  ) -> Bool {
    coursesRevision == source.revision && session.authenticatedSession == source.session
  }

  private func isCurrentPaginationRequest(
    _ source: (
      coursesRevision: UUID,
      paginationRevision: UUID,
      session: AuthenticatedSession
    )
  ) -> Bool {
    coursesRevision == source.coursesRevision
      && loadMoreRevision == source.paginationRevision
      && session.authenticatedSession == source.session
  }

  private func finishCoursesRequest(_ revision: UUID) {
    guard coursesRevision == revision else {
      return
    }

    isLoadingCourses = false
  }

  private func finishPaginationRequest(_ revision: UUID) {
    guard loadMoreRevision == revision else {
      return
    }

    isLoadingMore = false
    loadMoreRevision = nil
  }

  private func cancelPagination() {
    isLoadingMore = false
    loadMoreRevision = nil
    loadMoreFailure = nil
  }

  private func synchronizeSession() {
    let currentSessionIdentity = session.authenticatedSession

    guard currentSessionIdentity != sessionIdentity else {
      return
    }

    sessionIdentity = currentSessionIdentity
    activeQuery = nil
    coursesRevision = nil
    isLoadingCourses = false
    cancelPagination()
    coursesState = .idle
  }

  private func merge(
    _ source: (currentPage: MyCoursesPage, nextPage: MyCoursesPage)
  ) -> MyCoursesPage {
    MyCoursesPage(
      courses: appendingUniqueCourses(
        (
          currentCourses: source.currentPage.courses,
          candidates: source.nextPage.courses
        )),
      hasMore: source.nextPage.hasMore,
      nextCursor: source.nextPage.nextCursor)
  }

  private func appendingUniqueCourses(
    _ source: (
      currentCourses: [UserCourseSummary],
      candidates: [UserCourseSummary]
    )
  ) -> [UserCourseSummary] {
    let existingCourseIDs = Set(source.currentCourses.map(\.id))
    let uniqueCandidates = source.candidates.filter { !existingCourseIDs.contains($0.id) }
    return source.currentCourses + uniqueCandidates
  }
}
