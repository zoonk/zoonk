import Foundation
import Observation

@MainActor
@Observable
final class SessionStore {
  private(set) var failure: AccountFailure?
  private(set) var isWorking = false
  private(set) var state = AccountSessionState.restoring

  private let api: AccountAPI
  private let companionCredentialSync: any CompanionCredentialSyncing
  private let credentialStore: any SessionCredentialStoring
  private let googleAuthentication: GoogleAuthenticationClient
  private let skipsCredentialReconciliation: Bool
  private var interactiveOperationRevision = UUID()
  private var isReconciling = false
  private var didRestore = false
  private var token: String?

  private enum StoredCredentialValidation {
    case active(CurrentAccount)
    case unauthorized
    case unavailable
  }

  private enum AccountDeletionReconciliation {
    case accountExists
    case notNeeded
    case signedOut
    case unavailable
  }

  init(
    api: AccountAPI,
    companionCredentialSync: any CompanionCredentialSyncing,
    credentialStore: any SessionCredentialStoring,
    googleAuthentication: GoogleAuthenticationClient,
    skipsCredentialReconciliation: Bool = false
  ) {
    self.api = api
    self.companionCredentialSync = companionCredentialSync
    self.credentialStore = credentialStore
    self.googleAuthentication = googleAuthentication
    self.skipsCredentialReconciliation = skipsCredentialReconciliation
  }

  var account: CurrentAccount? {
    guard case .signedIn(let account) = state else {
      return nil
    }

    return account
  }

  /// Composes the live API and Keychain dependencies once at the application boundary while keeping UI tests off the real credential store.
  static func live(configuration: AppConfiguration = .current) -> SessionStore {
    let api = AccountAPI.live(baseURL: configuration.apiBaseURL)
    #if DEBUG
      let usesSignedInUITestFixture = ProcessInfo.processInfo.arguments.contains(
        "--ui-testing-signed-in")
    #else
      let usesSignedInUITestFixture = false
    #endif
    let credentialStore: any SessionCredentialStoring =
      ProcessInfo.processInfo.arguments.contains("--ui-testing")
      ? InMemorySessionCredentialStore()
      : SessionCredentialStore()

    let store = SessionStore(
      api: api,
      companionCredentialSync: makeCompanionCredentialSync(),
      credentialStore: credentialStore,
      googleAuthentication: GoogleAuthenticationClient(),
      skipsCredentialReconciliation: usesSignedInUITestFixture)

    #if DEBUG
      if usesSignedInUITestFixture {
        store.didRestore = true
        store.token = "ui-testing-session"
        store.state = .signedIn(uiTestingAccount)
      }
    #endif

    return store
  }

  /// Supplies a stable signed-out session to previews without starting network or Keychain work.
  static func preview() -> SessionStore {
    let api = AccountAPI.live(baseURL: AppConfiguration.current.apiBaseURL)
    let store = SessionStore(
      api: api,
      companionCredentialSync: NoopCompanionCredentialSync(),
      credentialStore: InMemorySessionCredentialStore(),
      googleAuthentication: GoogleAuthenticationClient())
    store.didRestore = true
    store.state = .signedOut
    return store
  }

  /// Restores a synchronized bearer token and validates it with the server before showing any authenticated account data.
  func restore() async {
    guard !skipsCredentialReconciliation, !didRestore, !isReconciling, !isWorking else {
      return
    }

    didRestore = true
    isReconciling = true
    state = .restoring
    failure = nil
    defer { isReconciling = false }

    await loadLatestCredential()
  }

  /// Retries validation after a temporary service or connectivity failure without discarding the still-valid Keychain token.
  func retryRestore() async {
    guard !isReconciling, !isWorking else {
      return
    }

    isReconciling = true
    isWorking = true
    failure = nil
    defer {
      isReconciling = false
      isWorking = false
    }

    await loadLatestCredential()
  }

  /// Reconciles the in-memory account with iCloud Keychain after another Apple device adds, replaces, or removes the shared session credential.
  func reconcileSynchronizedCredential() async {
    guard !skipsCredentialReconciliation, didRestore, !isReconciling, !isWorking else {
      return
    }

    isReconciling = true
    defer { isReconciling = false }

    await loadLatestCredential()
  }

  /// Begins the localized email flow without changing the session until the user proves ownership with the received code.
  func sendEmailCode(email: String) async -> Bool {
    markInteractiveOperationStarted()
    isWorking = true
    failure = nil
    defer { isWorking = false }

    do {
      try await api.sendEmailCode(email: email)
      return true
    } catch {
      failure = getFailure(error)
      return false
    }
  }

  /// Completes email sign-in and persists only the resulting Zoonk session, never the one-time code.
  func signInWithEmailCode(email: String, code: String) async {
    markInteractiveOperationStarted()
    isWorking = true
    failure = nil
    defer { isWorking = false }

    do {
      let token = try await api.signInWithEmailCode(email: email, code: code)
      try await completeSignIn(token: token)
    } catch {
      failure = getFailure(error)
    }
  }

  /// Sends Apple's native credential to the API and stores only the Zoonk session returned after server verification.
  func signInWithApple(_ credentials: AppleSignInCredentials) async {
    markInteractiveOperationStarted()
    isWorking = true
    failure = nil
    defer { isWorking = false }

    do {
      let token = try await api.signInWithApple(credentials)
      try await completeSignIn(token: token)
    } catch {
      failure = getFailure(error)
    }
  }

  /// Uses Google's native SDK to obtain a signed ID token, then asks Better Auth to verify it and create the Zoonk session.
  func signInWithGoogle() async {
    markInteractiveOperationStarted()
    isWorking = true
    failure = nil
    defer { isWorking = false }

    do {
      let identityToken = try await googleAuthentication.signIn()
      let token = try await api.signInWithGoogle(idToken: identityToken)
      try await completeSignIn(token: token)
    } catch GoogleAuthenticationError.canceled {
      failure = nil
    } catch {
      googleAuthentication.signOut()
      failure = getFailure(error)
    }
  }

  #if os(iOS) || os(macOS)
    /// Returns Google OAuth callbacks to the SDK instance that owns the active native sign-in flow.
    func handleGoogleSignInURL(_ url: URL) {
      googleAuthentication.handle(url)
    }
  #endif

  /// Saves first-time setup and later profile edits through the same authenticated product API.
  func updateProfile(name: String, username: String) async -> Bool {
    guard let token else {
      state = .signedOut
      return false
    }

    markInteractiveOperationStarted()
    isWorking = true
    failure = nil
    defer { isWorking = false }

    do {
      state = .signedIn(
        try await api.updateProfile(token: token, name: name, username: username))
      return true
    } catch AccountAPIError.unauthorized {
      clearLocalSession()
      return false
    } catch {
      failure = getFailure(error)
      return false
    }
  }

  /// Revokes the shared bearer session before clearing local state so a failed request can be retried and another running Apple device never keeps an unrevoked credential.
  func signOut() async {
    guard let token else {
      clearLocalSession()
      return
    }

    markInteractiveOperationStarted()
    isWorking = true
    failure = nil
    defer { isWorking = false }

    do {
      try await api.signOut(token: token)
    } catch AccountAPIError.unauthorized {
      clearLocalSession()
      return
    } catch {
      failure = getFailure(error)
      return
    }

    clearLocalSession()
  }

  /// Attempts immediate deletion for non-Apple accounts and reports when Better Auth requires a newer proof of identity instead of weakening its freshness check.
  func deleteAccount() async -> AccountDeletionResult {
    guard let token else {
      return .failed
    }

    markInteractiveOperationStarted()
    isWorking = true
    failure = nil
    defer { isWorking = false }

    do {
      let response = try await api.deleteAccount(token: token)
      return completeAccountDeletion(response)
    } catch AccountAPIError.reauthenticationRequired {
      return .emailReauthenticationRequired
    } catch AccountAPIError.unauthorized {
      clearLocalSession()
      return .signedOut
    } catch {
      let reconciliation = await reconcileAmbiguousDeletion(after: error, token: token)

      if reconciliation == .signedOut {
        return .signedOut
      }

      failure = getAccountDeletionFailure(error)
      return .failed
    }
  }

  /// Supplies a fresh credential from the official Apple authorization sheet to the server's atomic deletion operation, then reports any manual provider cleanup that remains.
  func deleteAccount(reauthorizedWith credentials: AppleSignInCredentials) async
    -> AccountDeletionResult
  {
    guard let token else {
      return .failed
    }

    markInteractiveOperationStarted()
    isWorking = true
    failure = nil
    defer { isWorking = false }

    do {
      let response = try await api.deleteAccount(token: token, appleCredentials: credentials)
      return completeAccountDeletion(response)
    } catch AccountAPIError.appleCredentialMismatch {
      return .emailReauthenticationRequired
    } catch AccountAPIError.reauthenticationRequired {
      return .emailReauthenticationRequired
    } catch AccountAPIError.unauthorized {
      clearLocalSession()
      return .signedOut
    } catch {
      let reconciliation = await reconcileAmbiguousDeletion(after: error, token: token)

      switch reconciliation {
      case .accountExists:
        return .emailReauthenticationRequired
      case .signedOut:
        return .signedOut
      case .notNeeded, .unavailable:
        break
      }

      failure = getAccountDeletionFailure(error)
      return .failed
    }
  }

  /// Sends the fixed account email and OTP with the original session so the server can verify and consume the code without invoking the signup-capable login endpoint.
  func deleteAccount(
    reauthorizedEmail email: String,
    code: String
  ) async -> AccountDeletionResult {
    guard let token else {
      return .failed
    }

    markInteractiveOperationStarted()
    isWorking = true
    failure = nil
    defer { isWorking = false }

    do {
      let response = try await api.deleteAccount(
        token: token,
        emailCredentials: EmailReauthenticationCredentials(email: email, otp: code))
      return completeAccountDeletion(response)
    } catch AccountAPIError.accountMismatch {
      failure = .accountMismatch
      return .failed
    } catch AccountAPIError.unauthorized {
      clearLocalSession()
      return .signedOut
    } catch {
      let reconciliation = await reconcileAmbiguousDeletion(after: error, token: token)

      if reconciliation == .signedOut {
        return .signedOut
      }

      failure = getAccountDeletionFailure(error)
      return .failed
    }
  }

  /// Lets native authorization adapters report a recoverable failure without exposing provider-specific error details in UI state.
  func reportSignInFailure() {
    markInteractiveOperationStarted()
    failure = .signIn
  }

  /// Clears an inline error when the user changes inputs or begins another recovery attempt.
  func clearFailure() {
    failure = nil
  }

  /// Validates a new session before synchronizing it so another device never receives a token the current device has not proved usable.
  private func completeSignIn(token: String) async throws {
    let account = try await api.getCurrentAccount(token: token)
    try credentialStore.save(token)
    self.token = token
    state = .signedIn(account)
    companionCredentialSync.synchronize(token: token)
  }

  /// Clears Zoonk and Google credentials once the server session is gone or local authentication can no longer represent a usable account.
  private func clearLocalSession() {
    googleAuthentication.signOut()
    try? credentialStore.delete()
    token = nil
    state = .signedOut
    companionCredentialSync.synchronize(token: nil)
  }

  /// Clears local credentials after server deletion and preserves Apple's manual fallback when the API cannot confirm that Sign in with Apple authorization was revoked.
  private func completeAccountDeletion(_ response: AccountDeletionResponse)
    -> AccountDeletionResult
  {
    clearLocalSession()

    return response.appleAuthorizationRevoked == false
      ? .deletedWithManualAppleRevocation
      : .deleted
  }

  /// Rechecks an indeterminate DELETE without claiming success from an invalid bearer token. An active account remains signed in; an unauthorized response clears unusable local credentials and returns to signed-out UI because it cannot prove whether deletion committed.
  private func reconcileAmbiguousDeletion(
    after error: Error,
    token: String
  ) async -> AccountDeletionReconciliation {
    guard let apiError = error as? AccountAPIError,
      apiError == .network || apiError == .invalidResponse
    else {
      return .notNeeded
    }

    do {
      state = .signedIn(try await api.getCurrentAccount(token: token))
      return .accountExists
    } catch AccountAPIError.unauthorized {
      clearLocalSession()
      return .signedOut
    } catch {
      return .unavailable
    }
  }

  /// Reads and validates one Keychain snapshot, then starts again if iCloud synchronized a newer credential while the request was in flight.
  private func loadLatestCredential() async {
    do {
      guard let storedToken = try credentialStore.read() else {
        googleAuthentication.signOut()
        token = nil
        failure = nil
        state = .signedOut
        companionCredentialSync.synchronize(token: nil)
        return
      }

      let validationRevision = interactiveOperationRevision
      let validation = await validateStoredCredential(storedToken)

      guard validationRevision == interactiveOperationRevision else {
        return
      }

      guard try credentialStore.read() == storedToken else {
        await loadLatestCredential()
        return
      }

      applyStoredCredentialValidation(validation, token: storedToken)
    } catch {
      failure = .network

      if token == nil {
        state = .unavailable
      }
    }
  }

  /// Converts server validation into a value so Keychain freshness can be checked before any account state or credential is changed.
  private func validateStoredCredential(_ token: String) async -> StoredCredentialValidation {
    do {
      return .active(try await api.getCurrentAccount(token: token))
    } catch AccountAPIError.unauthorized {
      return .unauthorized
    } catch {
      return .unavailable
    }
  }

  /// Applies only a validation result that still belongs to the latest synchronized Keychain token.
  private func applyStoredCredentialValidation(
    _ validation: StoredCredentialValidation,
    token: String
  ) {
    switch validation {
    case .active(let account):
      self.token = token
      failure = nil
      state = .signedIn(account)
      companionCredentialSync.synchronize(token: token)
    case .unauthorized:
      clearLocalSession()
      failure = nil
    case .unavailable:
      failure = .network

      if self.token == nil {
        state = .unavailable
      }
    }
  }

  /// Invalidates any background credential result that started before the user's latest sign-in, profile, or sign-out action.
  private func markInteractiveOperationStarted() {
    interactiveOperationRevision = UUID()
  }

  /// Reduces transport and provider failures to concise actions the account UI can explain and recover from.
  private func getFailure(_ error: Error) -> AccountFailure {
    guard let apiError = error as? AccountAPIError else {
      return .signIn
    }

    switch apiError {
    case .accountMismatch, .appleCredentialMismatch:
      return .signIn
    case .invalidCode:
      return .invalidCode
    case .invalidEmail:
      return .invalidEmail
    case .network:
      return .network
    case .reauthenticationRequired:
      return .accountDeletion
    case .usernameTaken:
      return .usernameTaken
    case .validation:
      return .validation
    case .invalidResponse, .unauthorized:
      return .signIn
    }
  }

  /// Preserves actionable OTP and connectivity errors while giving every other sensitive-operation failure deletion-specific copy.
  private func getAccountDeletionFailure(_ error: Error) -> AccountFailure {
    guard let apiError = error as? AccountAPIError else {
      return .accountDeletion
    }

    switch apiError {
    case .accountMismatch:
      return .accountMismatch
    case .appleCredentialMismatch:
      return .accountDeletion
    case .invalidCode:
      return .invalidCode
    case .invalidEmail:
      return .invalidEmail
    case .network:
      return .network
    case .invalidResponse, .reauthenticationRequired, .unauthorized, .usernameTaken, .validation:
      return .accountDeletion
    }
  }

  #if DEBUG
    private static let uiTestingAccount = CurrentAccount(
      account: AccountAccess(
        deletion: AccountDeletionRequirements(hasAppleAccount: false),
        subscription: AccountSubscription(plan: "plus", provider: "google", status: "active")),
      user: AccountUser(
        displayUsername: "ui_test_user",
        email: "ui-test@zoonk.test",
        id: "7846d3f5-b9c4-4ded-b283-35f70a48af86",
        image: nil,
        name: "UI Test User",
        username: "ui_test_user"))
  #endif
}
