#if DEBUG
  import Foundation

  @MainActor
  struct UITestConfiguration {
    let courseCatalog: CourseCatalogStore
    let initiallyPresentsAccount: Bool
    let progress: ProgressStore
    let session: SessionStore

    static var current: UITestConfiguration? {
      let arguments = Set(ProcessInfo.processInfo.arguments)

      guard arguments.contains("--ui-testing") else {
        return nil
      }

      let session = SessionStore.preview(
        account: account(from: ProcessInfo.processInfo.environment))

      return UITestConfiguration(
        courseCatalog: CourseCatalogStore(
          api: courseCatalogAPI(from: ProcessInfo.processInfo.environment),
          language: currentCourseCatalogLanguage(),
          session: session),
        initiallyPresentsAccount: arguments.contains("--ui-testing-account-sheet"),
        progress: ProgressStore(
          api: progressAPI(from: ProcessInfo.processInfo.environment),
          session: session),
        session: session)
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
      from environment: [String: String]
    ) -> any CourseCatalogAPIClient {
      guard let catalogJSON = environment["ZOONK_UI_TEST_CATALOG"] else {
        let clients = APIClientFactory.live(baseURL: AppConfiguration.current.apiBaseURL)
        return CourseCatalogAPI(clients: clients)
      }

      do {
        let snapshot = try JSONDecoder().decode(
          UITestCourseCatalogSnapshot.self,
          from: Data(catalogJSON.utf8))
        return UITestCourseCatalogAPI(snapshot: snapshot)
      } catch {
        preconditionFailure("ZOONK_UI_TEST_CATALOG must contain a valid catalog snapshot")
      }
    }
  }

  private struct UITestCourseCatalogSnapshot: Decodable, Sendable {
    let chapters: [CourseChapter]
    let completedLessonIDs: Set<String>
    let courses: [Course]
    let lessons: [CourseLesson]
  }

  private actor UITestCourseCatalogAPI: CourseCatalogAPIClient {
    let snapshot: UITestCourseCatalogSnapshot

    init(snapshot: UITestCourseCatalogSnapshot) {
      self.snapshot = snapshot
    }

    func listCourses(query: CourseCatalogQuery) async throws -> CourseCatalogPage {
      let matchingCourses = snapshot.courses.filter { course in
        course.language == query.language
          && query.category.map(course.categories.contains) != false
      }
      let requestedStartIndex = query.cursor.flatMap(Int.init) ?? 0
      let startIndex = min(max(requestedStartIndex, 0), matchingCourses.count)
      let pageSize = max(query.limit ?? 20, 0)
      let endIndex = min(startIndex + pageSize, matchingCourses.count)
      let courses = matchingCourses[startIndex..<endIndex].map(makeCourseSummary)
      let hasMore = endIndex < matchingCourses.count

      return CourseCatalogPage(
        courses: courses,
        hasMore: hasMore,
        nextCursor: hasMore ? String(endIndex) : nil)
    }

    func getCourse(id: String) async throws -> Course {
      guard let course = snapshot.courses.first(where: { $0.id == id }) else {
        throw CourseCatalogFailure.notFound
      }

      return course
    }

    func getChapter(id: String) async throws -> CourseChapter {
      guard let chapter = snapshot.chapters.first(where: { $0.id == id }) else {
        throw CourseCatalogFailure.notFound
      }

      return chapter
    }

    func listCourseChapters(courseID: String) async throws -> [CourseChapter] {
      snapshot.chapters.filter { $0.courseID == courseID }
    }

    func listChapterLessons(chapterID: String) async throws -> [CourseLesson] {
      snapshot.lessons.filter { $0.chapterID == chapterID }
    }

    func getCourseNextLesson(courseID: String, token: String?) async throws
      -> CatalogContinuationTarget
    {
      guard
        let course = snapshot.courses.first(where: { $0.id == courseID }),
        let target = continuationTarget(
          (lessons: lessons(inCourse: courseID), token: token)),
        let chapter = snapshot.chapters.first(where: { $0.id == target.lesson.chapterID })
      else {
        return .empty(CatalogEmptyContinuation(completed: false, hasStarted: false))
      }

      return makeLessonContinuation(
        (
          completed: target.completed,
          course: course,
          chapter: chapter,
          hasStarted: target.hasStarted,
          lesson: target.lesson
        ))
    }

    func getChapterNextLesson(chapterID: String, token: String?) async throws
      -> CatalogContinuationTarget
    {
      guard
        let chapter = snapshot.chapters.first(where: { $0.id == chapterID }),
        let course = snapshot.courses.first(where: { $0.id == chapter.courseID }),
        let target = continuationTarget(
          (lessons: lessons(inChapter: chapterID), token: token))
      else {
        return .empty(CatalogEmptyContinuation(completed: false, hasStarted: false))
      }

      return makeLessonContinuation(
        (
          completed: target.completed,
          course: course,
          chapter: chapter,
          hasStarted: target.hasStarted,
          lesson: target.lesson
        ))
    }

    func getCourseProgress(courseID: String, token: String?) async throws -> CourseProgress {
      let completedLessonIDs = completedLessonIDs(token: token)
      let courseLessons = lessons(inCourse: courseID)

      return CourseProgress(
        chapters: snapshot.chapters
          .filter { $0.courseID == courseID }
          .map {
            makeCourseChapterProgress(
              (chapter: $0, completedLessonIDs: completedLessonIDs))
          },
        percentComplete: completionPercent(
          (
            completed: courseLessons.count(where: { completedLessonIDs.contains($0.id) }),
            total: courseLessons.count,
            token: token
          )))
    }

    func getChapterProgress(chapterID: String, token: String?) async throws -> ChapterProgress {
      let completedLessonIDs = completedLessonIDs(token: token)
      let chapterLessons = lessons(inChapter: chapterID)

      return ChapterProgress(
        lessons: chapterLessons.map {
          ChapterLessonProgress(
            isCompleted: completedLessonIDs.contains($0.id),
            lessonID: $0.id)
        },
        percentComplete: completionPercent(
          (
            completed: chapterLessons.count(where: { completedLessonIDs.contains($0.id) }),
            total: chapterLessons.count,
            token: token
          )))
    }

    func searchCatalog(query: CatalogSearchQuery) async throws -> CatalogSearchResults {
      CatalogSearchResults(
        chapters: snapshot.chapters
          .filter {
            matchesSearch(
              (query: query.query, title: $0.title, description: $0.description))
          }
          .compactMap(makeChapterSearchResult),
        courses: snapshot.courses
          .filter {
            matchesSearch(
              (query: query.query, title: $0.title, description: $0.description))
          }
          .map(makeCourseSearchResult))
    }

    private func makeCourseSummary(_ course: Course) -> CourseSummary {
      CourseSummary(
        description: course.description,
        id: course.id,
        imageURL: course.imageURL,
        language: course.language,
        organization: course.organization,
        slug: course.slug,
        title: course.title)
    }

    private func completedLessonIDs(token: String?) -> Set<String> {
      token == nil ? [] : snapshot.completedLessonIDs
    }

    private func lessons(inChapter chapterID: String) -> [CourseLesson] {
      snapshot.lessons
        .filter { $0.chapterID == chapterID }
        .sorted(using: KeyPathComparator(\.position))
    }

    private func lessons(inCourse courseID: String) -> [CourseLesson] {
      let chapterPositions = Dictionary(
        uniqueKeysWithValues: snapshot.chapters.map { ($0.id, $0.position) })

      return snapshot.lessons
        .filter { $0.courseID == courseID }
        .sorted { left, right in
          courseLessonOrder((lesson: left, chapterPositions: chapterPositions))
            < courseLessonOrder((lesson: right, chapterPositions: chapterPositions))
        }
    }

    private func courseLessonOrder(
      _ source: (lesson: CourseLesson, chapterPositions: [String: Int])
    ) -> (Int, Int, String) {
      (
        source.chapterPositions[source.lesson.chapterID] ?? 0,
        source.lesson.position,
        source.lesson.id
      )
    }

    private func continuationTarget(
      _ source: (lessons: [CourseLesson], token: String?)
    ) -> (completed: Bool, hasStarted: Bool, lesson: CourseLesson)? {
      guard let firstLesson = source.lessons.first else {
        return nil
      }

      let completedLessonIDs = completedLessonIDs(token: source.token)
      let hasStarted = source.lessons.contains(where: { completedLessonIDs.contains($0.id) })

      guard
        let nextLesson = source.lessons.first(where: { !completedLessonIDs.contains($0.id) })
      else {
        return (completed: true, hasStarted: hasStarted, lesson: firstLesson)
      }

      return (completed: false, hasStarted: hasStarted, lesson: nextLesson)
    }

    private func completionPercent(
      _ source: (completed: Int, total: Int, token: String?)
    ) -> Int? {
      guard source.token != nil, source.total > 0 else {
        return nil
      }

      return source.completed * 100 / source.total
    }

    private func makeCourseChapterProgress(
      _ source: (chapter: CourseChapter, completedLessonIDs: Set<String>)
    ) -> CourseChapterProgress {
      let chapterLessons = lessons(inChapter: source.chapter.id)
      return CourseChapterProgress(
        chapterID: source.chapter.id,
        completedLessons: chapterLessons.count(where: {
          source.completedLessonIDs.contains($0.id)
        }),
        totalLessons: chapterLessons.count)
    }

    private func makeLessonContinuation(
      _ source: (
        completed: Bool,
        course: Course,
        chapter: CourseChapter,
        hasStarted: Bool,
        lesson: CourseLesson
      )
    ) -> CatalogContinuationTarget {
      .lesson(
        CatalogLessonContinuation(
          canPrefetch: true,
          chapterID: source.chapter.id,
          chapterSlug: source.chapter.slug,
          completed: source.completed,
          courseID: source.course.id,
          courseSlug: source.course.slug,
          hasStarted: source.hasStarted,
          lessonID: source.lesson.id,
          lessonPosition: source.lesson.position,
          lessonSlug: source.lesson.slug,
          organizationSlug: source.course.organization.slug))
    }

    private func matchesSearch(
      _ source: (query: String, title: String, description: String?)
    ) -> Bool {
      source.title.localizedCaseInsensitiveContains(source.query)
        || source.description?.localizedCaseInsensitiveContains(source.query) == true
    }

    private func makeCourseSearchResult(_ course: Course) -> CatalogCourseSearchResult {
      CatalogCourseSearchResult(
        description: course.description,
        id: course.id,
        imageURL: course.imageURL,
        language: course.language,
        organizationSlug: course.organization.slug,
        slug: course.slug,
        title: course.title)
    }

    private func makeChapterSearchResult(
      _ chapter: CourseChapter
    ) -> CatalogChapterSearchResult? {
      guard let course = snapshot.courses.first(where: { $0.id == chapter.courseID }) else {
        return nil
      }

      return CatalogChapterSearchResult(
        courseID: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        description: chapter.description,
        id: chapter.id,
        imageURL: chapter.imageURL,
        language: chapter.language,
        organizationSlug: course.organization.slug,
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
        throw ProgressAPIError.network
      }

      return snapshot.overview
    }

    func getActivity(token: String) async throws -> ActivityProgress {
      if failure == .activityUnauthorized {
        throw ProgressAPIError.unauthorized
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
