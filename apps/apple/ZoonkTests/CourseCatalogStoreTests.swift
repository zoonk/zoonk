import XCTest

@testable import Zoonk

extension CourseCatalogStore {
  fileprivate convenience init(api: any CourseCatalogAPIClient, language: String) {
    self.init(api: api, language: language, session: .preview())
  }
}

@MainActor
final class CourseCatalogStoreTests: XCTestCase {
  func testStoreStartsIdle() {
    let store = CourseCatalogStore(api: CourseCatalogAPIStub(), language: "en")

    XCTAssertEqual(store.coursesState, .idle)
    XCTAssertEqual(store.courseState(for: Course.testFixture.id), .idle)
    XCTAssertEqual(store.chapterState(for: CourseChapter.testFixture.id), .idle)
    XCTAssertFalse(store.isLoadingMore)
    XCTAssertNil(store.loadMoreFailure)
  }

  func testInitialCourseLoadPublishesCatalogPageAndQuery() async {
    let page = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: true,
      nextCursor: "next-page")
    let api = CourseCatalogAPIStub(coursePageResults: [.success(page)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourses(category: .science)

    XCTAssertEqual(store.coursesState, .loaded(page))
    let queries = await api.courseQueries
    XCTAssertEqual(
      queries,
      [CourseCatalogQuery(category: .science, language: "en")])
  }

  func testLoadedCatalogIsReusedByAPresentationLoad() async {
    let page = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: false,
      nextCursor: nil)
    let api = CourseCatalogAPIStub(coursePageResults: [.success(page)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourses(category: .science)
    await store.loadCoursesIfNeeded(category: .science)

    let queries = await api.courseQueries
    XCTAssertEqual(queries, [CourseCatalogQuery(category: .science, language: "en")])
  }

  func testEmptyCourseLoadPublishesEmptyState() async {
    let api = CourseCatalogAPIStub(
      coursePageResults: [
        .success(CourseCatalogPage(courses: [], hasMore: false, nextCursor: nil))
      ])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourses(category: nil)

    XCTAssertEqual(store.coursesState, .empty)
  }

  func testCourseLoadPublishesUsefulFailures() async {
    let networkStore = CourseCatalogStore(
      api: CourseCatalogAPIStub(coursePageResults: [.failure(CourseCatalogFailure.network)]),
      language: "en")
    let unavailableStore = CourseCatalogStore(
      api: CourseCatalogAPIStub(coursePageResults: [.failure(CourseCatalogFailure.unavailable)]),
      language: "en")

    await networkStore.loadCourses(category: nil)
    await unavailableStore.loadCourses(category: nil)

    XCTAssertEqual(networkStore.coursesState, .failed(.network))
    XCTAssertEqual(unavailableStore.coursesState, .failed(.unavailable))
  }

  func testChangingCategoryReplacesTheVisibleCatalog() async {
    let sciencePage = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: false,
      nextCursor: nil)
    let technologyPage = CourseCatalogPage(
      courses: [.secondTestFixture],
      hasMore: false,
      nextCursor: nil)
    let api = CourseCatalogAPIStub(
      coursePageResults: [.success(sciencePage), .success(technologyPage)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourses(category: .science)
    await store.loadCourses(category: .tech)

    XCTAssertEqual(store.coursesState, .loaded(technologyPage))
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

    await store.loadCourses(category: .science)
    await store.loadMoreCourses(category: .science)

    XCTAssertEqual(
      store.coursesState,
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
      coursePageResults: [
        .success(firstPage),
        .failure(CourseCatalogFailure.network),
      ])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourses(category: nil)
    await store.loadMoreCourses(category: nil)

    XCTAssertEqual(store.coursesState, .loaded(firstPage))
    XCTAssertEqual(store.loadMoreFailure, .network)
    XCTAssertFalse(store.isLoadingMore)
  }

  func testCancelledLoadMorePreservesLoadedCoursesWithoutFailure() async {
    let firstPage = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: true,
      nextCursor: "page-two")
    let api = CourseCatalogAPIStub(
      coursePageResults: [
        .success(firstPage),
        .failure(CancellationError()),
      ])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourses(category: nil)
    await store.loadMoreCourses(category: nil)

    XCTAssertEqual(store.coursesState, .loaded(firstPage))
    XCTAssertNil(store.loadMoreFailure)
    XCTAssertFalse(store.isLoadingMore)
  }

  func testCancelledLoadDoesNotPublishFailure() async {
    let api = CourseCatalogAPIStub(
      coursePageResults: [.failure(CancellationError())])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourses(category: nil)

    XCTAssertEqual(store.coursesState, .idle)
  }

  func testCancelledRefreshPreservesLoadedCourses() async {
    let page = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: false,
      nextCursor: nil)
    let api = CourseCatalogAPIStub(
      coursePageResults: [
        .success(page),
        .failure(CancellationError()),
      ])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourses(category: nil)
    await store.loadCourses(category: nil, force: true)

    XCTAssertEqual(store.coursesState, .loaded(page))
  }

  func testFailedRefreshPreservesLoadedCourses() async {
    let page = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: false,
      nextCursor: nil)
    let api = CourseCatalogAPIStub(
      coursePageResults: [
        .success(page),
        .failure(CourseCatalogFailure.network),
      ])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourses(category: nil)
    await store.loadCourses(category: nil, force: true)

    XCTAssertEqual(store.coursesState, .loaded(page))
  }

  func testLoadedCoursesRemainVisibleWhileRefreshing() async {
    let firstRequestStarted = expectation(description: "Initial catalog request started")
    let refreshStarted = expectation(description: "Catalog refresh started")
    let api = SuspendedCourseCatalogAPI { requestCount in
      if requestCount == 1 {
        firstRequestStarted.fulfill()
      } else if requestCount == 2 {
        refreshStarted.fulfill()
      }
    }
    let store = CourseCatalogStore(api: api, language: "en")
    let initialPage = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: false,
      nextCursor: nil)
    let refreshedPage = CourseCatalogPage(
      courses: [.secondTestFixture],
      hasMore: false,
      nextCursor: nil)

    let initialRequest = Task { await store.loadCourses(category: .science) }
    await fulfillment(of: [firstRequestStarted], timeout: 1)
    await api.resolveCourseRequest(at: 0, with: initialPage)
    await initialRequest.value

    let refreshRequest = Task { await store.loadCourses(category: .science, force: true) }
    await fulfillment(of: [refreshStarted], timeout: 1)

    XCTAssertEqual(store.coursesState, .loaded(initialPage))

    await api.resolveCourseRequest(at: 1, with: refreshedPage)
    await refreshRequest.value
    XCTAssertEqual(store.coursesState, .loaded(refreshedPage))
  }

  func testOrdinaryLoadDeduplicatesAnInFlightRefresh() async {
    let initialRequestStarted = expectation(description: "Initial catalog request started")
    let refreshStarted = expectation(description: "Catalog refresh started")
    let api = SuspendedCourseCatalogAPI { requestCount in
      if requestCount == 1 {
        initialRequestStarted.fulfill()
      } else if requestCount == 2 {
        refreshStarted.fulfill()
      }
    }
    let store = CourseCatalogStore(api: api, language: "en")
    let initialPage = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: false,
      nextCursor: nil)
    let refreshedPage = CourseCatalogPage(
      courses: [.secondTestFixture],
      hasMore: false,
      nextCursor: nil)

    let initialRequest = Task { await store.loadCourses(category: nil) }
    await fulfillment(of: [initialRequestStarted], timeout: 1)
    await api.resolveCourseRequest(at: 0, with: initialPage)
    await initialRequest.value

    let refreshRequest = Task { await store.loadCourses(category: nil, force: true) }
    await fulfillment(of: [refreshStarted], timeout: 1)
    let duplicateRequest = Task { await store.loadCourses(category: nil) }
    for _ in 0..<10 {
      await Task.yield()
    }

    let requestCount = await api.courseRequestCount
    XCTAssertEqual(requestCount, 2)
    if requestCount == 3 {
      await api.resolveCourseRequest(at: 2, with: refreshedPage)
    }

    await api.resolveCourseRequest(at: 1, with: refreshedPage)
    await duplicateRequest.value
    await refreshRequest.value

    XCTAssertEqual(store.coursesState, .loaded(refreshedPage))
  }

  func testLateCatalogResponseCannotOverwriteANewerCategory() async {
    let scienceStarted = expectation(description: "Science catalog request started")
    let technologyStarted = expectation(description: "Technology catalog request started")
    let api = SuspendedCourseCatalogAPI { requestCount in
      if requestCount == 1 {
        scienceStarted.fulfill()
      } else if requestCount == 2 {
        technologyStarted.fulfill()
      }
    }
    let store = CourseCatalogStore(api: api, language: "en")
    let sciencePage = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: false,
      nextCursor: nil)
    let technologyPage = CourseCatalogPage(
      courses: [.secondTestFixture],
      hasMore: false,
      nextCursor: nil)

    let scienceRequest = Task { await store.loadCourses(category: .science) }
    await fulfillment(of: [scienceStarted], timeout: 1)

    let technologyRequest = Task { await store.loadCourses(category: .tech) }
    await fulfillment(of: [technologyStarted], timeout: 1)

    await api.resolveCourseRequest(at: 1, with: technologyPage)
    await technologyRequest.value
    await api.resolveCourseRequest(at: 0, with: sciencePage)
    await scienceRequest.value

    XCTAssertEqual(store.coursesState, .loaded(technologyPage))
  }

  func testReenteringCatalogSupersedesACancellationDelayedRequest() async {
    let firstRequestStarted = expectation(description: "Initial catalog request started")
    let replacementRequestStarted = expectation(description: "Replacement catalog request started")
    let api = SuspendedCourseCatalogAPI { requestCount in
      if requestCount == 1 {
        firstRequestStarted.fulfill()
      } else if requestCount == 2 {
        replacementRequestStarted.fulfill()
      }
    }
    let store = CourseCatalogStore(api: api, language: "en")
    let page = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: false,
      nextCursor: nil)

    let initialRequest = Task { await store.loadCourses(category: .science) }
    await fulfillment(of: [firstRequestStarted], timeout: 1)
    initialRequest.cancel()

    let replacementRequest = Task {
      await store.loadCoursesIfNeeded(category: .science)
    }
    await fulfillment(of: [replacementRequestStarted], timeout: 1)

    guard await api.courseRequestCount == 2 else {
      await api.failCourseRequest(at: 0, with: CancellationError())
      await initialRequest.value
      await replacementRequest.value
      return
    }

    await api.failCourseRequest(at: 0, with: CancellationError())
    await initialRequest.value
    await api.resolveCourseRequest(at: 1, with: page)
    await replacementRequest.value

    XCTAssertEqual(store.coursesState, .loaded(page))
  }

  func testReappearingPaginationTriggerSupersedesACancellationDelayedRequest() async {
    let initialRequestStarted = expectation(description: "Initial catalog request started")
    let firstPageRequestStarted = expectation(description: "First pagination request started")
    let replacementPageRequestStarted = expectation(
      description: "Replacement pagination request started")
    let api = SuspendedCourseCatalogAPI { requestCount in
      if requestCount == 1 {
        initialRequestStarted.fulfill()
      } else if requestCount == 2 {
        firstPageRequestStarted.fulfill()
      } else if requestCount == 3 {
        replacementPageRequestStarted.fulfill()
      }
    }
    let store = CourseCatalogStore(api: api, language: "en")
    let firstPage = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: true,
      nextCursor: "next-page")
    let finalPage = CourseCatalogPage(
      courses: [.secondTestFixture],
      hasMore: false,
      nextCursor: nil)

    let initialRequest = Task { await store.loadCourses(category: nil) }
    await fulfillment(of: [initialRequestStarted], timeout: 1)
    await api.resolveCourseRequest(at: 0, with: firstPage)
    await initialRequest.value

    let firstPageRequest = Task { await store.loadMoreCourses(category: nil) }
    await fulfillment(of: [firstPageRequestStarted], timeout: 1)
    firstPageRequest.cancel()

    let replacementPageRequest = Task {
      await store.loadMoreCourses(category: nil, force: true)
    }
    await fulfillment(of: [replacementPageRequestStarted], timeout: 1)

    guard await api.courseRequestCount == 3 else {
      await api.failCourseRequest(at: 1, with: CancellationError())
      await firstPageRequest.value
      await replacementPageRequest.value
      return
    }

    await api.failCourseRequest(at: 1, with: CancellationError())
    await firstPageRequest.value
    await api.resolveCourseRequest(at: 2, with: finalPage)
    await replacementPageRequest.value

    XCTAssertEqual(
      store.coursesState,
      .loaded(
        CourseCatalogPage(
          courses: [.testFixture, .secondTestFixture],
          hasMore: false,
          nextCursor: nil)))
  }

  func testPaginationWaitsForAFirstPageRefreshBeforeMerging() async {
    let initialRequestStarted = expectation(description: "Initial catalog request started")
    let refreshStarted = expectation(description: "Catalog refresh started")
    let paginationStarted = expectation(description: "Pagination request started")
    let api = SuspendedCourseCatalogAPI { requestCount in
      if requestCount == 1 {
        initialRequestStarted.fulfill()
      } else if requestCount == 2 {
        refreshStarted.fulfill()
      } else if requestCount == 3 {
        paginationStarted.fulfill()
      }
    }
    let store = CourseCatalogStore(api: api, language: "en")
    let initialPage = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: true,
      nextCursor: "next-page")
    let refreshedPage = CourseCatalogPage(
      courses: [.secondTestFixture],
      hasMore: true,
      nextCursor: "next-page")
    let finalPage = CourseCatalogPage(
      courses: [.testFixture],
      hasMore: false,
      nextCursor: nil)

    let initialRequest = Task { await store.loadCourses(category: nil) }
    await fulfillment(of: [initialRequestStarted], timeout: 1)
    await api.resolveCourseRequest(at: 0, with: initialPage)
    await initialRequest.value

    let refreshRequest = Task { await store.loadCourses(category: nil, force: true) }
    await fulfillment(of: [refreshStarted], timeout: 1)

    let paginationDuringRefresh = Task {
      await store.loadMoreCourses(category: nil, force: true)
    }
    for _ in 0..<10 {
      await Task.yield()
    }
    let requestCountDuringRefresh = await api.courseRequestCount
    XCTAssertEqual(
      requestCountDuringRefresh,
      2,
      "Expected pagination to wait until the first-page refresh completes")

    await api.resolveCourseRequest(at: 1, with: refreshedPage)
    await refreshRequest.value

    let paginationAfterRefresh: Task<Void, Never>?
    if requestCountDuringRefresh == 2 {
      paginationAfterRefresh = Task {
        await store.loadMoreCourses(category: nil, force: true)
      }
    } else {
      paginationAfterRefresh = nil
    }

    await fulfillment(of: [paginationStarted], timeout: 1)
    await api.resolveCourseRequest(at: 2, with: finalPage)
    await paginationDuringRefresh.value
    await paginationAfterRefresh?.value

    XCTAssertEqual(
      store.coursesState,
      .loaded(
        CourseCatalogPage(
          courses: [.secondTestFixture, .testFixture],
          hasMore: false,
          nextCursor: nil)))
  }

  func testCourseDetailLoadsCourseAndChaptersConcurrently() async {
    let courseStarted = expectation(description: "Course request started")
    let chaptersStarted = expectation(description: "Chapters request started")
    let api = SuspendedCourseDetailAPI(
      chaptersDidStart: { chaptersStarted.fulfill() },
      courseDidStart: { courseStarted.fulfill() })
    let store = CourseCatalogStore(api: api, language: "en")

    let request = Task { await store.loadCourse(id: Course.testFixture.id) }
    await fulfillment(of: [courseStarted, chaptersStarted], timeout: 1)
    await api.resolveCourse(with: .testFixture)
    await api.resolveChapters(with: [.testFixture])
    await request.value

    XCTAssertEqual(
      store.courseState(for: Course.testFixture.id),
      .loaded(CourseDetail(course: .testFixture, chapters: [.testFixture])))
  }

  func testLoadedCourseDetailIsReusedByAPresentationLoad() async {
    let api = CourseCatalogAPIStub(
      chapterResults: [.success([.testFixture])],
      courseResults: [.success(.testFixture)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourse(id: Course.testFixture.id)
    await store.loadCourseIfNeeded(id: Course.testFixture.id)

    let courseRequestCount = await api.courseRequestCount
    let chapterListRequestCount = await api.chapterListRequestCount
    XCTAssertEqual(courseRequestCount, 1)
    XCTAssertEqual(chapterListRequestCount, 1)
  }

  func testCourseDetailLoadsContinuationAndProgressWithTheCurrentSession() async {
    let session = SessionStore.preview(account: makeCourseCatalogTestAccount())
    let api = CourseCatalogAPIStub(
      chapterResults: [.success([.testFixture])],
      courseContinuationResults: [.success(.testLessonFixture)],
      courseProgressResults: [.success(.testFixture)],
      courseResults: [.success(.testFixture)])
    let store = CourseCatalogStore(api: api, language: "en", session: session)

    await store.loadCourse(id: Course.testFixture.id)

    XCTAssertEqual(
      store.courseState(for: Course.testFixture.id),
      .loaded(
        CourseDetail(
          continuation: .testLessonFixture,
          course: .testFixture,
          chapters: [.testFixture],
          progress: .testFixture)))
    let continuationTokens = await api.courseContinuationTokens
    let progressTokens = await api.courseProgressTokens
    XCTAssertEqual(continuationTokens, ["preview-session"])
    XCTAssertEqual(progressTokens, ["preview-session"])
  }

  func testSupplementalCourseFailureDoesNotHideBaseCatalogContent() async {
    let api = CourseCatalogAPIStub(
      chapterResults: [.success([.testFixture])],
      courseContinuationResults: [.failure(CourseCatalogFailure.network)],
      courseProgressResults: [.failure(CourseCatalogFailure.unavailable)],
      courseResults: [.success(.testFixture)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourse(id: Course.testFixture.id)

    XCTAssertEqual(
      store.courseState(for: Course.testFixture.id),
      .loaded(CourseDetail(course: .testFixture, chapters: [.testFixture])))
  }

  func testSupplementalCourseCancellationCancelsTheDetailLoad() async {
    let api = CourseCatalogAPIStub(
      chapterResults: [.success([.testFixture])],
      courseContinuationResults: [.failure(CancellationError())],
      courseProgressResults: [.success(.testFixture)],
      courseResults: [.success(.testFixture)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourse(id: Course.testFixture.id)

    XCTAssertEqual(store.courseState(for: Course.testFixture.id), .idle)
  }

  func testSessionChangeReloadsCourseSupplementalDataWithTheNewIdentity() async throws {
    let session = SessionStore.preview(account: makeCourseCatalogTestAccount())
    let api = CourseCatalogAPIStub(
      chapterResults: [.success([.testFixture]), .success([.testFixture])],
      courseContinuationResults: [
        .success(.testLessonFixture),
        .success(.testLessonFixture),
      ],
      courseProgressResults: [
        .success(.testFixture),
        .success(.testFixture),
      ],
      courseResults: [.success(.testFixture), .success(.testFixture)])
    let store = CourseCatalogStore(api: api, language: "en", session: session)

    await store.loadCourse(id: Course.testFixture.id)
    await session.expire(try XCTUnwrap(session.authenticatedSession))
    await store.loadCourse(id: Course.testFixture.id)

    let continuationTokens = await api.courseContinuationTokens
    let progressTokens = await api.courseProgressTokens
    XCTAssertEqual(continuationTokens, ["preview-session", nil])
    XCTAssertEqual(progressTokens, ["preview-session", nil])
    XCTAssertEqual(
      store.courseState(for: Course.testFixture.id),
      .loaded(
        CourseDetail(
          continuation: .testLessonFixture,
          course: .testFixture,
          chapters: [.testFixture],
          progress: .testFixture)))
  }

  func testMissingCoursePublishesNotFound() async {
    let api = CourseCatalogAPIStub(
      courseResults: [.failure(CourseCatalogFailure.notFound)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourse(id: Course.testFixture.id)

    XCTAssertEqual(store.courseState(for: Course.testFixture.id), .failed(.notFound))
  }

  func testFailedCourseRefreshPreservesLoadedDetail() async {
    let detail = CourseDetail(course: .testFixture, chapters: [.testFixture])
    let api = CourseCatalogAPIStub(
      chapterResults: [
        .success([.testFixture]),
        .failure(CourseCatalogFailure.network),
      ],
      courseResults: [
        .success(.testFixture),
        .failure(CourseCatalogFailure.network),
      ])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourse(id: Course.testFixture.id)
    await store.loadCourse(id: Course.testFixture.id, force: true)

    XCTAssertEqual(store.courseState(for: Course.testFixture.id), .loaded(detail))
  }

  func testNotFoundCourseRefreshReplacesStaleDetail() async {
    let api = CourseCatalogAPIStub(
      chapterResults: [
        .success([.testFixture]),
        .success([.testFixture]),
      ],
      courseResults: [
        .success(.testFixture),
        .failure(CourseCatalogFailure.notFound),
      ])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadCourse(id: Course.testFixture.id)
    await store.loadCourse(id: Course.testFixture.id, force: true)

    XCTAssertEqual(store.courseState(for: Course.testFixture.id), .failed(.notFound))
  }

  func testChapterDetailLoadsLessons() async {
    let api = CourseCatalogAPIStub(
      lessonResults: [.success([.testFixture])])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadChapter(id: CourseChapter.testFixture.id)

    XCTAssertEqual(
      store.chapterState(for: CourseChapter.testFixture.id),
      .loaded(ChapterDetail(chapter: .resourceTestFixture, lessons: [.testFixture])))
  }

  func testLoadedChapterDetailIsReusedByAPresentationLoad() async {
    let api = CourseCatalogAPIStub(lessonResults: [.success([.testFixture])])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadChapter(id: CourseChapter.testFixture.id)
    await store.loadChapterIfNeeded(id: CourseChapter.testFixture.id)

    let chapterRequestCount = await api.chapterRequestCount
    let lessonListRequestCount = await api.lessonListRequestCount
    XCTAssertEqual(chapterRequestCount, 1)
    XCTAssertEqual(lessonListRequestCount, 1)
  }

  func testChapterDetailLoadsContinuationAndProgressWithTheCurrentSession() async {
    let session = SessionStore.preview(account: makeCourseCatalogTestAccount())
    let api = CourseCatalogAPIStub(
      chapterContinuationResults: [.success(.testLessonFixture)],
      chapterProgressResults: [.success(.testFixture)],
      lessonResults: [.success([.testFixture])])
    let store = CourseCatalogStore(api: api, language: "en", session: session)

    await store.loadChapter(id: CourseChapter.testFixture.id)

    XCTAssertEqual(
      store.chapterState(for: CourseChapter.testFixture.id),
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

  func testChapterMetadataFailureDoesNotHideLoadedLessons() async {
    let api = CourseCatalogAPIStub(
      chapterDetailResults: [.failure(CourseCatalogFailure.network)],
      lessonResults: [.success([.testFixture])])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadChapter(id: CourseChapter.testFixture.id)

    XCTAssertEqual(
      store.chapterState(for: CourseChapter.testFixture.id),
      .loaded(ChapterDetail(lessons: [.testFixture])))
  }

  func testChapterWithoutLessonsPreservesCanonicalDetail() async {
    let api = CourseCatalogAPIStub(lessonResults: [.success([])])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadChapter(id: CourseChapter.testFixture.id)

    XCTAssertEqual(
      store.chapterState(for: CourseChapter.testFixture.id),
      .loaded(ChapterDetail(chapter: .resourceTestFixture, lessons: [])))
  }

  func testFailedChapterRefreshPreservesLoadedLessons() async {
    let detail = ChapterDetail(chapter: .resourceTestFixture, lessons: [.testFixture])
    let api = CourseCatalogAPIStub(
      lessonResults: [
        .success([.testFixture]),
        .failure(CourseCatalogFailure.network),
      ])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.loadChapter(id: CourseChapter.testFixture.id)
    await store.loadChapter(id: CourseChapter.testFixture.id, force: true)

    XCTAssertEqual(store.chapterState(for: CourseChapter.testFixture.id), .loaded(detail))
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
    XCTAssertEqual(
      searchQueries,
      [CatalogSearchQuery(language: "en", query: "stars")])
  }

  func testBlankCatalogSearchReturnsToIdleWithoutRequestingTheAPI() async {
    let api = CourseCatalogAPIStub(searchResults: [.success(.testFixture)])
    let store = CourseCatalogStore(api: api, language: "en")

    await store.searchCatalog(query: "  \n")

    XCTAssertEqual(store.searchState, .idle)
    let searchQueries = await api.searchQueries
    XCTAssertEqual(searchQueries, [])
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
    await api.resolveSearchRequest(
      at: 0,
      with: CatalogSearchResults(chapters: [], courses: []))
    await firstSearch.value

    XCTAssertEqual(store.searchState, .loaded(.testFixture))
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

  func getCourse(id: String) async throws -> Course {
    courseRequestCount += 1
    return try takeFirstResult(from: &courseResults).get()
  }

  func getChapter(id: String) async throws -> CourseChapter {
    chapterRequestCount += 1
    return try takeFirstResult(from: &chapterDetailResults).get()
  }

  func listCourseChapters(courseID: String) async throws -> [CourseChapter] {
    chapterListRequestCount += 1
    return try takeFirstResult(from: &chapterResults).get()
  }

  func listChapterLessons(chapterID: String) async throws -> [CourseLesson] {
    lessonListRequestCount += 1
    return try takeFirstResult(from: &lessonResults).get()
  }

  func getCourseNextLesson(courseID: String, token: String?) async throws
    -> CatalogContinuationTarget
  {
    courseContinuationTokens.append(token)
    return try takeFirstResult(from: &courseContinuationResults).get()
  }

  func getChapterNextLesson(chapterID: String, token: String?) async throws
    -> CatalogContinuationTarget
  {
    chapterContinuationTokens.append(token)
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
      return .failure(CourseCatalogFailure.unavailable)
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

  func getCourse(id: String) async throws -> Course {
    throw CourseCatalogFailure.unavailable
  }

  func getChapter(id: String) async throws -> CourseChapter {
    throw CourseCatalogFailure.unavailable
  }

  func listCourseChapters(courseID: String) async throws -> [CourseChapter] {
    throw CourseCatalogFailure.unavailable
  }

  func listChapterLessons(chapterID: String) async throws -> [CourseLesson] {
    throw CourseCatalogFailure.unavailable
  }

  func getCourseNextLesson(courseID: String, token: String?) async throws
    -> CatalogContinuationTarget
  {
    throw CourseCatalogFailure.unavailable
  }

  func getChapterNextLesson(chapterID: String, token: String?) async throws
    -> CatalogContinuationTarget
  {
    throw CourseCatalogFailure.unavailable
  }

  func getCourseProgress(courseID: String, token: String?) async throws -> CourseProgress {
    throw CourseCatalogFailure.unavailable
  }

  func getChapterProgress(chapterID: String, token: String?) async throws -> ChapterProgress {
    throw CourseCatalogFailure.unavailable
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
    throw CourseCatalogFailure.unavailable
  }

  func getCourse(id: String) async throws -> Course {
    try await withCheckedThrowingContinuation { continuation in
      courseContinuation = continuation
      courseDidStart()
    }
  }

  func getChapter(id: String) async throws -> CourseChapter {
    throw CourseCatalogFailure.unavailable
  }

  func listCourseChapters(courseID: String) async throws -> [CourseChapter] {
    try await withCheckedThrowingContinuation { continuation in
      chaptersContinuation = continuation
      chaptersDidStart()
    }
  }

  func listChapterLessons(chapterID: String) async throws -> [CourseLesson] {
    throw CourseCatalogFailure.unavailable
  }

  func getCourseNextLesson(courseID: String, token: String?) async throws
    -> CatalogContinuationTarget
  {
    throw CourseCatalogFailure.unavailable
  }

  func getChapterNextLesson(chapterID: String, token: String?) async throws
    -> CatalogContinuationTarget
  {
    throw CourseCatalogFailure.unavailable
  }

  func getCourseProgress(courseID: String, token: String?) async throws -> CourseProgress {
    throw CourseCatalogFailure.unavailable
  }

  func getChapterProgress(chapterID: String, token: String?) async throws -> ChapterProgress {
    throw CourseCatalogFailure.unavailable
  }

  func searchCatalog(query: CatalogSearchQuery) async throws -> CatalogSearchResults {
    throw CourseCatalogFailure.unavailable
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
