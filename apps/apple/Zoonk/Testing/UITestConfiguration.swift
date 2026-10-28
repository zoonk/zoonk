#if DEBUG
  import Foundation

  @MainActor
  struct UITestConfiguration {
    let dependencies: AppDependencies
    let initiallyPresentsAccount: Bool

    static var current: UITestConfiguration? {
      let arguments = Set(ProcessInfo.processInfo.arguments)

      guard arguments.contains("--ui-testing") else {
        return nil
      }

      let environment = ProcessInfo.processInfo.environment
      let catalogSnapshot = courseCatalogSnapshot(from: environment)
      let clients = APIClientFactory.live(baseURL: AppConfiguration.current.apiBaseURL)

      return UITestConfiguration(
        dependencies: AppDependencies(
          clients: clients,
          session: SessionStore.preview(account: account(from: environment)),
          privateImageLoader: .live(),
          subscriptionStore: .live(),
          courseCatalogAPI: courseCatalogAPI(snapshot: catalogSnapshot),
          learnerSummaryAPI: UITestLearnerSummaryAPI(summary: learnerSummary(from: environment)),
          progressAPI: progressAPI(from: environment)),
        initiallyPresentsAccount: arguments.contains("--ui-testing-account-sheet"))
    }

    /// Decodes fixture data supplied by the UI-test target so the Debug app can compose isolated state without owning concrete test users.
    private static func account(from environment: [String: String]) -> CurrentAccount? {
      guard let accountJSON = environment["ZOONK_UI_TEST_ACCOUNT"] else {
        return nil
      }

      do {
        return try JSONDecoder().decode(CurrentAccount.self, from: Data(accountJSON.utf8))
      } catch {
        preconditionFailure("ZOONK_UI_TEST_ACCOUNT must contain a valid CurrentAccount payload")
      }
    }

    /// The summary as `GET /v1/me/summary` returns it, so the fixture follows the API's contract.
    private static func learnerSummary(from environment: [String: String]) -> LearnerSummary? {
      guard let summaryJSON = environment["ZOONK_UI_TEST_SUMMARY"] else {
        return nil
      }

      do {
        return makeLearnerSummary(
          try JSONDecoder().decode(
            Components.Schemas.LearnerSummary.self, from: Data(summaryJSON.utf8)))
      } catch {
        preconditionFailure("ZOONK_UI_TEST_SUMMARY must contain a valid learner summary")
      }
    }

    private static func progressAPI(from environment: [String: String]) -> any ProgressAPIClient {
      guard let progressJSON = environment["ZOONK_UI_TEST_PROGRESS"] else {
        let clients = APIClientFactory.live(baseURL: AppConfiguration.current.apiBaseURL)
        return ProgressAPI(clients: clients)
      }

      do {
        let snapshot = try JSONDecoder().decode(
          UITestProgressSnapshot.self,
          from: Data(progressJSON.utf8))
        return UITestProgressAPI(
          failure: environment["ZOONK_UI_TEST_PROGRESS_FAILURE"]
            .flatMap(UITestProgressFailure.init(rawValue:)),
          snapshot: snapshot)
      } catch {
        preconditionFailure("ZOONK_UI_TEST_PROGRESS must contain a valid progress snapshot")
      }
    }

    private static func courseCatalogAPI(
      snapshot: UITestCourseCatalogSnapshot?
    ) -> any CourseCatalogAPIClient {
      guard let snapshot else {
        return CourseCatalogAPI(
          clients: APIClientFactory.live(baseURL: AppConfiguration.current.apiBaseURL))
      }

      return UITestCourseCatalogAPI(snapshot: snapshot)
    }

    private static func courseCatalogSnapshot(
      from environment: [String: String]
    ) -> UITestCourseCatalogSnapshot? {
      guard let catalogJSON = environment["ZOONK_UI_TEST_CATALOG"] else {
        return nil
      }

      do {
        return try JSONDecoder().decode(
          UITestCourseCatalogSnapshot.self,
          from: Data(catalogJSON.utf8))
      } catch {
        preconditionFailure("ZOONK_UI_TEST_CATALOG must contain a valid catalog snapshot")
      }
    }
  }

  private struct UITestCourseCatalogSnapshot: Decodable, Sendable {
    let chapters: [CourseChapter]
    let courses: [Course]
    let lessons: [CourseLesson]
  }

  private actor UITestCourseCatalogAPI: CourseCatalogAPIClient {
    let snapshot: UITestCourseCatalogSnapshot

    init(snapshot: UITestCourseCatalogSnapshot) {
      self.snapshot = snapshot
    }

    func listCourses(query: CourseCatalogQuery) async throws -> CourseCatalogPage {
      let matchingCourses = publicCourses.filter { course in
        course.language == query.language
          && query.category.map(course.categories.contains) != false
      }
      let requestedStartIndex = query.cursor.flatMap(Int.init) ?? 0
      let startIndex = min(max(requestedStartIndex, 0), matchingCourses.count)
      let pageSize = max(query.limit ?? 20, 0)
      let endIndex = min(startIndex + pageSize, matchingCourses.count)
      let courses = matchingCourses[startIndex..<endIndex].compactMap(makeCourseSummary)
      let hasMore = endIndex < matchingCourses.count

      return CourseCatalogPage(
        courses: courses,
        hasMore: hasMore,
        nextCursor: hasMore ? String(endIndex) : nil)
    }

    func getCourse(id: String) async throws -> Course {
      try readableCourse(id: id)
    }

    /// Like the API, a course that doesn't place the chapter doesn't find it.
    func getChapter(_ key: CatalogChapterKey) async throws -> CourseChapter {
      _ = try readableCourse(id: key.courseID)
      return try placedChapter(key)
    }

    func listCourseChapters(courseID: String) async throws -> [CourseChapter] {
      _ = try readableCourse(id: courseID)
      return snapshot.chapters.filter { $0.courseID == courseID }
    }

    func listChapterLessons(_ key: CatalogChapterKey) async throws -> [CourseLesson] {
      _ = try readableCourse(id: key.courseID)
      _ = try placedChapter(key)
      return snapshot.lessons.filter { $0.chapterID == key.chapterID }
    }

    func searchCatalog(query: CatalogSearchQuery) async throws -> CatalogSearchResults {
      CatalogSearchResults(
        chapters: snapshot.chapters
          .filter {
            matchesSearch(
              (query: query.query, title: $0.title, description: $0.description))
          }
          .compactMap(makeChapterSearchResult),
        courses:
          publicCourses
          .filter {
            matchesSearch(
              (query: query.query, title: $0.title, description: $0.description))
          }
          .compactMap(makeCourseSearchResult))
    }

    private func makeCourseSummary(_ course: Course) -> CourseSummary? {
      course.organization.map { organization in
        CourseSummary(
          description: course.description,
          id: course.id,
          imageURL: course.imageURL,
          language: course.language,
          organization: organization,
          slug: course.slug,
          title: course.title)
      }
    }

    private var publicCourses: [Course] {
      snapshot.courses.filter { $0.organization != nil }
    }

    private func readableCourse(id: String) throws -> Course {
      guard let course = publicCourses.first(where: { $0.id == id }) else {
        throw APIError.notFound
      }

      return course
    }

    private func placedChapter(_ key: CatalogChapterKey) throws -> CourseChapter {
      guard
        let chapter = snapshot.chapters.first(where: {
          $0.id == key.chapterID && $0.courseID == key.courseID
        })
      else {
        throw APIError.notFound
      }

      return chapter
    }

    private func matchesSearch(
      _ source: (query: String, title: String, description: String?)
    ) -> Bool {
      source.title.localizedCaseInsensitiveContains(source.query)
        || source.description?.localizedCaseInsensitiveContains(source.query) == true
    }

    private func makeCourseSearchResult(_ course: Course) -> CatalogCourseSearchResult? {
      guard let organization = course.organization else {
        return nil
      }

      return CatalogCourseSearchResult(
        description: course.description,
        id: course.id,
        imageURL: course.imageURL,
        language: course.language,
        organizationSlug: organization.slug,
        slug: course.slug,
        title: course.title)
    }

    private func makeChapterSearchResult(
      _ chapter: CourseChapter
    ) -> CatalogChapterSearchResult? {
      guard
        let course = publicCourses.first(where: { $0.id == chapter.courseID }),
        let organization = course.organization
      else {
        return nil
      }

      return CatalogChapterSearchResult(
        courseID: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        description: chapter.description,
        id: chapter.id,
        language: chapter.language,
        organizationSlug: organization.slug,
        slug: chapter.slug,
        title: chapter.title)
    }
  }

  private struct UITestProgressSnapshot: Decodable, Sendable {
    let activity: ActivityProgress
    let energy: EnergyProgress?
    let level: LevelProgress?
    let overview: ProgressOverview
    let patterns: ScorePatterns?
    let score: ScoreProgress?
  }

  /// Keeps UI tests off the network: the frame gets a summary that doesn't change during a run.
  private struct UITestLearnerSummaryAPI: LearnerSummaryAPIClient {
    let summary: LearnerSummary?

    func getSummary(token: String) async throws -> LearnerSummary {
      summary
        ?? LearnerSummary(
          activeGoalID: nil,
          buddyName: nil,
          goals: [],
          identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: token),
          level: nil,
          nextChangeAt: .distantFuture,
          places: LearnerPlaces(exam: false, mindMaps: false, readyMistakes: 0, speaking: false),
          readAt: .now,
          tier: .free,
          timeZone: nil,
          todayBlocksLeft: nil)
    }

    func switchGoal(token: String, goalID: String) async throws {}
  }

  private enum UITestProgressFailure: String, Sendable {
    case activityUnauthorized = "activity-unauthorized"
    case overviewNetwork = "overview-network"
  }

  private actor UITestProgressAPI: ProgressAPIClient {
    let failure: UITestProgressFailure?
    let snapshot: UITestProgressSnapshot

    init(failure: UITestProgressFailure?, snapshot: UITestProgressSnapshot) {
      self.failure = failure
      self.snapshot = snapshot
    }

    func getOverview(token: String) async throws -> ProgressOverview {
      if failure == .overviewNetwork {
        throw APIError.network
      }

      return snapshot.overview
    }

    func getActivity(token: String) async throws -> ActivityProgress {
      if failure == .activityUnauthorized {
        throw APIError.unauthorized
      }

      return snapshot.activity
    }

    func getEnergy(token: String) async throws -> EnergyProgress? {
      snapshot.energy
    }

    func getLevel(token: String) async throws -> LevelProgress? {
      snapshot.level
    }

    func getScore(token: String) async throws -> ScoreProgress? {
      snapshot.score
    }

    func getScorePatterns(token: String) async throws -> ScorePatterns? {
      snapshot.patterns
    }
  }
#endif
