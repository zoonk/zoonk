#if DEBUG
  import Foundation

  @MainActor
  struct UITestConfiguration {
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
