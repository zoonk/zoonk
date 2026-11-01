#if DEBUG
  import Foundation

  @MainActor
  struct UITestConfiguration {
    let dependencies: AppDependencies
    var fixtureFailure: String?

    static var current: UITestConfiguration? {
      guard ProcessInfo.processInfo.arguments.contains("--ui-testing") else {
        return nil
      }

      let environment = ProcessInfo.processInfo.environment
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
          learnerSummaryAPI: summary.map {
            UITestLearnerSummaryAPI(summary: makeLearnerSummary($0))
          },
          progressAPI: try progressAPI(from: fixtures),
          tutorAPI: buddyStatus.map { _ in UITestTutorAPI() }))
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
    let summary: LearnerSummary

    func getSummary(token: String) async throws -> LearnerSummary {
      summary
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
    func thread(_ scope: TutorScope, cursor: String?, token: String) async throws
      -> TutorThreadPage
    {
      TutorThreadPage(turns: [], hasMore: false, nextCursor: nil)
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
