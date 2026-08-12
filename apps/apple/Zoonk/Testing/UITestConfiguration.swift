#if DEBUG
  import Foundation

  @MainActor
  struct UITestConfiguration {
    let initiallyPresentsAccount: Bool
    let session: SessionStore

    static var current: UITestConfiguration? {
      let arguments = Set(ProcessInfo.processInfo.arguments)

      guard arguments.contains("--ui-testing") else {
        return nil
      }

      return UITestConfiguration(
        initiallyPresentsAccount: arguments.contains("--ui-testing-account-sheet"),
        session: SessionStore.preview(account: account(from: ProcessInfo.processInfo.environment)))
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
  }
#endif
