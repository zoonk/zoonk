import Foundation
import Observation

/// A bearer token belongs to one account, so the token is the identity: a restored session is the
/// same before and after `GET /me` names its account.
struct AuthenticatedSession: Hashable, Sendable {
  /// Nil while the stored token is being validated at launch.
  let accountID: String?
  let bearerToken: String

  static func == (lhs: Self, rhs: Self) -> Bool {
    lhs.bearerToken == rhs.bearerToken
  }

  func hash(into hasher: inout Hasher) {
    hasher.combine(bearerToken)
  }
}

@MainActor
@Observable
final class SessionStore {
  private(set) var failure: AccountFailure?
  private(set) var isWorking = false
  private(set) var state = AccountSessionState.restoring

  private let api: any AccountAPIClient
  private let credentialStore: any SessionCredentialStoring
  private let googleAuthentication: any GoogleAuthenticating
  private let skipsCredentialReconciliation: Bool
  private var interactiveOperationRevision = UUID()
  private var accountRefreshRevision = UUID()
  private var workingOperationRevision: UUID?
  private var isReconciling = false
  private var didRestore = false
  private var token: String?
  /// The Keychain's token while launch validates it, so the launch reads start alongside `GET /me`.
  private var restoringToken: String?

  private enum StoredCredentialValidation {
    case active(CurrentAccount)
    case cancelled
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
    api: any AccountAPIClient,
    credentialStore: any SessionCredentialStoring,
    googleAuthentication: any GoogleAuthenticating,
    skipsCredentialReconciliation: Bool = false
  ) {
    self.api = api
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

  var authenticatedSession: AuthenticatedSession? {
    if let account, let token {
      return AuthenticatedSession(accountID: account.user.id, bearerToken: token)
    }

    guard state == .restoring, let restoringToken else {
      return nil
    }

    return AuthenticatedSession(accountID: nil, bearerToken: restoringToken)
  }

  /// Only when memory and the Keychain still hold that session, so a late response never deletes a
  /// newer credential from another device.
  func expire(_ authenticatedSession: AuthenticatedSession) async {
    guard self.authenticatedSession == authenticatedSession else {
      return
    }

    do {
      guard try credentialStore.read() == authenticatedSession.bearerToken else {
        guard !isReconciling else {
          return
        }

        isReconciling = true
        defer { isReconciling = false }
        _ = await loadLatestCredential()
        return
      }
    } catch {
      failure = .network
      state = .unavailable
      return
    }

    markInteractiveOperationStarted()
    failure = nil
    _ = clearLocalSession()
  }

  var isGoogleSignInAvailable: Bool {
    googleAuthentication.isAvailable
  }

  static func preview(account: CurrentAccount? = nil) -> SessionStore {
    let clients = APIClientFactory.live(baseURL: AppConfiguration.current.apiBaseURL)
    let api = AccountAPI(clients: clients)
    let token = account == nil ? nil : "preview-session"
    let store = SessionStore(
      api: api,
      credentialStore: InMemorySessionCredentialStore(token: token),
      googleAuthentication: GoogleAuthenticationClient(),
      skipsCredentialReconciliation: true)
    store.didRestore = true
    store.token = token

    if let account {
      store.state = .signedIn(account)
    } else {
      store.state = .signedOut
    }

    return store
  }

  func restore() async {
    guard !skipsCredentialReconciliation, !didRestore, !isReconciling, !isWorking else {
      return
    }

    didRestore = true
    isReconciling = true
    state = .restoring
    failure = nil
    defer {
      isReconciling = false
      restoringToken = nil
    }

    if !(await loadLatestCredential()) {
      didRestore = false
    }
  }

  func retryRestore() async {
    guard !isReconciling, !isWorking else {
      return
    }

    isReconciling = true
    let workingRevision = startWorkingOperation()
    failure = nil
    defer {
      isReconciling = false
      finishWorkingOperation(workingRevision)
    }

    _ = await loadLatestCredential()
  }

  func reconcileSynchronizedCredential() async {
    guard !skipsCredentialReconciliation, didRestore, !isReconciling, !isWorking else {
      return
    }

    isReconciling = true
    defer { isReconciling = false }

    _ = await loadLatestCredential()
  }

  func sendEmailCode(email: String) async -> Bool {
    markInteractiveOperationStarted()
    let workingRevision = startWorkingOperation()
    failure = nil
    defer { finishWorkingOperation(workingRevision) }

    do {
      try await api.sendEmailCode(email: email)
      return true
    } catch {
      failure = getFailure(error)
      return false
    }
  }

  /// Uses the account's own bearer, without creating or refreshing a session.
  func sendAccountDeletionEmailCode() async -> Bool {
    guard let authenticatedSession, let account else { return false }

    markInteractiveOperationStarted()
    let revision = interactiveOperationRevision
    let workingRevision = startWorkingOperation()
    failure = nil
    defer { finishWorkingOperation(workingRevision) }

    do {
      try await api.sendEmailCode(
        email: account.user.email, token: authenticatedSession.bearerToken)
      return isCurrentAccountSession(authenticatedSession)
    } catch {
      guard isCurrentAccountOperation(authenticatedSession, revision: revision) else {
        return false
      }
      switch error as? AccountAPIError {
      case .botDetected: failure = .botDetected
      case .disposableEmail: failure = .disposableEmail
      case .invalidEmail: failure = .invalidEmail
      case .network: failure = .network
      case .rateLimited: failure = .rateLimited
      default: failure = .emailCodeDelivery
      }
      return false
    }
  }

  func signInWithEmailCode(email: String, code: String) async {
    markInteractiveOperationStarted()
    let workingRevision = startWorkingOperation()
    failure = nil
    defer { finishWorkingOperation(workingRevision) }

    do {
      let token = try await api.signInWithEmailCode(
        email: email, code: code, guestToken: self.token)
      try await completeSignIn(token: token)
    } catch {
      failure = getFailure(error)
    }
  }

  func continueAsGuest() async -> Bool {
    markInteractiveOperationStarted()
    let workingRevision = startWorkingOperation()
    failure = nil
    defer { finishWorkingOperation(workingRevision) }

    do {
      let token = try await api.signInAsGuest()
      try await completeSignIn(token: token)
      return true
    } catch {
      failure = getFailure(error)
      return false
    }
  }

  func signInWithApple(_ credentials: AppleSignInCredentials) async {
    markInteractiveOperationStarted()
    let workingRevision = startWorkingOperation()
    failure = nil
    defer { finishWorkingOperation(workingRevision) }

    do {
      let token = try await api.signInWithApple(credentials, guestToken: self.token)
      try await completeSignIn(token: token)
    } catch {
      failure = getFailure(error)
    }
  }

  func signInWithGoogle(from anchor: GoogleAuthenticationAnchor) async {
    markInteractiveOperationStarted()
    let workingRevision = startWorkingOperation()
    failure = nil
    defer { finishWorkingOperation(workingRevision) }

    do {
      let identityToken = try await googleAuthentication.signIn(from: anchor)
      let token = try await api.signInWithGoogle(idToken: identityToken, guestToken: self.token)
      try await completeSignIn(token: token)
    } catch GoogleAuthenticationError.canceled {
      failure = nil
    } catch {
      googleAuthentication.signOut()
      failure = getFailure(error)
    }
  }

  func handleGoogleSignInURL(_ url: URL) {
    googleAuthentication.handle(url)
  }

  func updateProfile(name: String, username: String) async -> Bool {
    guard let authenticatedSession else {
      state = .signedOut
      return false
    }

    markInteractiveOperationStarted()
    let profileRevision = interactiveOperationRevision
    let profileRefreshRevision = accountRefreshRevision
    let workingRevision = startWorkingOperation()
    failure = nil
    defer { finishWorkingOperation(workingRevision) }

    do {
      let updatedAccount = try await api.updateProfile(
        token: authenticatedSession.bearerToken,
        name: name,
        username: username)

      guard
        self.authenticatedSession == authenticatedSession,
        interactiveOperationRevision == profileRevision,
        accountRefreshRevision == profileRefreshRevision
      else {
        return false
      }

      state = .signedIn(updatedAccount)
      return true
    } catch AccountAPIError.unauthorized {
      await expire(authenticatedSession)
      return false
    } catch {
      guard
        self.authenticatedSession == authenticatedSession,
        interactiveOperationRevision == profileRevision
      else {
        return false
      }

      failure = getFailure(error)
      return false
    }
  }

  /// Records Apple's signed transaction on the server before StoreKit finishes it.
  func synchronizeAppleSubscription(
    signedTransaction: String,
    expectedAccountID: String?
  ) async -> AccountSubscriptionSynchronizationResult {
    guard let expectedAccountID else {
      return .authenticationRequired
    }

    guard let account, let token else {
      state = .signedOut
      return .authenticationRequired
    }

    guard account.user.id == expectedAccountID else {
      return .accountMismatch
    }

    let authenticatedSession = AuthenticatedSession(accountID: account.user.id, bearerToken: token)
    accountRefreshRevision = UUID()
    let synchronizationRevision = accountRefreshRevision

    do {
      let synchronization = try await api.synchronizeAppleSubscription(
        token: token,
        signedTransaction: signedTransaction)

      if isCurrentAccountSession(authenticatedSession),
        accountRefreshRevision == synchronizationRevision
      {
        // A same-session refresh may have started while the server recorded this purchase. Its
        // older account snapshot must not replace the subscription state returned here.
        accountRefreshRevision = UUID()
        failure = nil
        state = .signedIn(synchronization.account)
      }

      return synchronization.isActive ? .synchronizedActive : .synchronizedInactive
    } catch AccountAPIError.accountMismatch {
      return .accountMismatch
    } catch AccountAPIError.invalidAppStorePurchase {
      return .invalidPurchase
    } catch AccountAPIError.unauthorized {
      guard self.token == token else {
        return .authenticationRequired
      }

      _ = clearLocalSession()
      return .authenticationRequired
    } catch {
      return .failed
    }
  }

  /// Revokes the bearer session before clearing local state, so a failed request can be retried and
  /// no other device keeps an unrevoked credential.
  func signOut() async {
    guard let token else {
      _ = clearLocalSession()
      return
    }

    markInteractiveOperationStarted()
    let workingRevision = startWorkingOperation()
    failure = nil
    defer { finishWorkingOperation(workingRevision) }

    do {
      try await api.signOut(token: token)
    } catch AccountAPIError.unauthorized {
      _ = clearLocalSession()
      return
    } catch {
      failure = getFailure(error)
      return
    }

    _ = clearLocalSession()
  }

  func deleteAccount() async -> AccountDeletionResult {
    guard let authenticatedSession else {
      return .failed
    }

    let token = authenticatedSession.bearerToken
    markInteractiveOperationStarted()
    let revision = interactiveOperationRevision
    let workingRevision = startWorkingOperation()
    failure = nil
    defer { finishWorkingOperation(workingRevision) }

    do {
      let response = try await api.deleteAccount(token: token)
      guard isCurrentAccountSession(authenticatedSession) else {
        return .failed
      }
      return completeAccountDeletion(response)
    } catch AccountAPIError.reauthenticationRequired {
      guard isCurrentAccountOperation(authenticatedSession, revision: revision) else {
        return .failed
      }
      return .emailReauthenticationRequired
    } catch AccountAPIError.unauthorized {
      guard isCurrentAccountOperation(authenticatedSession, revision: revision) else {
        return .failed
      }
      return clearLocalSession() ? .signedOut : .failed
    } catch {
      guard isCurrentAccountOperation(authenticatedSession, revision: revision) else {
        return .failed
      }
      let reconciliation = await reconcileAmbiguousDeletion(
        after: error, session: authenticatedSession, revision: revision)

      guard
        isCurrentAccountOperation(authenticatedSession, revision: revision)
          || reconciliation == .signedOut
      else { return .failed }

      if reconciliation == .signedOut {
        return .signedOut
      }

      failure = getAccountDeletionFailure(error)
      return .failed
    }
  }

  func deleteAccount(reauthorizedWith credentials: AppleSignInCredentials) async
    -> AccountDeletionResult
  {
    guard let authenticatedSession else {
      return .failed
    }

    let token = authenticatedSession.bearerToken
    markInteractiveOperationStarted()
    let revision = interactiveOperationRevision
    let workingRevision = startWorkingOperation()
    failure = nil
    defer { finishWorkingOperation(workingRevision) }

    do {
      let response = try await api.deleteAccount(token: token, appleCredentials: credentials)
      guard isCurrentAccountSession(authenticatedSession) else {
        return .failed
      }
      return completeAccountDeletion(response)
    } catch AccountAPIError.appleCredentialMismatch {
      guard isCurrentAccountOperation(authenticatedSession, revision: revision) else {
        return .failed
      }
      return .emailReauthenticationRequired
    } catch AccountAPIError.reauthenticationRequired {
      guard isCurrentAccountOperation(authenticatedSession, revision: revision) else {
        return .failed
      }
      return .emailReauthenticationRequired
    } catch AccountAPIError.unauthorized {
      guard isCurrentAccountOperation(authenticatedSession, revision: revision) else {
        return .failed
      }
      return clearLocalSession() ? .signedOut : .failed
    } catch {
      guard isCurrentAccountOperation(authenticatedSession, revision: revision) else {
        return .failed
      }
      let reconciliation = await reconcileAmbiguousDeletion(
        after: error, session: authenticatedSession, revision: revision)

      guard
        isCurrentAccountOperation(authenticatedSession, revision: revision)
          || reconciliation == .signedOut
      else { return .failed }

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

  /// Uses the original session, so the server consumes the code without the signup-capable login
  /// endpoint.
  func deleteAccount(
    reauthorizedEmail email: String,
    code: String
  ) async -> AccountDeletionResult {
    guard let authenticatedSession else {
      return .failed
    }

    let token = authenticatedSession.bearerToken
    markInteractiveOperationStarted()
    let revision = interactiveOperationRevision
    let workingRevision = startWorkingOperation()
    failure = nil
    defer { finishWorkingOperation(workingRevision) }

    do {
      let response = try await api.deleteAccount(
        token: token,
        emailCredentials: EmailReauthenticationCredentials(email: email, otp: code))
      guard isCurrentAccountSession(authenticatedSession) else {
        return .failed
      }
      return completeAccountDeletion(response)
    } catch AccountAPIError.accountMismatch {
      guard isCurrentAccountOperation(authenticatedSession, revision: revision) else {
        return .failed
      }
      failure = .accountMismatch
      return .failed
    } catch AccountAPIError.unauthorized {
      guard isCurrentAccountOperation(authenticatedSession, revision: revision) else {
        return .failed
      }
      return clearLocalSession() ? .signedOut : .failed
    } catch {
      guard isCurrentAccountOperation(authenticatedSession, revision: revision) else {
        return .failed
      }
      let reconciliation = await reconcileAmbiguousDeletion(
        after: error, session: authenticatedSession, revision: revision)

      guard
        isCurrentAccountOperation(authenticatedSession, revision: revision)
          || reconciliation == .signedOut
      else { return .failed }

      if reconciliation == .signedOut {
        return .signedOut
      }

      failure = getAccountDeletionFailure(error)
      return .failed
    }
  }

  func reportSignInFailure() {
    markInteractiveOperationStarted()
    failure = .signIn
  }

  func clearFailure() {
    failure = nil
  }

  /// Validates before persisting, so the app never restores a token that can't load its account.
  private func completeSignIn(token: String) async throws {
    let account = try await api.getCurrentAccount(token: token)
    try credentialStore.save(token)
    self.token = token
    state = .signedIn(account)
  }

  /// False while the Keychain still holds the token, so a failed delete never restores a stale
  /// session later.
  private func clearLocalSession() -> Bool {
    googleAuthentication.signOut()

    do {
      try credentialStore.delete()
    } catch {
      failure = .network
      state = .unavailable
      return false
    }

    markInteractiveOperationStarted()
    token = nil
    state = .signedOut
    return true
  }

  private func completeAccountDeletion(_ response: AccountDeletionResponse)
    -> AccountDeletionResult
  {
    guard clearLocalSession() else {
      return .failed
    }

    failure = nil
    return response.appleAuthorizationRevoked == false
      ? .deletedWithManualAppleRevocation
      : .deleted
  }

  /// Never claims success from an invalid bearer: an unauthorized response signs out, since it can't
  /// prove the deletion committed.
  private func reconcileAmbiguousDeletion(
    after error: Error,
    session: AuthenticatedSession,
    revision: UUID
  ) async -> AccountDeletionReconciliation {
    guard let apiError = error as? AccountAPIError,
      apiError == .network || apiError == .invalidResponse
    else {
      return .notNeeded
    }

    let reconciliationRevision = accountRefreshRevision
    do {
      let account = try await api.getCurrentAccount(token: session.bearerToken)
      guard isCurrentAccountOperation(session, revision: revision),
        accountRefreshRevision == reconciliationRevision
      else { return .unavailable }
      state = .signedIn(account)
      return .accountExists
    } catch AccountAPIError.unauthorized {
      guard isCurrentAccountOperation(session, revision: revision),
        accountRefreshRevision == reconciliationRevision
      else { return .unavailable }
      return clearLocalSession() ? .signedOut : .unavailable
    } catch {
      return .unavailable
    }
  }

  /// Starts again if iCloud synchronized a newer credential while the request was in flight.
  private func loadLatestCredential() async -> Bool {
    do {
      guard let storedToken = try credentialStore.read() else {
        googleAuthentication.signOut()
        token = nil
        failure = nil
        state = .signedOut
        return true
      }

      if state == .restoring {
        restoringToken = storedToken
      }

      let validationRevision = accountRefreshRevision
      let validation = await validateStoredCredential(storedToken)

      if case .cancelled = validation {
        return false
      }

      guard try credentialStore.read() == storedToken else {
        return await loadLatestCredential()
      }

      if validationRevision != accountRefreshRevision, self.token == storedToken {
        return true
      }

      applyStoredCredentialValidation(validation, token: storedToken)
      return true
    } catch {
      failure = .network

      if token == nil {
        state = .unavailable
      }

      return true
    }
  }

  private func validateStoredCredential(_ token: String) async -> StoredCredentialValidation {
    do {
      return .active(try await api.getCurrentAccount(token: token))
    } catch is CancellationError {
      return .cancelled
    } catch AccountAPIError.unauthorized {
      return .unauthorized
    } catch {
      return .unavailable
    }
  }

  private func applyStoredCredentialValidation(
    _ validation: StoredCredentialValidation,
    token: String
  ) {
    switch validation {
    case .active(let account):
      self.token = token
      failure = nil
      state = .signedIn(account)
    case .unauthorized:
      if clearLocalSession() {
        failure = nil
      }
    case .unavailable:
      failure = .network

      if self.token == nil {
        state = .unavailable
      }
    case .cancelled:
      break
    }
  }

  /// Busy ownership is independent of result freshness: background mutations can invalidate a response without starting a new user-facing operation.
  private func startWorkingOperation() -> UUID {
    let revision = UUID()
    workingOperationRevision = revision
    isWorking = true
    return revision
  }

  private func finishWorkingOperation(_ revision: UUID) {
    guard workingOperationRevision == revision else { return }
    workingOperationRevision = nil
    isWorking = false
  }

  /// A synchronized credential replacement invalidates results even before foreground reconciliation runs.
  private func isCurrentAccountOperation(_ session: AuthenticatedSession, revision: UUID) -> Bool {
    isCurrentAccountSession(session) && interactiveOperationRevision == revision
  }

  /// Successful delivery or deletion still belongs to this account after a same-session update, while newer credentials remain protected.
  private func isCurrentAccountSession(_ session: AuthenticatedSession) -> Bool {
    authenticatedSession == session && (try? credentialStore.read()) == session.bearerToken
  }

  private func markInteractiveOperationStarted() {
    interactiveOperationRevision = UUID()
    accountRefreshRevision = UUID()
  }

  private func getFailure(_ error: Error) -> AccountFailure {
    guard let apiError = error as? AccountAPIError else {
      return .signIn
    }

    switch apiError {
    case .accountDisabled, .accountMismatch, .appleCredentialMismatch:
      return .signIn
    case .botDetected:
      return .botDetected
    case .disposableEmail:
      return .disposableEmail
    case .invalidCode:
      return .invalidCode
    case .invalidAppStorePurchase:
      return .signIn
    case .invalidEmail:
      return .invalidEmail
    case .network:
      return .network
    case .rateLimited:
      return .rateLimited
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

  private func getAccountDeletionFailure(_ error: Error) -> AccountFailure {
    guard let apiError = error as? AccountAPIError else {
      return .accountDeletion
    }

    switch apiError {
    case .botDetected:
      return .botDetected
    case .accountMismatch:
      return .accountMismatch
    case .accountDisabled, .appleCredentialMismatch, .disposableEmail:
      return .accountDeletion
    case .invalidCode:
      return .invalidCode
    case .invalidAppStorePurchase:
      return .accountDeletion
    case .invalidEmail:
      return .invalidEmail
    case .network:
      return .network
    case .rateLimited:
      return .rateLimited
    case .invalidResponse, .reauthenticationRequired, .unauthorized, .usernameTaken, .validation:
      return .accountDeletion
    }
  }
}
