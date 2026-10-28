import XCTest

@testable import Zoonk

extension CourseCatalogStore {
  fileprivate convenience init(
    api: any CourseCatalogAPIClient,
    language: String,
    session: SessionStore = .preview()
  ) {
    self.init(api: api, language: language, cache: AppCache(session: session))
  }
}

@MainActor
final class CourseCatalogStoreTests: XCTestCase {
  func testStoreStartsIdle() {
    let store = CourseCatalogStore(api: CourseCatalogAPIStub(), language: "en")

    XCTAssertEqual(store.courses(category: nil).state, .idle)
    XCTAssertEqual(store.course(id: Course.testFixture.id).state, .idle)
    XCTAssertEqual(store.chapter(.testFixture).state, .idle)
    XCTAssertEqual(store.searchState, .idle)
    XCTAssertFalse(store.isLoadingMore)
    XCTAssertNil(store.loadMoreFailure)
  }

  func testCategoryPageLoadsWithItsQueryOnce() async {
    let page = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: true,
      nextCursor: "next-page")
    let api = CourseCatalogAPIStub(coursePageResults: [.success(page)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.courses(category: .science).load()
    await store.courses(category: .science).load()

    XCTAssertEqual(store.courses(category: .science).state, .loaded(page))
    let queries = await api.courseQueries
    XCTAssertEqual(queries, [CourseCatalogQuery(category: .science, language: "en")])
  }

  func testEmptyCategoryIsEmpty() async {
    let api = CourseCatalogAPIStub(
      coursePageResults: [
        .success(CourseCatalogPage(courses: [], hasMore: false, nextCursor: nil))
      ])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.courses(category: nil).load()

    XCTAssertEqual(store.courses(category: nil).state, .empty)
  }

  func testEachCategoryKeepsItsPageWhenSwitchingBack() async {
    let sciencePage = CourseCatalogPage(courses: [.testFixture], hasMore: false, nextCursor: nil)
    let technologyPage = CourseCatalogPage(
      courses: [.secondTestFixture], hasMore: false, nextCursor: nil)
    let api = CourseCatalogAPIStub(
      coursePageResults: [.success(sciencePage), .success(technologyPage)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.courses(category: .science).load()
    await store.courses(category: .tech).load()
    await store.courses(category: .science).load()

    XCTAssertEqual(store.courses(category: .science).state, .loaded(sciencePage))
    XCTAssertEqual(store.courses(category: .tech).state, .loaded(technologyPage))
    let queries = await api.courseQueries
    XCTAssertEqual(queries.map(\.category), [.science, .tech])
  }

  func testLoadMoreMergesUniqueStableCourseIDs() async {
    let firstPage = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: true,
      nextCursor: "page-two")
    let secondPage = CourseCatalogPage(
      courses: [.testFixture, .secondTestFixture, .secondTestFixture],
      hasMore: false,
      nextCursor: nil)
    let api = CourseCatalogAPIStub(
      coursePageResults: [.success(firstPage), .success(secondPage)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.courses(category: .science).load()
    await store.loadMoreCourses(category: .science)

    XCTAssertEqual(
      store.courses(category: .science).state,
      .loaded(
        CourseCatalogPage(
          courses: [.testFixture, .secondTestFixture],
          hasMore: false,
          nextCursor: nil)))
    XCTAssertFalse(store.isLoadingMore)
    XCTAssertNil(store.loadMoreFailure)
    let queries = await api.courseQueries
    XCTAssertEqual(queries.last?.cursor, "page-two")
  }

  func testLoadMoreFailurePreservesLoadedCourses() async {
    let firstPage = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: true,
      nextCursor: "page-two")
    let api = CourseCatalogAPIStub(
      coursePageResults: [.success(firstPage), .failure(APIError.network)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.courses(category: nil).load()
    await store.loadMoreCourses(category: nil)

    XCTAssertEqual(store.courses(category: nil).state, .loaded(firstPage))
    XCTAssertEqual(store.loadMoreFailure, .network)
    XCTAssertFalse(store.isLoadingMore)
  }

  func testCancelledLoadMorePreservesLoadedCoursesWithoutFailure() async {
    let firstPage = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: true,
      nextCursor: "page-two")
    let api = CourseCatalogAPIStub(
      coursePageResults: [.success(firstPage), .failure(CancellationError())])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.courses(category: nil).load()
    await store.loadMoreCourses(category: nil)

    XCTAssertEqual(store.courses(category: nil).state, .loaded(firstPage))
    XCTAssertNil(store.loadMoreFailure)
  }

  func testANextPageForARefreshedFirstPageIsDropped() async {
    let paginationStarted = expectation(description: "Pagination request started")
    let refreshStarted = expectation(description: "Refresh request started")
    let api = SuspendedCourseCatalogAPI { requestCount in
      if requestCount == 2 {
        paginationStarted.fulfill()
      } else if requestCount == 3 {
        refreshStarted.fulfill()
      }
    }
    let store = CourseCatalogStore(api: api, language: "en")
    let firstPage = CourseCatalogPage(courses: [.testFixture], hasMore: true, nextCursor: "two")
    let refreshedPage = CourseCatalogPage(
      courses: [.secondTestFixture], hasMore: true, nextCursor: "two")
    let resource = store.courses(category: nil)

    let load = Task { await resource.load() }
    await waitForCourseRequests(1, in: api)
    await api.resolveCourseRequest(at: 0, with: firstPage)
    await load.value

    let pagination = Task { await store.loadMoreCourses(category: nil) }
    await fulfillment(of: [paginationStarted], timeout: 1)
    let refresh = Task { await resource.refresh() }
    await fulfillment(of: [refreshStarted], timeout: 1)
    await api.resolveCourseRequest(at: 2, with: refreshedPage)
    await refresh.value
    await api.resolveCourseRequest(
      at: 1,
      with: CourseCatalogPage(courses: [.testFixture], hasMore: false, nextCursor: nil))
    await pagination.value

    XCTAssertEqual(resource.state, .loaded(refreshedPage))
  }

  func testCourseDetailLoadsCourseAndChaptersConcurrently() async {
    let courseStarted = expectation(description: "Course request started")
    let chaptersStarted = expectation(description: "Chapters request started")
    let api = SuspendedCourseDetailAPI(
      chaptersDidStart: { chaptersStarted.fulfill() },
      courseDidStart: { courseStarted.fulfill() })
    let store = CourseCatalogStore(api: api, language: "en")

    let request = Task { await store.course(id: Course.testFixture.id).load() }
    await fulfillment(of: [courseStarted, chaptersStarted], timeout: 1)
    await api.resolveCourse(with: .testFixture)
    await api.resolveChapters(with: [.testFixture])
    await request.value

    XCTAssertEqual(
      store.course(id: Course.testFixture.id).state,
      .loaded(CourseDetail(course: .testFixture, chapters: [.testFixture])))
  }

  func testCourseDetailLoadsEverythingWithTheCurrentSession() async {
    let session = SessionStore.preview(account: makeCourseCatalogTestAccount())
    let api = CourseCatalogAPIStub(
      chapterResults: [.success([.testFixture])],
      courseContinuationResults: [.success(.testLessonFixture)],
      courseProgressResults: [.success(.testFixture)],
      courseResults: [.success(.testFixture)])
    let store = CourseCatalogStore(api: api, language: "en", session: session)

    await store.course(id: Course.testFixture.id).load()

    XCTAssertEqual(
      store.course(id: Course.testFixture.id).state,
      .loaded(
        CourseDetail(
          continuation: .testLessonFixture,
          course: .testFixture,
          chapters: [.testFixture],
          progress: .testFixture)))
    let courseReadTokens = await api.courseReadTokens
    let continuationTokens = await api.courseContinuationTokens
    let progressTokens = await api.courseProgressTokens
    XCTAssertEqual(courseReadTokens, ["preview-session"])
    XCTAssertEqual(continuationTokens, ["preview-session"])
    XCTAssertEqual(progressTokens, ["preview-session"])
  }

  func testSupplementalCourseFailureDoesNotHideBaseCatalogContent() async {
    let api = CourseCatalogAPIStub(
      chapterResults: [.success([.testFixture])],
      courseContinuationResults: [.failure(APIError.network)],
      courseProgressResults: [.failure(APIError.unavailable)],
      courseResults: [.success(.testFixture)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.course(id: Course.testFixture.id).load()

    XCTAssertEqual(
      store.course(id: Course.testFixture.id).state,
      .loaded(CourseDetail(course: .testFixture, chapters: [.testFixture])))
  }

  func testSessionChangeReloadsCourseDetailForTheNewReader() async throws {
    let session = SessionStore.preview(account: makeCourseCatalogTestAccount())
    let api = CourseCatalogAPIStub(
      chapterResults: [.success([.testFixture]), .success([.testFixture])],
      courseContinuationResults: [.success(.testLessonFixture)],
      courseProgressResults: [.success(.testFixture)],
      courseResults: [.success(.testFixture), .success(.testFixture)])
    let store = CourseCatalogStore(api: api, language: "en", session: session)

    await store.course(id: Course.testFixture.id).load()
    await session.expire(try XCTUnwrap(session.authenticatedSession))
    XCTAssertEqual(store.course(id: Course.testFixture.id).state, .idle)
    await store.course(id: Course.testFixture.id).load()

    let courseReadTokens = await api.courseReadTokens
    XCTAssertEqual(courseReadTokens, ["preview-session", nil])
    XCTAssertEqual(
      store.course(id: Course.testFixture.id).state,
      .loaded(CourseDetail(course: .testFixture, chapters: [.testFixture])))
  }

  func testMissingCoursePublishesNotFound() async {
    let api = CourseCatalogAPIStub(courseResults: [.failure(APIError.notFound)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.course(id: Course.testFixture.id).load()

    XCTAssertEqual(store.course(id: Course.testFixture.id).state, .failed(.notFound))
  }

  func testChapterDetailLoadsLessonsWithTheCurrentSession() async {
    let session = SessionStore.preview(account: makeCourseCatalogTestAccount())
    let api = CourseCatalogAPIStub(
      chapterContinuationResults: [.success(.testLessonFixture)],
      chapterProgressResults: [.success(.testFixture)],
      lessonResults: [.success([.testFixture])])
    let store = CourseCatalogStore(api: api, language: "en", session: session)

    await store.chapter(.testFixture).load()

    XCTAssertEqual(
      store.chapter(.testFixture).state,
      .loaded(
        ChapterDetail(
          chapter: .resourceTestFixture,
          continuation: .testLessonFixture,
          lessons: [.testFixture],
          progress: .testFixture)))
    let continuationTokens = await api.chapterContinuationTokens
    let progressTokens = await api.chapterProgressTokens
    XCTAssertEqual(continuationTokens, ["preview-session"])
    XCTAssertEqual(progressTokens, ["preview-session"])
  }

  func testMissingChapterRefreshesTheCourseItWasOpenedFrom() async {
    let api = CourseCatalogAPIStub(
      chapterResults: [.success([.testFixture]), .success([])],
      courseResults: [.success(.testFixture), .success(.testFixture)],
      lessonResults: [.failure(APIError.notFound)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.course(id: Course.testFixture.id).load()
    await store.chapter(.testFixture).load()

    XCTAssertEqual(store.chapter(.testFixture).state, .failed(.notFound))
    XCTAssertEqual(
      store.course(id: Course.testFixture.id).state,
      .loaded(CourseDetail(course: .testFixture, chapters: [])))
    let courseRequestCount = await api.courseRequestCount
    XCTAssertEqual(courseRequestCount, 2)
  }

  func testMissingChapterDoesNotLoadACourseThatWasNeverOpened() async {
    let api = CourseCatalogAPIStub(lessonResults: [.failure(APIError.notFound)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.chapter(.testFixture).load()

    XCTAssertEqual(store.chapter(.testFixture).state, .failed(.notFound))
    let courseRequestCount = await api.courseRequestCount
    XCTAssertEqual(courseRequestCount, 0)
  }

  func testCatalogSearchPublishesGroupedResultsWithAnAnonymousRequest() async {
    let api = CourseCatalogAPIStub(searchResults: [.success(.testFixture)])
    let store = CourseCatalogStore(
      api: api,
      language: "en",
      session: .preview(account: makeCourseCatalogTestAccount()))

    await store.searchCatalog(query: "  stars  ")

    XCTAssertEqual(store.searchState, .loaded(.testFixture))
    let searchQueries = await api.searchQueries
    XCTAssertEqual(searchQueries, [CatalogSearchQuery(language: "en", query: "stars")])
  }

  func testBlankCatalogSearchReturnsToIdleWithoutRequestingTheAPI() async {
    let api = CourseCatalogAPIStub(searchResults: [.success(.testFixture)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.searchCatalog(query: "  \n")

    XCTAssertEqual(store.searchState, .idle)
    let searchQueries = await api.searchQueries
    XCTAssertEqual(searchQueries, [])
  }

  func testPreparingANewQueryClearsPreviousSearchFeedbackBeforeRequesting() async {
    let responses: [Result<CatalogSearchResults, Error>] = [
      .success(.testFixture),
      .success(CatalogSearchResults(chapters: [], courses: [])),
      .failure(APIError.network),
    ]

    for response in responses {
      let api = CourseCatalogAPIStub(searchResults: [response, .success(.testFixture)])
      let store = CourseCatalogStore(api: api, language: "en")
      await store.searchCatalog(query: "stars")
      XCTAssertNotEqual(store.searchState, .idle)

      store.prepareSearch(query: "planets")

      XCTAssertEqual(store.searchState, .idle)
      await store.searchCatalog(query: "planets")
      XCTAssertEqual(store.searchState, .loaded(.testFixture))
      let queries = await api.searchQueries
      XCTAssertEqual(queries.map(\.query), ["stars", "planets"])
    }
  }

  func testPreparingTheSameNormalizedQueryPreservesSearchResults() async {
    let api = CourseCatalogAPIStub(searchResults: [.success(.testFixture)])
    let store = CourseCatalogStore(api: api, language: "en")
    await store.searchCatalog(query: "stars")

    store.prepareSearch(query: "  stars\n")
    await store.searchCatalog(query: "stars")

    XCTAssertEqual(store.searchState, .loaded(.testFixture))
    let queries = await api.searchQueries
    XCTAssertEqual(queries, [CatalogSearchQuery(language: "en", query: "stars")])
  }

  func testLateCatalogSearchCannotReplaceANewerQuery() async {
    let firstSearchStarted = expectation(description: "First catalog search started")
    let secondSearchStarted = expectation(description: "Second catalog search started")
    let api = SuspendedCourseCatalogAPI(
      { _ in },
      searchDidStart: { requestCount in
        if requestCount == 1 {
          firstSearchStarted.fulfill()
        } else if requestCount == 2 {
          secondSearchStarted.fulfill()
        }
      })
    let store = CourseCatalogStore(api: api, language: "en")

    let firstSearch = Task { await store.searchCatalog(query: "stars") }
    await fulfillment(of: [firstSearchStarted], timeout: 1)
    let secondSearch = Task { await store.searchCatalog(query: "planets") }
    await fulfillment(of: [secondSearchStarted], timeout: 1)

    await api.resolveSearchRequest(at: 1, with: .testFixture)
    await secondSearch.value
    await api.resolveSearchRequest(at: 0, with: CatalogSearchResults(chapters: [], courses: []))
    await firstSearch.value

    XCTAssertEqual(store.searchState, .loaded(.testFixture))
  }

  private func waitForCourseRequests(_ count: Int, in api: SuspendedCourseCatalogAPI) async {
    for _ in 0..<1_000 {
      if await api.courseRequestCount >= count {
        return
      }

      await Task.yield()
    }

    XCTFail("Expected \(count) course requests")
  }
}

private actor CourseCatalogAPIStub: CourseCatalogAPIClient {
  private var chapterDetailResults: [Result<CourseChapter, Error>]
  private var chapterContinuationResults: [Result<CatalogContinuationTarget, Error>]
  private var chapterProgressResults: [Result<ChapterProgress, Error>]
  private var chapterResults: [Result<[CourseChapter], Error>]
  private var courseContinuationResults: [Result<CatalogContinuationTarget, Error>]
  private var coursePageResults: [Result<CourseCatalogPage, Error>]
  private var courseProgressResults: [Result<CourseProgress, Error>]
  private var courseResults: [Result<Course, Error>]
  private var lessonResults: [Result<[CourseLesson], Error>]
  private var searchResults: [Result<CatalogSearchResults, Error>]
  private(set) var chapterContinuationTokens: [String?] = []
  private(set) var chapterProgressTokens: [String?] = []
  private(set) var courseContinuationTokens: [String?] = []
  private(set) var courseProgressTokens: [String?] = []
  private(set) var courseQueries: [CourseCatalogQuery] = []
  private(set) var chapterKeys: [CatalogChapterKey] = []
  private(set) var courseReadTokens: [String?] = []
  private(set) var chapterListRequestCount = 0
  private(set) var chapterRequestCount = 0
  private(set) var courseRequestCount = 0
  private(set) var lessonListRequestCount = 0
  private(set) var searchQueries: [CatalogSearchQuery] = []

  init(
    chapterDetailResults: [Result<CourseChapter, Error>] = [.success(.resourceTestFixture)],
    chapterContinuationResults: [Result<CatalogContinuationTarget, Error>] = [],
    chapterProgressResults: [Result<ChapterProgress, Error>] = [],
    chapterResults: [Result<[CourseChapter], Error>] = [],
    courseContinuationResults: [Result<CatalogContinuationTarget, Error>] = [],
    coursePageResults: [Result<CourseCatalogPage, Error>] = [],
    courseProgressResults: [Result<CourseProgress, Error>] = [],
    courseResults: [Result<Course, Error>] = [],
    lessonResults: [Result<[CourseLesson], Error>] = [],
    searchResults: [Result<CatalogSearchResults, Error>] = []
  ) {
    self.chapterDetailResults = chapterDetailResults
    self.chapterContinuationResults = chapterContinuationResults
    self.chapterProgressResults = chapterProgressResults
    self.chapterResults = chapterResults
    self.courseContinuationResults = courseContinuationResults
    self.coursePageResults = coursePageResults
    self.courseProgressResults = courseProgressResults
    self.courseResults = courseResults
    self.lessonResults = lessonResults
    self.searchResults = searchResults
  }

  func listCourses(query: CourseCatalogQuery) async throws -> CourseCatalogPage {
    courseQueries.append(query)
    return try takeFirstResult(from: &coursePageResults).get()
  }

  func getCourse(id: String, token: String?) async throws -> Course {
    courseRequestCount += 1
    courseReadTokens.append(token)
    return try takeFirstResult(from: &courseResults).get()
  }

  func getChapter(_ key: CatalogChapterKey, token: String?) async throws -> CourseChapter {
    chapterRequestCount += 1
    chapterKeys.append(key)
    return try takeFirstResult(from: &chapterDetailResults).get()
  }

  func listCourseChapters(courseID: String, token: String?) async throws -> [CourseChapter] {
    chapterListRequestCount += 1
    return try takeFirstResult(from: &chapterResults).get()
  }

  func listChapterLessons(_ key: CatalogChapterKey, token: String?) async throws
    -> [CourseLesson]
  {
    lessonListRequestCount += 1
    chapterKeys.append(key)
    return try takeFirstResult(from: &lessonResults).get()
  }

  func getCourseNextLesson(courseID: String, token: String?) async throws
    -> CatalogContinuationTarget
  {
    courseContinuationTokens.append(token)
    return try takeFirstResult(from: &courseContinuationResults).get()
  }

  func getChapterNextLesson(_ key: CatalogChapterKey, token: String?) async throws
    -> CatalogContinuationTarget
  {
    chapterContinuationTokens.append(token)
    chapterKeys.append(key)
    return try takeFirstResult(from: &chapterContinuationResults).get()
  }

  func getCourseProgress(courseID: String, token: String?) async throws -> CourseProgress {
    courseProgressTokens.append(token)
    return try takeFirstResult(from: &courseProgressResults).get()
  }

  func getChapterProgress(chapterID: String, token: String?) async throws -> ChapterProgress {
    chapterProgressTokens.append(token)
    return try takeFirstResult(from: &chapterProgressResults).get()
  }

  func searchCatalog(query: CatalogSearchQuery) async throws -> CatalogSearchResults {
    searchQueries.append(query)
    return try takeFirstResult(from: &searchResults).get()
  }

  private func takeFirstResult<Value>(
    from results: inout [Result<Value, Error>]
  ) -> Result<Value, Error> {
    guard !results.isEmpty else {
      return .failure(APIError.unavailable)
    }

    return results.removeFirst()
  }
}

private actor SuspendedCourseCatalogAPI: CourseCatalogAPIClient {
  private struct CourseRequest {
    let continuation: CheckedContinuation<CourseCatalogPage, any Error>
  }

  private struct SearchRequest {
    let continuation: CheckedContinuation<CatalogSearchResults, any Error>
  }

  private let requestDidStart: @Sendable (Int) -> Void
  private let searchDidStart: @Sendable (Int) -> Void
  private var requests: [CourseRequest?] = []
  private var searchRequests: [SearchRequest?] = []

  var courseRequestCount: Int {
    requests.count
  }

  init(
    _ requestDidStart: @escaping @Sendable (Int) -> Void,
    searchDidStart: @escaping @Sendable (Int) -> Void = { _ in }
  ) {
    self.requestDidStart = requestDidStart
    self.searchDidStart = searchDidStart
  }

  func resolveCourseRequest(at index: Int, with page: CourseCatalogPage) {
    requests[index]?.continuation.resume(returning: page)
    requests[index] = nil
  }

  func failCourseRequest(at index: Int, with error: any Error) {
    requests[index]?.continuation.resume(throwing: error)
    requests[index] = nil
  }

  func resolveSearchRequest(at index: Int, with results: CatalogSearchResults) {
    searchRequests[index]?.continuation.resume(returning: results)
    searchRequests[index] = nil
  }

  func listCourses(query: CourseCatalogQuery) async throws -> CourseCatalogPage {
    try await withCheckedThrowingContinuation { continuation in
      requests.append(CourseRequest(continuation: continuation))
      requestDidStart(requests.count)
    }
  }

  func getCourse(id: String, token: String?) async throws -> Course {
    throw APIError.unavailable
  }

  func getChapter(_ key: CatalogChapterKey, token: String?) async throws -> CourseChapter {
    throw APIError.unavailable
  }

  func listCourseChapters(courseID: String, token: String?) async throws -> [CourseChapter] {
    throw APIError.unavailable
  }

  func listChapterLessons(_ key: CatalogChapterKey, token: String?) async throws
    -> [CourseLesson]
  {
    throw APIError.unavailable
  }

  func getCourseNextLesson(courseID: String, token: String?) async throws
    -> CatalogContinuationTarget
  {
    throw APIError.unavailable
  }

  func getChapterNextLesson(_ key: CatalogChapterKey, token: String?) async throws
    -> CatalogContinuationTarget
  {
    throw APIError.unavailable
  }

  func getCourseProgress(courseID: String, token: String?) async throws -> CourseProgress {
    throw APIError.unavailable
  }

  func getChapterProgress(chapterID: String, token: String?) async throws -> ChapterProgress {
    throw APIError.unavailable
  }

  func searchCatalog(query: CatalogSearchQuery) async throws -> CatalogSearchResults {
    try await withCheckedThrowingContinuation { continuation in
      searchRequests.append(SearchRequest(continuation: continuation))
      searchDidStart(searchRequests.count)
    }
  }
}

private actor SuspendedCourseDetailAPI: CourseCatalogAPIClient {
  private let chaptersDidStart: @Sendable () -> Void
  private let courseDidStart: @Sendable () -> Void
  private var chaptersContinuation: CheckedContinuation<[CourseChapter], any Error>?
  private var courseContinuation: CheckedContinuation<Course, any Error>?

  init(
    chaptersDidStart: @escaping @Sendable () -> Void,
    courseDidStart: @escaping @Sendable () -> Void
  ) {
    self.chaptersDidStart = chaptersDidStart
    self.courseDidStart = courseDidStart
  }

  func resolveCourse(with course: Course) {
    courseContinuation?.resume(returning: course)
    courseContinuation = nil
  }

  func resolveChapters(with chapters: [CourseChapter]) {
    chaptersContinuation?.resume(returning: chapters)
    chaptersContinuation = nil
  }

  func listCourses(query: CourseCatalogQuery) async throws -> CourseCatalogPage {
    throw APIError.unavailable
  }

  func getCourse(id: String, token: String?) async throws -> Course {
    try await withCheckedThrowingContinuation { continuation in
      courseContinuation = continuation
      courseDidStart()
    }
  }

  func getChapter(_ key: CatalogChapterKey, token: String?) async throws -> CourseChapter {
    throw APIError.unavailable
  }

  func listCourseChapters(courseID: String, token: String?) async throws -> [CourseChapter] {
    try await withCheckedThrowingContinuation { continuation in
      chaptersContinuation = continuation
      chaptersDidStart()
    }
  }

  func listChapterLessons(_ key: CatalogChapterKey, token: String?) async throws
    -> [CourseLesson]
  {
    throw APIError.unavailable
  }

  func getCourseNextLesson(courseID: String, token: String?) async throws
    -> CatalogContinuationTarget
  {
    throw APIError.unavailable
  }

  func getChapterNextLesson(_ key: CatalogChapterKey, token: String?) async throws
    -> CatalogContinuationTarget
  {
    throw APIError.unavailable
  }

  func getCourseProgress(courseID: String, token: String?) async throws -> CourseProgress {
    throw APIError.unavailable
  }

  func getChapterProgress(chapterID: String, token: String?) async throws -> ChapterProgress {
    throw APIError.unavailable
  }

  func searchCatalog(query: CatalogSearchQuery) async throws -> CatalogSearchResults {
    throw APIError.unavailable
  }
}

private func makeCourseCatalogTestAccount() -> CurrentAccount {
  CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "course-catalog-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
