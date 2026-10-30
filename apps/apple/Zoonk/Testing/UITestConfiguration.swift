#if DEBUG
  import Foundation

  @MainActor
  struct UITestConfiguration {
    let dependencies: AppDependencies
    let initiallyPresentsAccount: Bool
    var fixtureFailure: String?

    static var current: UITestConfiguration? {
      let arguments = Set(ProcessInfo.processInfo.arguments)
      let environment = ProcessInfo.processInfo.environment

      guard arguments.contains("--ui-testing") else {
        // Lets a Debug run against the live API check mind maps without paying to generate one.
        return UITestMindMapsAPI(environment: environment).map { mindMaps in
          UITestConfiguration(
            dependencies: .live(mindMapsAPI: mindMaps), initiallyPresentsAccount: false)
        }
      }

      let clients = APIClientFactory.live(baseURL: AppConfiguration.current.apiBaseURL)

      do {
        return try fixtures(clients: clients, arguments: arguments, environment: environment)
      } catch {
        return UITestConfiguration(
          dependencies: AppDependencies(
            clients: clients, session: .preview(), privateImageLoader: .live(),
            subscriptionStore: .live()),
          initiallyPresentsAccount: false, fixtureFailure: String(describing: error))
      }
    }

    private static func fixtures(
      clients: APIClientFactory, arguments: Set<String>, environment: [String: String]
    ) throws -> UITestConfiguration {
      let fixtures = UITestFixtures(environment: environment)
      let catalogSnapshot = try fixtures.decode(
        UITestCourseCatalogSnapshot.self, "ZOONK_UI_TEST_CATALOG")
      let summary = try fixtures.decode(
        Components.Schemas.LearnerSummary.self, "ZOONK_UI_TEST_SUMMARY")
      let buddyStatus = try fixtures.decode(BuddyStatus.self, "ZOONK_UI_TEST_BUDDY")

      return UITestConfiguration(
        dependencies: AppDependencies(
          clients: clients,
          session: SessionStore.preview(
            account: try fixtures.decode(CurrentAccount.self, "ZOONK_UI_TEST_ACCOUNT")),
          privateImageLoader: .live(),
          subscriptionStore: .live(),
          buddyAPI: buddyStatus.map(UITestBuddyAPI.init),
          courseCatalogAPI: courseCatalogAPI(snapshot: catalogSnapshot),
          learnerSummaryAPI: UITestLearnerSummaryAPI(summary: summary.map(makeLearnerSummary)),
          mindMapsAPI: UITestMindMapsAPI(environment: environment),
          progressAPI: try progressAPI(from: fixtures),
          studyAPI: try studyAPI(from: fixtures),
          tutorAPI: buddyStatus.map { _ in
            UITestTutorAPI(turns: Int(environment["ZOONK_UI_TEST_TUTOR_TURNS"] ?? "") ?? 0)
          }),
        initiallyPresentsAccount: arguments.contains("--ui-testing-account-sheet"))
    }

    private static func progressAPI(from fixtures: UITestFixtures) throws -> any ProgressAPIClient {
      guard
        let snapshot = try fixtures.decode(UITestProgressSnapshot.self, "ZOONK_UI_TEST_PROGRESS")
      else {
        let clients = APIClientFactory.live(baseURL: AppConfiguration.current.apiBaseURL)
        return ProgressAPI(clients: clients)
      }

      return UITestProgressAPI(
        failure: fixtures.environment["ZOONK_UI_TEST_PROGRESS_FAILURE"]
          .flatMap(UITestProgressFailure.init(rawValue:)),
        snapshot: snapshot)
    }

    private static func studyAPI(from fixtures: UITestFixtures) throws -> (any StudyAPIClient)? {
      guard let today = try fixtures.decode(TodayView.self, "ZOONK_UI_TEST_TODAY") else {
        return nil
      }

      return UITestStudyAPI(
        summary: try fixtures.decode(SessionSummary.self, "ZOONK_UI_TEST_SESSION_SUMMARY"),
        today: today)
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
  }

  private struct UITestFixtures {
    struct Failure: Error, CustomStringConvertible {
      let key: String
      let error: Error

      var description: String { "\(key) couldn't be decoded: \(error)" }
    }

    let environment: [String: String]

    func decode<Value: Decodable>(_ type: Value.Type, _ key: String) throws -> Value? {
      guard let json = environment[key] else {
        return nil
      }

      do {
        return try JSONDecoder().decode(type, from: Data(json.utf8))
      } catch {
        throw Failure(key: key, error: error)
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

    func countCourses(language: String) async throws -> CourseCategoryCounts {
      let courses = publicCourses.filter { $0.language == language }

      return CourseCategoryCounts(
        counts: Dictionary(
          courses.flatMap(\.categories).map { ($0, 1) }, uniquingKeysWith: +),
        total: courses.count)
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
      let lessons = snapshot.chapters.filter { $0.courseID == course.id }.flatMap(\.lessons)

      return course.organization.map { organization in
        CourseSummary(
          description: course.description,
          estimatedMinutes: lessons.reduce(0) { $0 + $1.estimatedMinutes },
          id: course.id,
          imageURL: course.imageURL,
          language: course.language,
          languageFlag: course.languageFlag,
          lessonCount: lessons.count,
          organization: organization,
          slug: course.slug,
          subject: course.subject,
          targetLanguage: course.targetLanguage,
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
    let patterns: ScorePatterns?
    let score: ScoreProgress?
  }

  private struct UITestLearnerSummaryAPI: LearnerSummaryAPIClient {
    let summary: LearnerSummary?

    func getSummary(token: String) async throws -> LearnerSummary {
      summary
        ?? LearnerSummary(
          activeGoalID: nil,
          buddy: BuddyLook(),
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

  private struct UITestBuddyAPI: BuddyAPIClient {
    let status: BuddyStatus

    func status(timeZone: String, token: String) async throws -> BuddyStatus {
      status
    }

    func save(_ buddy: BuddyChoice, token: String) async throws {}

    func earlierQuestions(cursor: String?, token: String) async throws -> EarlierQuestionsPage {
      EarlierQuestionsPage(questions: [], nextCursor: nil)
    }

    func answer(insightId: String, accepted: Bool, token: String) async throws {}
  }

  private struct UITestTutorAPI: TutorAPIClient {
    let turns: Int

    func thread(_ scope: TutorScope, cursor: String?, token: String) async throws
      -> TutorThreadPage
    {
      let start = Date(timeIntervalSince1970: 1_767_225_600)
      let answer = String(
        repeating: "An orbit is the **curved path** an object takes around a star or planet. ",
        count: 6)

      return TutorThreadPage(
        turns: (0..<turns).map { index in
          TutorTurn(
            id: "turn-\(index)", question: "Question \(index + 1): what is an orbit?",
            answer: answer, status: .completed,
            createdAt: start.addingTimeInterval(Double(index) * 3600), about: .plan,
            planChange: nil, toolOffer: nil)
        },
        hasMore: false, nextCursor: nil)
    }

    func ask(
      _ scope: TutorScope, question: String, suggestion: String?, requestId: String, token: String
    ) async throws -> TutorAskedQuestion {
      throw TutorFailure.failed
    }

    func answer(questionId: String, token: String) -> AsyncThrowingStream<TutorAnswerEvent, Error> {
      AsyncThrowingStream { $0.finish(throwing: TutorFailure.failed) }
    }

    func question(id: String, token: String) async throws -> TutorTurn {
      throw APIError.notFound
    }

    func decidePlanChange(
      goalId: String, changeId: String, decision: PlanChangeDecision, token: String
    ) async throws -> Components.Schemas.PlanChange {
      throw APIError.unavailable
    }

    func undoMemoryChanges(_ changes: [TutorMemoryChange], token: String) async throws {
      throw APIError.unavailable
    }
  }

  private struct UITestStudyAPI: StudyAPIClient {
    let summary: SessionSummary?
    let today: TodayView

    func getToday(token: String, timeZone: String) async throws -> TodayContent {
      .day(today)
    }

    func getSession(token: String, sessionID: String) async throws -> StudyDay {
      today.session
    }

    func getSummary(token: String, sessionID: String) async throws -> SessionSummary {
      guard let summary else {
        throw APIError.notFound
      }

      return summary
    }

    func markMilestoneShown(token: String, milestoneID: String) async throws {}

    func openDay(
      token: String, goalID: String, shownDate: String, timeZone: String, target: DayTarget?
    ) async throws -> OpenedStudyDay {
      throw APIError.network
    }

    func startBlock(token: String, sessionID: String, blockID: String, timeZone: String)
      async throws -> BlockStart
    {
      throw APIError.network
    }

    func addExtraBlock(token: String, sessionID: String) async throws -> StudyBlock {
      throw APIError.network
    }

    func catchUp(token: String, sessionID: String, timeZone: String) async throws {
      throw APIError.network
    }

    func stop(token: String, sessionID: String, timeZone: String) async throws {
      throw APIError.network
    }

    func lessonStatus(token: String, lessonID: String) async throws -> String {
      throw APIError.network
    }

    func languageCheckpointCall(token: String, blockID: String) async throws
      -> LanguageCheckpointCall
    {
      throw APIError.network
    }

    func writeLesson(token: String, lessonID: String) async throws -> LessonWritingOutcome {
      throw APIError.network
    }

    func prepareSession(token: String, sessionID: String) async throws {
      throw APIError.network
    }

    func prepareLessons(token: String, goalID: String) async throws {
      throw APIError.network
    }

    func answerSuggestedGoal(token: String, suggestionID: String, accepted: Bool) async throws {
      throw APIError.network
    }

    func getWeeklyRecap(token: String, goalID: String?) async throws -> WeeklyRecap {
      throw APIError.network
    }

    func getLanguageToday(token: String, goalID: String) async throws -> LanguageTodayView {
      throw APIError.network
    }

    func decidePlanChange(
      token: String, goalID: String, changeID: String, decision: PlanChangeDecision
    ) async throws -> TodayView.PlanChange? {
      throw APIError.network
    }
  }

  private enum UITestProgressFailure: String, Sendable {
    case activityNetwork = "activity-network"
    case activityUnauthorized = "activity-unauthorized"
  }

  private actor UITestProgressAPI: ProgressAPIClient {
    let failure: UITestProgressFailure?
    let snapshot: UITestProgressSnapshot

    init(failure: UITestProgressFailure?, snapshot: UITestProgressSnapshot) {
      self.failure = failure
      self.snapshot = snapshot
    }

    func getActivity(token: String) async throws -> ActivityProgress {
      switch failure {
      case .activityNetwork:
        throw APIError.network
      case .activityUnauthorized:
        throw APIError.unauthorized
      case nil:
        break
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
