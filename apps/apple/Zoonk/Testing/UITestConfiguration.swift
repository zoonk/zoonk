#if DEBUG
  import Foundation

  @MainActor
  struct UITestConfiguration {
    let dependencies: AppDependencies
    var fixtureFailure: String?

    static var current: UITestConfiguration? {
      let arguments = Set(ProcessInfo.processInfo.arguments)
      let environment = ProcessInfo.processInfo.environment

      guard arguments.contains("--ui-testing") else {
        // Lets a Debug run against the live API check mind maps without paying to generate one.
        return UITestMindMapsAPI(environment: environment).map { mindMaps in
          UITestConfiguration(dependencies: .live(mindMapsAPI: mindMaps))
        }
      }

      let clients = APIClientFactory.live(baseURL: AppConfiguration.current.apiBaseURL)

      do {
        return try fixtures(clients: clients, environment: environment)
      } catch {
        return UITestConfiguration(
          dependencies: AppDependencies(
            clients: clients, session: .preview(), imageLoader: .live(),
            subscriptionStore: .live()),
          fixtureFailure: String(describing: error))
      }
    }

    private static func fixtures(
      clients: APIClientFactory, environment: [String: String]
    ) throws -> UITestConfiguration {
      let fixtures = UITestFixtures(environment: environment)
      let summary = try fixtures.decode(
        Components.Schemas.LearnerSummary.self, "ZOONK_UI_TEST_SUMMARY")
      let buddyStatus = try fixtures.decode(BuddyStatus.self, "ZOONK_UI_TEST_BUDDY")

      return UITestConfiguration(
        dependencies: AppDependencies(
          clients: clients,
          session: SessionStore.preview(
            account: try fixtures.decode(CurrentAccount.self, "ZOONK_UI_TEST_ACCOUNT")),
          imageLoader: .live(),
          subscriptionStore: .live(),
          buddyAPI: buddyStatus.map(UITestBuddyAPI.init),
          learnerSummaryAPI: UITestLearnerSummaryAPI(summary: summary.map(makeLearnerSummary)),
          mindMapsAPI: UITestMindMapsAPI(environment: environment),
          progressAPI: try progressAPI(from: fixtures),
          studyAPI: try studyAPI(from: fixtures),
          tutorAPI: buddyStatus.map { _ in
            UITestTutorAPI(turns: Int(environment["ZOONK_UI_TEST_TUTOR_TURNS"] ?? "") ?? 0)
          }))
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
          analytics: LearnerAnalytics(
            disabled: false, goalKind: nil, plan: "free", planPhase: nil, usageDataSharing: nil,
            username: nil),
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

    func openBlock(token: String, target: StudyBlockOpeningTarget, timeZone: String) async throws
      -> StudyBlockOpening
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

    func lessonReadiness(token: String, lessonID: String) async throws
      -> Components.Schemas.LessonReadiness
    {
      throw APIError.network
    }

    func followWriting(token: String, lessonID: String, run: String?) async throws
      -> Components.Schemas.LessonReadiness
    {
      throw APIError.network
    }

    func writeLesson(token: String, lessonID: String) async throws -> LessonWritingOutcome {
      throw APIError.network
    }

    func prepareLessons(token: String, goalID: String) async throws {
      throw APIError.network
    }

    func answerUploadRequest(token: String, goalID: String, sourceIDs: [String]) async throws
      -> UploadAnswer
    {
      throw APIError.network
    }

    func dismissUploadRequest(token: String, goalID: String) async throws {
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
